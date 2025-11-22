import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '../components/ui/Card';
import { fetchHistoryGames, fetchPlayerHistory } from '../services/api';
import { HistoryMatch } from '../types';

interface PlayerTrend {
  player: string;
  league: string;
  last5: HistoryMatch[];
  htStreak4ThenFtBreak: boolean;
  htAvgDuringStreak: number | null;
  ftGoalsOnBreak: number | null;
  htLeadNoWinCount: number;
  htLeadNoWinPct: number;
}

const safeNum = (n: number | undefined | null) => Number(n ?? 0);

const computeTrendsForPlayer = (player: string, league: string, matches: HistoryMatch[]): PlayerTrend | null => {
  if (!matches || matches.length === 0) return null;

  const last5 = matches.slice(0, 5);

  const perGame = last5.map(m => {
    const isHome = m.home_player === player;
    const htSelf = safeNum(isHome ? m.halftime_score_home : m.halftime_score_away);
    const htOpp = safeNum(isHome ? m.halftime_score_away : m.halftime_score_home);
    const ftSelf = safeNum(isHome ? m.score_home : m.score_away);
    const ftOpp = safeNum(isHome ? m.score_away : m.score_home);
    return { htSelf, htOpp, ftSelf, ftOpp };
  });

  // 1) Streak HT nos 4 primeiros e quebra no 5º com gol no FT
  const first4 = perGame.slice(0, 4);
  const game5 = perGame[4];
  const htStreak4 = first4.every(g => g.htSelf > 0);
  const htAvgDuringStreak = htStreak4 ? Number((first4.reduce((acc, g) => acc + g.htSelf, 0) / 4).toFixed(2)) : null;
  const ftGoalsOnBreak = game5 ? game5.ftSelf : null;
  const brokeIn5WithFt = !!game5 && game5.htSelf === 0 && (game5.ftSelf > 0);
  const htStreak4ThenFtBreak = htStreak4 && brokeIn5WithFt;

  // 2) Casos em que vence no HT mas não vence no FT
  const htLeadNoWinCount = perGame.filter(g => (g.htSelf > g.htOpp) && (g.ftSelf <= g.ftOpp)).length;
  const htLeadNoWinPct = Number(((htLeadNoWinCount / perGame.length) * 100).toFixed(1));

  return {
    player,
    league,
    last5,
    htStreak4ThenFtBreak,
    htAvgDuringStreak,
    ftGoalsOnBreak,
    htLeadNoWinCount,
    htLeadNoWinPct,
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
    // Garante tipos: obtém Set<string> da liga ou vazio
    const playerSet: Set<string> = playersByLeague[league] ?? new Set<string>();
    const players: string[] = Array.from(playerSet);
    // Para não sobrecarregar, limitamos a 24 jogadores por execução
    const limited = players.slice(0, 24);
    setLoading(true);
    const out: PlayerTrend[] = [];
    const CONCURRENCY = 4;
    for (let i = 0; i < limited.length; i += CONCURRENCY) {
      const batch: string[] = limited.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.all(batch.map(async (p: string) => {
        const matches = await fetchPlayerHistory(p, 5);
        const trend = computeTrendsForPlayer(p, league, matches);
        return trend;
      }));
      batchResults.forEach(t => { if (t) out.push(t); });
    }
    // Ordenar para destacar padrões fortes primeiro
    out.sort((a, b) => {
      const aScore = (a.htStreak4ThenFtBreak ? 1 : 0) * 2 + a.htLeadNoWinPct;
      const bScore = (b.htStreak4ThenFtBreak ? 1 : 0) * 2 + b.htLeadNoWinPct;
      return bScore - aScore;
    });
    setResults(out);
    setLoading(false);
  };

  useEffect(() => {
    // Atualiza ao alterar liga, se já temos players carregados
    if (playersByLeague[league]) loadTrends();
  }, [league, playersByLeague]);

  const filteredWithStrongSignals = useMemo(() => {
    return results.filter(r => r.htStreak4ThenFtBreak || r.htLeadNoWinPct >= 50);
  }, [results]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">Tendências por Liga</h2>
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
            className="px-3 py-2 bg-accent text-surface rounded text-sm hover:opacity-90"
          >
            Atualizar
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : filteredWithStrongSignals.length === 0 ? (
        <div className="text-center py-16 text-textMuted bg-surface/30 rounded-xl border border-white/5">
          <p>Nenhuma tendência forte encontrada nos últimos 5 jogos.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredWithStrongSignals.map(r => (
            <Card key={r.player} className="p-4 bg-white/5 hover:bg-white/10">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-white font-bold text-lg truncate">{r.player}</h3>
                  <p className="text-xs text-textMuted">Liga: {r.league}</p>
                </div>
                {r.htStreak4ThenFtBreak && (
                  <span className="text-[10px] px-2 py-1 rounded bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 font-black uppercase">Quebra de HT</span>
                )}
              </div>

              <div className="mt-3 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-textMuted">HT 4 seguidos e 5º sem HT, com FT?</span>
                  <span className="font-bold">{r.htStreak4ThenFtBreak ? 'Sim' : 'Não'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-textMuted">Média HT nos 4 jogos (sequência)</span>
                  <span className="font-mono font-bold">{r.htAvgDuringStreak ?? '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-textMuted">Gols FT no jogo da quebra</span>
                  <span className="font-mono font-bold">{r.ftGoalsOnBreak ?? '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-textMuted">Vence HT mas não FT (5 jogos)</span>
                  <span className="font-mono font-bold">{r.htLeadNoWinCount} ({r.htLeadNoWinPct}%)</span>
                </div>
              </div>

              <div className="mt-3 text-[10px] text-textMuted">
                <p>Base: últimos 5 jogos do jogador na liga, usando placares HT/FT normalizados.</p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};