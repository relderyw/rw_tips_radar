import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '../components/ui/Card';
import { fetchHistoryGames, fetchPlayerHistory } from '../services/api';
import { HistoryMatch } from '../types';

interface PlayerTrend {
  player: string;
  league: string;
  last5: HistoryMatch[];
  
  // Trend 1: Active Streak (4 HT goals, then 5th game broke it)
  // Actually, user said: "Last 4 games followed trend, 5th game broke it"
  // This could mean: Games [0,1,2,3] are trend, Game [4] is break.
  isTrendBrokenIn5th: boolean; 
  avgHtDuringStreak: number | null;
  ftGoalsOnBreak: number | null;

  // Trend 2: Just Broken (Previous 4 games [1,2,3,4] were trend, Most recent [0] broke it)
  isJustBroken: boolean;
  avgHtBeforeBreak: number | null;
  ftGoalsOnJustBreak: number | null;

  // Trend 3: HT Win / FT Fail
  htLeadNoWinCount: number;
  htLeadNoWinPct: number;
}

const safeNum = (n: number | undefined | null) => Number(n ?? 0);

const computeTrendsForPlayer = (player: string, league: string, matches: HistoryMatch[]): PlayerTrend | null => {
  if (!matches || matches.length < 5) return null;

  // Ensure we have at least 5 matches sorted by date desc (API usually returns desc)
  // We'll take the first 5.
  const last5 = matches.slice(0, 5);

  const perGame = last5.map(m => {
    const isHome = m.home_player === player;
    const htSelf = safeNum(isHome ? m.halftime_score_home : m.halftime_score_away);
    const htOpp = safeNum(isHome ? m.halftime_score_away : m.halftime_score_home);
    const ftSelf = safeNum(isHome ? m.score_home : m.score_away);
    const ftOpp = safeNum(isHome ? m.score_away : m.score_home);
    return { htSelf, htOpp, ftSelf, ftOpp };
  });

  // --- Logic 1: "Trend Broken in 5th" ---
  // Interpretation: The most recent 4 games (indices 0,1,2,3) HAVE HT goals.
  // The 5th game (index 4) did NOT have HT goal, but DID have FT goal.
  // Wait, user said: "Last 4 games followed, 5th broke". 
  // If "5th" means the one BEFORE the 4, then it's a streak of 4 established after a break.
  // If "5th" means the CURRENT one (most recent) broke the previous 4, that's "Just Broken".
  // Let's implement "Just Broken" as the primary "Trend Breaker" signal.
  
  // Let's stick to the user's example: "Last 4 games followed... 5th game he broke".
  // This usually implies a sequence. 
  // Case A: [HT, HT, HT, HT, NO_HT] (Most recent is index 0). 
  // If user means "Last 4 games" are the most recent, then index 0,1,2,3 are HT. Index 4 is NO_HT.
  // This is "Active Streak of 4".
  
  // Case B: [NO_HT, HT, HT, HT, HT]
  // Most recent (0) is NO_HT. Previous 4 (1,2,3,4) are HT.
  // This is "Just Broken".

  // We will detect BOTH.

  // Check for Active Streak (Indices 0-3 have HT goals, Index 4 does NOT)
  const recent4 = perGame.slice(0, 4);
  const game5 = perGame[4];
  const activeStreak4 = recent4.every(g => g.htSelf > 0);
  const game5Broke = game5.htSelf === 0 && game5.ftSelf > 0; // Broke trend (no HT) but scored FT
  const isTrendBrokenIn5th = activeStreak4 && game5Broke;
  
  const avgHtDuringStreak = isTrendBrokenIn5th 
    ? Number((recent4.reduce((acc, g) => acc + g.htSelf, 0) / 4).toFixed(2)) 
    : null;
  const ftGoalsOnBreak = isTrendBrokenIn5th ? game5.ftSelf : null;

  // Check for Just Broken (Index 0 NO HT, Indices 1-4 HAVE HT)
  const game0 = perGame[0];
  const prev4 = perGame.slice(1, 5);
  const prev4Streak = prev4.every(g => g.htSelf > 0);
  const game0Broke = game0.htSelf === 0 && game0.ftSelf > 0;
  const isJustBroken = prev4Streak && game0Broke;

  const avgHtBeforeBreak = isJustBroken
    ? Number((prev4.reduce((acc, g) => acc + g.htSelf, 0) / 4).toFixed(2))
    : null;
  const ftGoalsOnJustBreak = isJustBroken ? game0.ftSelf : null;

  // --- Logic 2: HT Win but FT Fail ---
  // Games where player was winning at HT (htSelf > htOpp) but did NOT win FT (ftSelf <= ftOpp)
  const htLeadNoWinCount = perGame.filter(g => (g.htSelf > g.htOpp) && (g.ftSelf <= g.ftOpp)).length;
  const htLeadNoWinPct = Number(((htLeadNoWinCount / perGame.length) * 100).toFixed(1));

  return {
    player,
    league,
    last5,
    isTrendBrokenIn5th,
    avgHtDuringStreak,
    ftGoalsOnBreak,
    isJustBroken,
    avgHtBeforeBreak,
    ftGoalsOnJustBreak,
    htLeadNoWinCount,
    htLeadNoWinPct
  };
};

export const Tendencias: React.FC = () => {
  const [league, setLeague] = useState<string>('A');
  const [availableLeagues, setAvailableLeagues] = useState<string[]>([]);
  const [playersByLeague, setPlayersByLeague] = useState<Record<string, Set<string>>>({});
  const [results, setResults] = useState<PlayerTrend[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    const bootstrap = async () => {
      const history = await fetchHistoryGames();
      const leagues = Array.from(new Set(history.map(h => h.league_name))).sort();
      setAvailableLeagues(leagues);
      const map: Record<string, Set<string>> = {};
      history.forEach(h => {
        const ln = h.league_name || 'Desconhecida';
        if (!map[ln]) map[ln] = new Set<string>();
        map[ln].add(h.home_player);
        map[ln].add(h.away_player);
      });
      setPlayersByLeague(map);
    };
    bootstrap();
  }, []);

  const loadTrends = async () => {
    const playerSet: Set<string> = playersByLeague[league] ?? new Set<string>();
    const players: string[] = Array.from(playerSet);
    // Limit to avoid rate limits, but try to get enough data
    const limited = players.slice(0, 30); 
    setLoading(true);
    const out: PlayerTrend[] = [];
    const CONCURRENCY = 5;
    
    for (let i = 0; i < limited.length; i += CONCURRENCY) {
      const batch: string[] = limited.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.all(batch.map(async (p: string) => {
        const matches = await fetchPlayerHistory(p, 6); // Fetch 6 to be safe for 5 game logic
        return computeTrendsForPlayer(p, league, matches);
      }));
      batchResults.forEach(t => { if (t) out.push(t); });
    }

    // Sort by "Interestingness"
    out.sort((a, b) => {
      // Prioritize "Just Broken" -> "Trend Broken in 5th" -> "HT Lead Fail"
      const scoreA = (a.isJustBroken ? 100 : 0) + (a.isTrendBrokenIn5th ? 50 : 0) + a.htLeadNoWinPct;
      const scoreB = (b.isJustBroken ? 100 : 0) + (b.isTrendBrokenIn5th ? 50 : 0) + b.htLeadNoWinPct;
      return scoreB - scoreA;
    });

    setResults(out);
    setLoading(false);
  };

  useEffect(() => {
    if (playersByLeague[league]) loadTrends();
  }, [league, playersByLeague]);

  const filteredWithStrongSignals = useMemo(() => {
    return results.filter(r => r.isJustBroken || r.isTrendBrokenIn5th || r.htLeadNoWinPct >= 40);
  }, [results]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
           <h2 className="text-2xl font-bold text-white">Padrões e Tendências</h2>
           <p className="text-textMuted text-sm">Análise dos últimos 5 jogos</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={league}
            onChange={(e) => setLeague(e.target.value)}
            className="bg-surfaceHighlight text-white text-sm px-3 py-2 rounded border border-white/10"
          >
            {availableLeagues.map(l => (
              <option key={l} value={l}>{l}</option>
            ))}
            {!availableLeagues.includes('A') && <option value="A">A</option>}
          </select>
          <button
            onClick={loadTrends}
            className="px-3 py-2 bg-accent text-surface rounded text-sm hover:opacity-90 font-bold"
          >
            Atualizar
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-textMuted animate-pulse">Analisando partidas...</p>
        </div>
      ) : filteredWithStrongSignals.length === 0 ? (
        <div className="text-center py-16 text-textMuted bg-surface/30 rounded-xl border border-white/5">
          <p>Nenhum padrão forte encontrado nos jogadores analisados da Liga {league}.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredWithStrongSignals.map(r => (
            <Card key={r.player} className="p-4 bg-white/5 hover:bg-white/10 transition-colors border-white/5">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="text-white font-bold text-lg truncate">{r.player}</h3>
                  <p className="text-xs text-textMuted">Liga {r.league}</p>
                </div>
                <div className="flex flex-col gap-1 items-end">
                    {r.isJustBroken && (
                    <span className="text-[10px] px-2 py-1 rounded bg-red-500/20 text-red-400 border border-red-500/30 font-black uppercase tracking-wider">
                        Quebrou Agora
                    </span>
                    )}
                    {r.isTrendBrokenIn5th && (
                    <span className="text-[10px] px-2 py-1 rounded bg-green-500/20 text-green-400 border border-green-500/30 font-black uppercase tracking-wider">
                        Sequência Ativa
                    </span>
                    )}
                </div>
              </div>

              <div className="space-y-3 text-xs">
                {r.isJustBroken && (
                    <div className="bg-white/5 p-2 rounded border border-white/5">
                        <p className="text-red-300 font-bold mb-1">Padrão Quebrado (Último Jogo)</p>
                        <div className="flex justify-between">
                            <span className="text-textMuted">Média HT (4 anteriores)</span>
                            <span className="font-mono">{r.avgHtBeforeBreak}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-textMuted">Gols FT na quebra</span>
                            <span className="font-mono">{r.ftGoalsOnJustBreak}</span>
                        </div>
                    </div>
                )}

                {r.isTrendBrokenIn5th && (
                    <div className="bg-white/5 p-2 rounded border border-white/5">
                        <p className="text-green-300 font-bold mb-1">Sequência de 4 Jogos HT</p>
                        <div className="flex justify-between">
                            <span className="text-textMuted">Média HT (Atual)</span>
                            <span className="font-mono">{r.avgHtDuringStreak}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-textMuted">Jogo anterior (5º)</span>
                            <span className="font-mono">0 HT / {r.ftGoalsOnBreak} FT</span>
                        </div>
                    </div>
                )}

                {r.htLeadNoWinPct >= 40 && (
                     <div className="bg-white/5 p-2 rounded border border-white/5">
                        <p className="text-yellow-300 font-bold mb-1">Ganhou HT / Não Ganhou FT</p>
                        <div className="flex justify-between">
                            <span className="text-textMuted">Ocorrências (5 jogos)</span>
                            <span className="font-mono">{r.htLeadNoWinCount}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-textMuted">Taxa</span>
                            <span className="font-mono">{r.htLeadNoWinPct}%</span>
                        </div>
                     </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};