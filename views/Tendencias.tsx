import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '../components/ui/Card';
import { fetchHistoryGames, fetchPlayerHistory } from '../services/api';
import { HistoryMatch } from '../types';
import { TrendingUp, AlertTriangle, CheckCircle2, XCircle, Flame, ShieldAlert, Target } from 'lucide-react';

// --- Types ---

type TrendType = 
  | 'STREAK_BREAKER_ACTIVE' // 4 games HT, 5th broke (User's specific request)
  | 'STREAK_JUST_BROKEN'    // 4 games HT, most recent broke
  | 'HT_WIN_FT_FAIL'        // Wins HT, Fails FT
  | 'OVER_25_TRAIN'         // 4+ games Over 2.5
  | 'BTTS_TRAIN'            // 4+ games BTTS
  | 'SNIPER_FT'             // Low HT goals, High FT goals
  | 'NONE';

interface PlayerTrend {
  player: string;
  league: string;
  last5: HistoryMatch[];
  trends: {
    type: TrendType;
    confidence: number; // 0-100
    description: string;
    stats: { label: string; value: string | number }[];
  }[];
}

// --- Helpers ---

const safeNum = (n: number | undefined | null) => Number(n ?? 0);

const getMatchStats = (player: string, m: HistoryMatch) => {
  const isHome = m.home_player === player;
  return {
    htSelf: safeNum(isHome ? m.halftime_score_home : m.halftime_score_away),
    htOpp: safeNum(isHome ? m.halftime_score_away : m.halftime_score_home),
    ftSelf: safeNum(isHome ? m.score_home : m.score_away),
    ftOpp: safeNum(isHome ? m.score_away : m.score_home),
    totalHT: safeNum(m.halftime_score_home) + safeNum(m.halftime_score_away),
    totalFT: safeNum(m.score_home) + safeNum(m.score_away),
    isBTTS: safeNum(m.score_home) > 0 && safeNum(m.score_away) > 0,
    date: m.data_realizacao
  };
};

const analyzeTrends = (player: string, league: string, matches: HistoryMatch[]): PlayerTrend | null => {
  if (!matches || matches.length < 5) return null;

  // Sort by date desc just in case, then take 5
  const last5 = matches.slice(0, 5);
  const games = last5.map(m => getMatchStats(player, m));

  const detectedTrends: PlayerTrend['trends'] = [];

  // 1. Streak Breaker (User Request: "Last 4 games HT, 5th broke")
  // Interpretation: Games [0,1,2,3] are the "Last 4" (Most Recent). Game [4] is the "5th".
  // Pattern: [HT, HT, HT, HT] (Recent) <- [NO HT] (5th game)
  const recent4 = games.slice(0, 4);
  const game5 = games[4];
  const isStreak4 = recent4.every(g => g.htSelf > 0);
  const isGame5Break = game5.htSelf === 0 && game5.ftSelf > 0; // No HT, but scored FT

  if (isStreak4 && isGame5Break) {
    const avgHt = (recent4.reduce((acc, g) => acc + g.htSelf, 0) / 4).toFixed(2);
    detectedTrends.push({
      type: 'STREAK_BREAKER_ACTIVE',
      confidence: 95,
      description: 'Sequência Ativa de HT (4 jogos) após quebra',
      stats: [
        { label: 'Média HT (Seq)', value: avgHt },
        { label: 'Jogo da Quebra', value: `0 HT / ${game5.ftSelf} FT` }
      ]
    });
  }

  // 2. Just Broken (User Request Variation: "Streak of 4, then broke")
  // Pattern: [NO HT] (Most Recent) <- [HT, HT, HT, HT]
  const game0 = games[0];
  const prev4 = games.slice(1, 5);
  const isPrev4Streak = prev4.every(g => g.htSelf > 0);
  const isGame0Break = game0.htSelf === 0 && game0.ftSelf > 0;

  if (isPrev4Streak && isGame0Break) {
    const avgHt = (prev4.reduce((acc, g) => acc + g.htSelf, 0) / 4).toFixed(2);
    detectedTrends.push({
      type: 'STREAK_JUST_BROKEN',
      confidence: 90,
      description: 'Quebra de Padrão HT no último jogo',
      stats: [
        { label: 'Média HT (Ant)', value: avgHt },
        { label: 'Quebra (Atual)', value: `0 HT / ${game0.ftSelf} FT` }
      ]
    });
  }

  // 3. HT Win / FT Fail
  // Winning at HT but NOT winning at FT
  const htWinFtFailCount = games.filter(g => (g.htSelf > g.htOpp) && (g.ftSelf <= g.ftOpp)).length;
  if (htWinFtFailCount >= 2) { // 2 out of 5 is significant enough to warn
    detectedTrends.push({
      type: 'HT_WIN_FT_FAIL',
      confidence: htWinFtFailCount >= 3 ? 85 : 60,
      description: 'Vence HT mas tropeça no FT',
      stats: [
        { label: 'Ocorrências', value: `${htWinFtFailCount}/5` },
        { label: 'Risco', value: 'Alto' }
      ]
    });
  }

  // 4. Over 2.5 Train
  const over25Count = games.filter(g => g.totalFT > 2.5).length;
  if (over25Count >= 4) {
    detectedTrends.push({
      type: 'OVER_25_TRAIN',
      confidence: over25Count === 5 ? 90 : 75,
      description: 'Tendência forte de Over 2.5',
      stats: [
        { label: 'Jogos Over', value: `${over25Count}/5` },
        { label: 'Média Gols', value: (games.reduce((a,b)=>a+b.totalFT,0)/5).toFixed(1) }
      ]
    });
  }

  // 5. BTTS Train
  const bttsCount = games.filter(g => g.isBTTS).length;
  if (bttsCount >= 4) {
    detectedTrends.push({
      type: 'BTTS_TRAIN',
      confidence: bttsCount === 5 ? 90 : 75,
      description: 'Tendência de Ambos Marcam',
      stats: [
        { label: 'BTTS', value: `${bttsCount}/5` }
      ]
    });
  }

  if (detectedTrends.length === 0) return null;

  // Sort trends by confidence
  detectedTrends.sort((a, b) => b.confidence - a.confidence);

  return {
    player,
    league,
    last5,
    trends: detectedTrends
  };
};

// --- Components ---

const MatchMiniature: React.FC<{ player: string; match: HistoryMatch }> = ({ player, match }) => {
  const stats = getMatchStats(player, match);
  const isWin = stats.ftSelf > stats.ftOpp;
  const isDraw = stats.ftSelf === stats.ftOpp;
  
  // Color logic: Green for Win, Gray for Draw, Red for Loss
  const bgColor = isWin ? 'bg-emerald-500/20 border-emerald-500/30' : 
                  isDraw ? 'bg-white/10 border-white/10' : 
                  'bg-red-500/20 border-red-500/30';
  
  const textColor = isWin ? 'text-emerald-400' : 
                    isDraw ? 'text-textMuted' : 
                    'text-red-400';

  return (
    <div className={`flex flex-col items-center justify-center p-1 rounded border ${bgColor} min-w-[40px]`}>
      <span className={`text-[10px] font-bold ${textColor}`}>{stats.ftSelf}-{stats.ftOpp}</span>
      <span className="text-[8px] text-textMuted/70">HT {stats.htSelf}-{stats.htOpp}</span>
    </div>
  );
};

const TrendBadge: React.FC<{ type: TrendType }> = ({ type }) => {
  switch (type) {
    case 'STREAK_BREAKER_ACTIVE':
      return <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"><Flame size={10} /> SEQUÊNCIA ATIVA</span>;
    case 'STREAK_JUST_BROKEN':
      return <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded bg-red-500/20 text-red-400 border border-red-500/30"><AlertTriangle size={10} /> QUEBROU AGORA</span>;
    case 'HT_WIN_FT_FAIL':
      return <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30"><ShieldAlert size={10} /> PERIGO 2º TEMPO</span>;
    case 'OVER_25_TRAIN':
      return <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30"><TrendingUp size={10} /> OVER 2.5</span>;
    case 'BTTS_TRAIN':
      return <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30"><Target size={10} /> BTTS</span>;
    default:
      return null;
  }
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

      // Auto-select first league if current is invalid
      if (leagues.length > 0 && (!leagues.includes(league) || league === 'A')) {
         if (leagues.includes('A')) setLeague('A');
         else setLeague(leagues[0]);
      }
    };
    bootstrap();
  }, []);

  const loadTrends = async () => {
    const playerSet: Set<string> = playersByLeague[league] ?? new Set<string>();
    const players: string[] = Array.from(playerSet);
    const limited = players.slice(0, 40); // Increased limit slightly
    setLoading(true);
    
    const out: PlayerTrend[] = [];
    const CONCURRENCY = 5;
    
    for (let i = 0; i < limited.length; i += CONCURRENCY) {
      const batch: string[] = limited.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.all(batch.map(async (p: string) => {
        const matches = await fetchPlayerHistory(p, 6);
        return analyzeTrends(p, league, matches);
      }));
      batchResults.forEach(t => { if (t) out.push(t); });
    }

    // Sort by confidence of the top trend
    out.sort((a, b) => b.trends[0].confidence - a.trends[0].confidence);

    setResults(out);
    setLoading(false);
  };

  useEffect(() => {
    if (playersByLeague[league]) loadTrends();
  }, [league, playersByLeague]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-surfaceHighlight/30 p-6 rounded-2xl border border-white/5 backdrop-blur-sm">
        <div>
           <h2 className="text-3xl font-bold text-white flex items-center gap-3">
             <TrendingUp className="text-accent" size={32} />
             Padrões e Tendências
           </h2>
           <p className="text-textMuted mt-1">
             Algoritmo de detecção de padrões nos últimos 5 jogos.
           </p>
        </div>
        
        <div className="flex items-center gap-3 bg-surface/50 p-1 rounded-xl border border-white/5">
          <select
            value={league}
            onChange={(e) => setLeague(e.target.value)}
            className="bg-transparent text-white text-sm px-4 py-2 outline-none font-medium cursor-pointer hover:text-accent transition-colors"
          >
            {availableLeagues.map(l => (
              <option key={l} value={l} className="bg-surface text-textMain">{l}</option>
            ))}
          </select>
          <button
            onClick={loadTrends}
            className="px-4 py-2 bg-accent text-surface rounded-lg text-sm font-bold hover:brightness-110 transition-all shadow-lg shadow-accent/20"
          >
            Atualizar Análise
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-6">
            <div className="relative">
                <div className="w-16 h-16 border-4 border-surfaceHighlight rounded-full"></div>
                <div className="w-16 h-16 border-4 border-accent border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
            </div>
            <p className="text-textMuted animate-pulse font-medium">Analisando partidas e calculando probabilidades...</p>
        </div>
      ) : results.length === 0 ? (
        <div className="text-center py-24 text-textMuted bg-surface/30 rounded-2xl border border-white/5 flex flex-col items-center gap-4">
          <XCircle size={48} className="text-white/20" />
          <p>Nenhum padrão de alta confiança encontrado para os jogadores desta liga no momento.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {results.map(r => {
            const primaryTrend = r.trends[0];
            return (
              <Card key={r.player} className="group hover:border-accent/30 transition-all duration-300 overflow-hidden">
                {/* Card Header */}
                <div className="p-5 bg-gradient-to-br from-white/5 to-transparent border-b border-white/5">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="text-white font-bold text-xl truncate group-hover:text-accent transition-colors">{r.player}</h3>
                      <p className="text-xs text-textMuted font-medium uppercase tracking-wider">Liga {r.league}</p>
                    </div>
                    <TrendBadge type={primaryTrend.type} />
                  </div>
                  
                  <p className="text-sm text-white/80 mt-2 leading-relaxed">
                    {primaryTrend.description}
                  </p>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-px bg-white/5">
                  {primaryTrend.stats.map((stat, idx) => (
                    <div key={idx} className="bg-surface p-3 flex flex-col items-center justify-center text-center">
                      <span className="text-[10px] text-textMuted uppercase font-bold tracking-wider mb-1">{stat.label}</span>
                      <span className="text-white font-mono font-bold">{stat.value}</span>
                    </div>
                  ))}
                </div>

                {/* Visual History */}
                <div className="p-4 bg-surfaceHighlight/20">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] text-textMuted uppercase font-bold">Últimos 5 Jogos</span>
                    <span className="text-[10px] text-textMuted">(Mais recente à direita)</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    {/* Reverse to show oldest -> newest (left -> right) or newest -> oldest? 
                        Usually "Last 5" implies Newest on Left or Right. 
                        Let's show Newest on RIGHT to visualize the "Flow" of time -> 
                        Actually, standard is usually Newest Left. 
                        Let's stick to the array order (Newest is index 0).
                        So we map reverse to show Oldest -> Newest (Left -> Right)
                    */}
                    {[...r.last5].reverse().map((m, i) => (
                      <MatchMiniature key={i} player={r.player} match={m} />
                    ))}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};