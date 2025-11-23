
import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '../components/ui/Card';
import { fetchHistoryGames, fetchPlayerHistory } from '../services/api';
import { HistoryMatch } from '../types';
import { TrendingUp, AlertTriangle, CheckCircle2, XCircle, Flame, ShieldAlert, Target, Clock, Activity, Shield, Star, Crown, Zap, RefreshCw, Sunrise, Sunset } from 'lucide-react';

// --- Types ---

type TrendType = 
  | 'STREAK_BREAKER_ACTIVE' 
  | 'STREAK_JUST_BROKEN'    
  | 'HT_WIN_FT_FAIL'        
  | 'OVER_25_TRAIN'         
  | 'BTTS_TRAIN'            
  | 'SLOW_STARTER'          
  | 'HT_DOMINATOR'          
  | 'GLASS_DEFENSE'
  | 'COMEBACK_KING'         // New: Wins FT after trailing HT
  | 'MERCILESS'             // New: Wins by 3+ goals
  | 'LATE_BLOOMER'          // New: Most goals in 2nd half
  | 'EARLY_BIRD'            // New: Most goals in 1st half
  | 'NONE';

interface PlayerStats {
  avgScoredFT: number;
  avgConcededFT: number;
  winsHT: number;
  drawsHT: number;
  lossesHT: number;
  winsFT: number;
  drawsFT: number;
  lossesFT: number;
  htScoringRate: number; 
  recoveryRate: number; 
  cleanSheets: number;
  volatility: number; // Standard Deviation of Total Goals
  dominance: number;  // Avg Goal Difference
}

interface PlayerTrend {
  player: string;
  league: string;
  last5: HistoryMatch[];
  stats: PlayerStats;
  trends: {
    type: TrendType;
    confidence: number;
    description: string;
    stats: { label: string; value: string | number }[];
  }[];
}

// --- Helpers ---

const getTrendWeight = (type: TrendType): number => {
  switch (type) {
    case 'STREAK_BREAKER_ACTIVE': return 12;
    case 'STREAK_JUST_BROKEN': return 11;
    case 'MERCILESS': return 10;
    case 'COMEBACK_KING': return 9;
    case 'HT_WIN_FT_FAIL': return 8;
    case 'HT_DOMINATOR': return 7;
    case 'OVER_25_TRAIN': return 6;
    case 'BTTS_TRAIN': return 6;
    case 'GLASS_DEFENSE': return 5;
    case 'LATE_BLOOMER': return 4;
    case 'EARLY_BIRD': return 4;
    case 'SLOW_STARTER': return 3;
    default: return 0;
  }
};

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

const calculateStdDev = (values: number[]): number => {
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const squareDiffs = values.map(v => Math.pow(v - avg, 2));
  const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(avgSquareDiff);
};

const analyzeTrends = (player: string, league: string, matches: HistoryMatch[]): PlayerTrend | null => {
  if (!matches || matches.length < 5) return null;

  const last5 = matches.slice(0, 5);
  const games = last5.map(m => getMatchStats(player, m));

  // --- Calculate Deep Stats ---
  let totalScored = 0;
  let totalConceded = 0;
  let winsHT = 0, drawsHT = 0, lossesHT = 0;
  let winsFT = 0, drawsFT = 0, lossesFT = 0;
  let htGoalsCount = 0; 
  let zeroHtGames = 0;
  let ftGoalsAfterZeroHt = 0;
  let cleanSheets = 0;
  let totalGoalDiff = 0;
  let totalGoals1stHalf = 0;
  let totalGoals2ndHalf = 0;

  const totalGoalsPerGame: number[] = [];

  games.forEach(g => {
    totalScored += g.ftSelf;
    totalConceded += g.ftOpp;
    totalGoalDiff += (g.ftSelf - g.ftOpp);
    totalGoalsPerGame.push(g.totalFT);

    totalGoals1stHalf += g.htSelf;
    totalGoals2ndHalf += (g.ftSelf - g.htSelf);

    if (g.htSelf > g.htOpp) winsHT++;
    else if (g.htSelf === g.htOpp) drawsHT++;
    else lossesHT++;

    if (g.ftSelf > g.ftOpp) winsFT++;
    else if (g.ftSelf === g.ftOpp) drawsFT++;
    else lossesFT++;

    if (g.htSelf > 0) htGoalsCount++;
    else {
      zeroHtGames++;
      ftGoalsAfterZeroHt += g.ftSelf;
    }

    if (g.ftOpp === 0) cleanSheets++;
  });

  const stats: PlayerStats = {
    avgScoredFT: Number((totalScored / 5).toFixed(1)),
    avgConcededFT: Number((totalConceded / 5).toFixed(1)),
    winsHT, drawsHT, lossesHT,
    winsFT, drawsFT, lossesFT,
    htScoringRate: Math.round((htGoalsCount / 5) * 100),
    recoveryRate: zeroHtGames > 0 ? Number((ftGoalsAfterZeroHt / zeroHtGames).toFixed(1)) : 0,
    cleanSheets,
    volatility: Number(calculateStdDev(totalGoalsPerGame).toFixed(2)),
    dominance: Number((totalGoalDiff / 5).toFixed(1))
  };

  const detectedTrends: PlayerTrend['trends'] = [];

  // 1. Streak Breaker
  const recent4 = games.slice(0, 4);
  const game5 = games[4];
  const isStreak4 = recent4.every(g => g.htSelf > 0);
  const isGame5Break = game5.htSelf === 0 && game5.ftSelf > 0;

  if (isStreak4 && isGame5Break) {
    const avgHt = (recent4.reduce((acc, g) => acc + g.htSelf, 0) / 4).toFixed(2);
    detectedTrends.push({
      type: 'STREAK_BREAKER_ACTIVE',
      confidence: 98,
      description: 'Sequência Ativa de HT (4 jogos) após quebra',
      stats: [
        { label: 'Média HT (Seq)', value: avgHt },
        { label: 'Jogo da Quebra', value: `0 HT / ${game5.ftSelf} FT` }
      ]
    });
  }

  // 2. Just Broken
  const game0 = games[0];
  const prev4 = games.slice(1, 5);
  const isPrev4Streak = prev4.every(g => g.htSelf > 0);
  const isGame0Break = game0.htSelf === 0 && game0.ftSelf > 0;

  if (isPrev4Streak && isGame0Break) {
    const avgHt = (prev4.reduce((acc, g) => acc + g.htSelf, 0) / 4).toFixed(2);
    detectedTrends.push({
      type: 'STREAK_JUST_BROKEN',
      confidence: 95,
      description: 'Quebra de Padrão HT no último jogo',
      stats: [
        { label: 'Média HT (Ant)', value: avgHt },
        { label: 'Quebra (Atual)', value: `0 HT / ${game0.ftSelf} FT` }
      ]
    });
  }

  // 3. HT Win / FT Fail
  const htWinFtFailCount = games.filter(g => (g.htSelf > g.htOpp) && (g.ftSelf <= g.ftOpp)).length;
  if (htWinFtFailCount >= 2) {
    detectedTrends.push({
      type: 'HT_WIN_FT_FAIL',
      confidence: htWinFtFailCount >= 3 ? 90 : 75,
      description: 'Vence HT mas tropeça no FT',
      stats: [
        { label: 'Ocorrências', value: `${htWinFtFailCount}/5` },
        { label: 'Risco', value: 'Alto' }
      ]
    });
  }

  // 4. Over 2.5 Train (STRICTER: 5/5 or Avg > 4.0)
  const over25Count = games.filter(g => g.totalFT > 2.5).length;
  const avgGoals = stats.avgScoredFT + stats.avgConcededFT;
  
  if (over25Count === 5 || (over25Count >= 4 && avgGoals >= 4.0)) {
    detectedTrends.push({
      type: 'OVER_25_TRAIN',
      confidence: over25Count === 5 ? 95 : 85,
      description: 'Máquina de Gols (Over 2.5 Consistente)',
      stats: [
        { label: 'Jogos Over', value: `${over25Count}/5` },
        { label: 'Média Total', value: avgGoals.toFixed(1) }
      ]
    });
  }

  // 5. BTTS Train (STRICTER: 5/5 only)
  const bttsCount = games.filter(g => g.isBTTS).length;
  if (bttsCount === 5) {
    detectedTrends.push({
      type: 'BTTS_TRAIN',
      confidence: 95,
      description: 'Ambos Marcam em TODOS os jogos',
      stats: [
        { label: 'BTTS', value: `${bttsCount}/5` }
      ]
    });
  }

  // 6. Slow Starter / Late Bloomer
  const totalGoals = totalGoals1stHalf + totalGoals2ndHalf;
  if (totalGoals > 5 && (totalGoals2ndHalf / totalGoals) >= 0.7) {
     detectedTrends.push({
      type: 'LATE_BLOOMER',
      confidence: 85,
      description: 'Marca 70%+ dos gols no 2º Tempo',
      stats: [
        { label: 'Gols 2ºT', value: totalGoals2ndHalf },
        { label: '% do Total', value: `${Math.round((totalGoals2ndHalf/totalGoals)*100)}%` }
      ]
    });
  } else if (stats.htScoringRate <= 40 && stats.recoveryRate >= 1.5) {
    detectedTrends.push({
      type: 'SLOW_STARTER',
      confidence: 80,
      description: 'Marca pouco no HT, mas recupera bem',
      stats: [
        { label: 'HT Rate', value: `${stats.htScoringRate}%` },
        { label: 'Recuperação', value: stats.recoveryRate }
      ]
    });
  }

  // 7. Early Bird
  if (totalGoals > 5 && (totalGoals1stHalf / totalGoals) >= 0.7) {
    detectedTrends.push({
      type: 'EARLY_BIRD',
      confidence: 85,
      description: 'Marca 70%+ dos gols no 1º Tempo',
      stats: [
        { label: 'Gols 1ºT', value: totalGoals1stHalf },
        { label: '% do Total', value: `${Math.round((totalGoals1stHalf/totalGoals)*100)}%` }
      ]
    });
  } else if (stats.winsHT >= 4) {
    detectedTrends.push({
      type: 'HT_DOMINATOR',
      confidence: 88,
      description: 'Domina o primeiro tempo',
      stats: [
        { label: 'Vitórias HT', value: `${stats.winsHT}/5` }
      ]
    });
  }

  // 8. Glass Defense
  if (stats.avgConcededFT >= 2.5) {
    detectedTrends.push({
      type: 'GLASS_DEFENSE',
      confidence: 85,
      description: 'Defesa frágil (Muitos gols sofridos)',
      stats: [
        { label: 'Média Sofridos', value: stats.avgConcededFT }
      ]
    });
  }

  // 9. Merciless (Wins by 3+ goals in at least 2 games)
  const blowoutWins = games.filter(g => (g.ftSelf - g.ftOpp) >= 3).length;
  if (blowoutWins >= 2) {
      detectedTrends.push({
          type: 'MERCILESS',
          confidence: 90,
          description: 'Goleador Implacável (Vitórias por 3+ gols)',
          stats: [
              { label: 'Goleadas', value: `${blowoutWins}/5` },
              { label: 'Dominância', value: stats.dominance }
          ]
      });
  }

  // 10. Comeback King (Trailing/Draw HT -> Win FT in at least 2 games)
  const comebacks = games.filter(g => g.htSelf <= g.htOpp && g.ftSelf > g.ftOpp).length;
  if (comebacks >= 2) {
      detectedTrends.push({
          type: 'COMEBACK_KING',
          confidence: 92,
          description: 'Rei da Virada (Vence após tropeço no HT)',
          stats: [
              { label: 'Viradas', value: `${comebacks}/5` },
              { label: 'Mental', value: 'Forte' }
          ]
      });
  }

  if (detectedTrends.length === 0) return null;

  detectedTrends.sort((a, b) => {
      const weightA = getTrendWeight(a.type);
      const weightB = getTrendWeight(b.type);
      if (weightA !== weightB) return weightB - weightA;
      return b.confidence - a.confidence;
  });

  return {
    player,
    league,
    last5,
    stats,
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

  // Format date nicely
  const dateStr = new Date(match.data_realizacao).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  return (
    <div className={`group/tooltip relative flex flex-col items-center justify-center p-1 rounded border ${bgColor} min-w-[40px] cursor-help`}>
      <span className={`text-[10px] font-bold ${textColor}`}>{stats.ftSelf}-{stats.ftOpp}</span>
      <span className="text-[8px] text-textMuted/70">HT {stats.htSelf}-{stats.htOpp}</span>

      {/* Tooltip */}
      <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-max max-w-[200px] bg-black/95 text-white text-[10px] p-2 rounded opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none z-50 border border-white/10 shadow-xl backdrop-blur-sm invisible group-hover/tooltip:visible">
          <p className="font-bold text-center mb-1">{match.home_player} <span className="text-textMuted">vs</span> {match.away_player}</p>
          <p className="text-textMuted text-center text-[9px]">{dateStr}</p>
          {/* Arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-black/95"></div>
      </div>
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
      return <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30"><TrendingUp size={10} /> MÁQUINA DE GOLS</span>;
    case 'BTTS_TRAIN':
      return <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30"><Target size={10} /> BTTS 100%</span>;
    case 'SLOW_STARTER':
      return <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30"><Clock size={10} /> DIESEL</span>;
    case 'HT_DOMINATOR':
      return <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"><Activity size={10} /> REI DO HT</span>;
    case 'GLASS_DEFENSE':
      return <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30"><Shield size={10} /> DEFESA VAZADA</span>;
    case 'MERCILESS':
      return <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/30"><Zap size={10} /> IMPLACÁVEL</span>;
    case 'COMEBACK_KING':
      return <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"><RefreshCw size={10} /> REI DA VIRADA</span>;
    case 'LATE_BLOOMER':
      return <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded bg-violet-500/20 text-violet-400 border border-violet-500/30"><Sunset size={10} /> 2º TEMPO FORTE</span>;
    case 'EARLY_BIRD':
      return <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30"><Sunrise size={10} /> INÍCIO AVASSALADOR</span>;
    default:
      return null;
  }
};

const ConfidenceMeter: React.FC<{ confidence: number }> = ({ confidence }) => {
    const stars = Math.round(confidence / 20);
    return (
        <div className="flex gap-0.5" title={`Confiança: ${confidence}%`}>
            {[...Array(5)].map((_, i) => (
                <Star 
                    key={i} 
                    size={10} 
                    className={i < stars ? "fill-accent text-accent" : "fill-white/10 text-white/10"} 
                />
            ))}
        </div>
    );
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
    const limited = players.slice(0, 40); 
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

    // Sort by Weight then Confidence
    out.sort((a, b) => {
        const weightA = getTrendWeight(a.trends[0].type);
        const weightB = getTrendWeight(b.trends[0].type);
        if (weightA !== weightB) return weightB - weightA;
        return b.trends[0].confidence - a.trends[0].confidence;
    });

    setResults(out);
    setLoading(false);
  };

  useEffect(() => {
    if (playersByLeague[league]) loadTrends();
  }, [league, playersByLeague]);

  const topPicks = results.slice(0, 3);
  const otherPicks = results.slice(3);

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-surfaceHighlight/30 p-6 rounded-2xl border border-white/5 backdrop-blur-sm">
        <div>
           <h2 className="text-3xl font-bold text-white flex items-center gap-3">
             <TrendingUp className="text-accent" size={32} />
             Padrões e Tendências
           </h2>
           <p className="text-textMuted mt-1">
             Algoritmo de detecção de padrões de alta assertividade.
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
            <p className="text-textMuted animate-pulse font-medium">Calculando probabilidades e assertividade...</p>
        </div>
      ) : results.length === 0 ? (
        <div className="text-center py-24 text-textMuted bg-surface/30 rounded-2xl border border-white/5 flex flex-col items-center gap-4">
          <XCircle size={48} className="text-white/20" />
          <p>Nenhum padrão de alta confiança encontrado para os jogadores desta liga no momento.</p>
        </div>
      ) : (
        <>
            {/* Top Picks Section */}
            {topPicks.length > 0 && (
                <div className="space-y-4">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <Crown className="text-yellow-400 fill-yellow-400" size={20} />
                        Top Oportunidades
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {topPicks.map(r => (
                            <Card key={r.player} className="group relative hover:border-accent/50 transition-all duration-300 overflow-hidden ring-1 ring-accent/20 bg-surfaceHighlight/10">
                                <div className="absolute top-0 right-0 p-2">
                                    <ConfidenceMeter confidence={r.trends[0].confidence} />
                                </div>
                                <div className="p-5 border-b border-white/5">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <h3 className="text-white font-bold text-xl truncate">{r.player}</h3>
                                            <p className="text-xs text-textMuted font-medium uppercase tracking-wider">Liga {r.league}</p>
                                        </div>
                                    </div>
                                    <div className="mt-2">
                                        <TrendBadge type={r.trends[0].type} />
                                    </div>
                                    <p className="text-sm text-white/80 mt-3 leading-relaxed">
                                        {r.trends[0].description}
                                    </p>
                                </div>
                                <div className="grid grid-cols-3 gap-px bg-white/5 border-b border-white/5">
                                    <div className="bg-surface p-2 flex flex-col items-center justify-center text-center">
                                        <span className="text-[9px] text-textMuted uppercase font-bold">Gols</span>
                                        <span className="text-white font-mono font-bold text-xs">{r.stats.avgScoredFT}</span>
                                    </div>
                                    <div className="bg-surface p-2 flex flex-col items-center justify-center text-center">
                                        <span className="text-[9px] text-textMuted uppercase font-bold">Sofridos</span>
                                        <span className="text-white font-mono font-bold text-xs">{r.stats.avgConcededFT}</span>
                                    </div>
                                    <div className="bg-surface p-2 flex flex-col items-center justify-center text-center">
                                        <span className="text-[9px] text-textMuted uppercase font-bold">Volatilidade</span>
                                        <span className={`font-mono font-bold text-xs ${r.stats.volatility < 1.5 ? 'text-emerald-400' : 'text-orange-400'}`}>{r.stats.volatility}</span>
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-px bg-white/5 border-b border-white/5">
                                    <div className="bg-surface p-2 flex flex-col items-center justify-center text-center">
                                        <span className="text-[9px] text-textMuted uppercase font-bold">Dominância</span>
                                        <span className={`font-mono font-bold text-xs ${r.stats.dominance > 0 ? 'text-emerald-400' : 'text-red-400'}`}>{r.stats.dominance > 0 ? '+' : ''}{r.stats.dominance}</span>
                                    </div>
                                    <div className="bg-surface p-2 flex flex-col items-center justify-center text-center">
                                        <span className="text-[9px] text-textMuted uppercase font-bold">Recorde HT</span>
                                        <span className="text-white font-mono font-bold text-xs">{r.stats.winsHT}-{r.stats.drawsHT}-{r.stats.lossesHT}</span>
                                    </div>
                                    <div className="bg-surface p-2 flex flex-col items-center justify-center text-center">
                                        <span className="text-[9px] text-textMuted uppercase font-bold">Recorde FT</span>
                                        <span className="text-white font-mono font-bold text-xs">{r.stats.winsFT}-{r.stats.drawsFT}-{r.stats.lossesFT}</span>
                                    </div>
                                </div>
                                <div className="p-4 bg-surfaceHighlight/20">
                                    <div className="flex justify-between gap-2">
                                        {[...r.last5].reverse().map((m, i) => (
                                            <MatchMiniature key={i} player={r.player} match={m} />
                                        ))}
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                </div>
            )}

            {/* Other Picks */}
            {otherPicks.length > 0 && (
                <div className="space-y-4">
                     <h3 className="text-lg font-bold text-textMuted flex items-center gap-2">
                        Outras Tendências
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {otherPicks.map(r => {
                        const primaryTrend = r.trends[0];
                        return (
                        <Card key={r.player} className="group hover:border-accent/30 transition-all duration-300 overflow-hidden">
                            <div className="absolute top-0 right-0 p-2 opacity-50 group-hover:opacity-100 transition-opacity">
                                <ConfidenceMeter confidence={primaryTrend.confidence} />
                            </div>
                            <div className="p-5 bg-gradient-to-br from-white/5 to-transparent border-b border-white/5">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                <h3 className="text-white font-bold text-xl truncate group-hover:text-accent transition-colors">{r.player}</h3>
                                <p className="text-xs text-textMuted font-medium uppercase tracking-wider">Liga {r.league}</p>
                                </div>
                            </div>
                            <div className="mt-1">
                                <TrendBadge type={primaryTrend.type} />
                            </div>
                            
                            <p className="text-sm text-white/80 mt-2 leading-relaxed">
                                {primaryTrend.description}
                            </p>
                            </div>

                            <div className="grid grid-cols-3 gap-px bg-white/5 border-b border-white/5">
                                <div className="bg-surface p-2 flex flex-col items-center justify-center text-center">
                                    <span className="text-[9px] text-textMuted uppercase font-bold">Gols</span>
                                    <span className="text-white font-mono font-bold text-xs">{r.stats.avgScoredFT}</span>
                                </div>
                                <div className="bg-surface p-2 flex flex-col items-center justify-center text-center">
                                    <span className="text-[9px] text-textMuted uppercase font-bold">Sofridos</span>
                                    <span className="text-white font-mono font-bold text-xs">{r.stats.avgConcededFT}</span>
                                </div>
                                <div className="bg-surface p-2 flex flex-col items-center justify-center text-center">
                                    <span className="text-[9px] text-textMuted uppercase font-bold">Volatilidade</span>
                                    <span className={`font-mono font-bold text-xs ${r.stats.volatility < 1.5 ? 'text-emerald-400' : 'text-orange-400'}`}>{r.stats.volatility}</span>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-px bg-white/5 border-b border-white/5">
                                <div className="bg-surface p-2 flex flex-col items-center justify-center text-center">
                                    <span className="text-[9px] text-textMuted uppercase font-bold">Dominância</span>
                                    <span className={`font-mono font-bold text-xs ${r.stats.dominance > 0 ? 'text-emerald-400' : 'text-red-400'}`}>{r.stats.dominance > 0 ? '+' : ''}{r.stats.dominance}</span>
                                </div>
                                <div className="bg-surface p-2 flex flex-col items-center justify-center text-center">
                                    <span className="text-[9px] text-textMuted uppercase font-bold">Recorde HT</span>
                                    <span className="text-white font-mono font-bold text-xs">{r.stats.winsHT}-{r.stats.drawsHT}-{r.stats.lossesHT}</span>
                                </div>
                                <div className="bg-surface p-2 flex flex-col items-center justify-center text-center">
                                    <span className="text-[9px] text-textMuted uppercase font-bold">Recorde FT</span>
                                    <span className="text-white font-mono font-bold text-xs">{r.stats.winsFT}-{r.stats.drawsFT}-{r.stats.lossesFT}</span>
                                </div>
                            </div>

                            <div className="p-4 bg-surfaceHighlight/20">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-[10px] text-textMuted uppercase font-bold">Últimos 5 Jogos</span>
                                <span className="text-[10px] text-textMuted">(Mais recente à direita)</span>
                            </div>
                            <div className="flex justify-between gap-2">
                                {[...r.last5].reverse().map((m, i) => (
                                <MatchMiniature key={i} player={r.player} match={m} />
                                ))}
                            </div>
                            </div>
                        </Card>
                        );
                    })}
                    </div>
                </div>
            )}
        </>
      )}
    </div>
  );
};