
import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { fetchHistoryGames, fetchPlayerHistory, fetchH2H } from '../services/api';
import { HistoryMatch } from '../types';
import { TrendingUp, AlertTriangle, CheckCircle2, XCircle, Flame, ShieldAlert, Target, Clock, Activity, Shield, Star, Crown, Zap, RefreshCw, Sunrise, Sunset, Info, X } from 'lucide-react';

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
  recentMatches: HistoryMatch[]; // Store all fetched matches for simulator
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
    recentMatches: matches, // Save all matches
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

const RecordDisplay: React.FC<{ wins: number; draws: number; losses: number }> = ({ wins, draws, losses }) => (
  <div className="flex items-center justify-center gap-0.5 font-mono font-bold text-xs">
    <span className="text-emerald-400">{wins}</span>
    <span className="text-white/40 mx-0.5">-</span>
    <span className="text-yellow-400">{draws}</span>
    <span className="text-white/40 mx-0.5">-</span>
    <span className="text-red-400">{losses}</span>
  </div>
);

const MetricsGuideModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-surface border border-white/10 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl relative">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-textMuted hover:text-white transition-colors"
        >
          <X size={24} />
        </button>
        
        <div className="p-8">
          <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
            <Info className="text-accent" />
            Guia de Métricas e Tendências
          </h2>
          <p className="text-textMuted mb-8">Entenda como nossos algoritmos analisam os jogos.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Estatísticas Base */}
            <div className="space-y-6">
              <h3 className="text-lg font-bold text-white border-b border-white/10 pb-2">Glossário de Estatísticas</h3>
              
              <div className="space-y-4">
                <div className="bg-surfaceHighlight/10 p-4 rounded-xl border border-white/5">
                  <div className="grid grid-cols-2 gap-4 mb-3">
                      <div>
                          <span className="text-[10px] text-textMuted uppercase font-bold block">Gols</span>
                          <p className="text-xs text-white">Média de gols marcados por jogo (FT).</p>
                      </div>
                      <div>
                          <span className="text-[10px] text-textMuted uppercase font-bold block">Sofridos</span>
                          <p className="text-xs text-white">Média de gols sofridos por jogo (FT).</p>
                      </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                      <div>
                          <span className="text-[10px] text-textMuted uppercase font-bold block">Recorde HT</span>
                          <p className="text-xs text-white">
                            <span className="text-emerald-400 font-bold">V</span> - 
                            <span className="text-yellow-400 font-bold"> E</span> - 
                            <span className="text-red-400 font-bold"> D</span> (1º Tempo)
                          </p>
                      </div>
                      <div>
                          <span className="text-[10px] text-textMuted uppercase font-bold block">Recorde FT</span>
                          <p className="text-xs text-white">
                            <span className="text-emerald-400 font-bold">V</span> - 
                            <span className="text-yellow-400 font-bold"> E</span> - 
                            <span className="text-red-400 font-bold"> D</span> (Final)
                          </p>
                      </div>
                  </div>
                </div>

                <div className="bg-surfaceHighlight/10 p-4 rounded-xl border border-white/5">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="text-emerald-400" size={18} />
                    <span className="font-bold text-white">Dominância</span>
                  </div>
                  <p className="text-sm text-textMuted leading-relaxed">
                    Média do saldo de gols nos últimos 5 jogos. Valores positivos indicam que o time costuma vencer com margem (ataque forte/defesa sólida). Valores negativos indicam fragilidade.
                  </p>
                </div>

                <div className="bg-surfaceHighlight/10 p-4 rounded-xl border border-white/5">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="text-orange-400" size={18} />
                    <span className="font-bold text-white">Volatilidade</span>
                  </div>
                  <p className="text-sm text-textMuted leading-relaxed">
                    Mede a instabilidade dos placares (Desvio Padrão). 
                    <br/>
                    <span className="text-emerald-400 font-bold">Baixa (&lt; 1.5):</span> Jogos consistentes, placares previsíveis.
                    <br/>
                    <span className="text-orange-400 font-bold">Alta (&gt; 1.5):</span> Jogos loucos, goleadas ou zebras frequentes.
                  </p>
                </div>

                <div className="bg-surfaceHighlight/10 p-4 rounded-xl border border-white/5">
                  <div className="flex items-center gap-2 mb-2">
                    <Star className="text-yellow-400" size={18} />
                    <span className="font-bold text-white">Confiança (Estrelas)</span>
                  </div>
                  <p className="text-sm text-textMuted leading-relaxed">
                    Calculada com base na consistência do padrão (5/5 jogos = 95%+) e no peso do padrão (Padrões raros valem mais).
                  </p>
                </div>
              </div>
            </div>

            {/* Padrões de Tendência */}
            <div className="space-y-6">
              <h3 className="text-lg font-bold text-white border-b border-white/10 pb-2">Padrões Identificados</h3>
              
              <div className="grid grid-cols-1 gap-3">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-white/5">
                  <Flame className="text-emerald-400 shrink-0 mt-1" size={16} />
                  <div>
                    <span className="font-bold text-white text-sm block">Sequência Ativa</span>
                    <p className="text-xs text-textMuted">Jogador vem de uma sequência de 4 jogos com gols no HT e acabou de quebrar (0 HT). Tendência forte de voltar a marcar HT.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-white/5">
                  <Zap className="text-fuchsia-400 shrink-0 mt-1" size={16} />
                  <div>
                    <span className="font-bold text-white text-sm block">Implacável (Merciless)</span>
                    <p className="text-xs text-textMuted">Venceu 2 ou mais jogos por 3+ gols de diferença. Time que não tira o pé.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-white/5">
                  <RefreshCw className="text-cyan-400 shrink-0 mt-1" size={16} />
                  <div>
                    <span className="font-bold text-white text-sm block">Rei da Virada (Comeback King)</span>
                    <p className="text-xs text-textMuted">Costuma sair perdendo ou empatando no HT e vira o jogo no FT.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-white/5">
                  <TrendingUp className="text-blue-400 shrink-0 mt-1" size={16} />
                  <div>
                    <span className="font-bold text-white text-sm block">Máquina de Gols</span>
                    <p className="text-xs text-textMuted">5/5 jogos com Over 2.5 Gols ou média de gols extremamente alta.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-white/5">
                  <ShieldAlert className="text-orange-400 shrink-0 mt-1" size={16} />
                  <div>
                    <span className="font-bold text-white text-sm block">Perigo 2º Tempo</span>
                    <p className="text-xs text-textMuted">Vence o 1º tempo mas cede o empate ou virada no final.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-white/5">
                  <Clock className="text-indigo-400 shrink-0 mt-1" size={16} />
                  <div>
                    <span className="font-bold text-white text-sm block">Diesel / Late Bloomer</span>
                    <p className="text-xs text-textMuted">Marca a grande maioria dos gols apenas no 2º tempo.</p>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

const CompactTableView: React.FC<{ data: PlayerTrend[] }> = ({ data }) => {
  return (
    <div className="overflow-x-auto rounded-xl border border-white/5 bg-surfaceHighlight/10">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-white/5 text-textMuted text-[10px] uppercase tracking-wider border-b border-white/10">
            <th className="p-3 font-bold">Jogador / Liga</th>
            <th className="p-3 font-bold">Tendência Principal</th>
            <th className="p-3 font-bold text-center">Confiança</th>
            <th className="p-3 font-bold text-center">Gols (M)</th>
            <th className="p-3 font-bold text-center">Sofridos (M)</th>
            <th className="p-3 font-bold text-center">Volatilidade</th>
            <th className="p-3 font-bold text-center">Dominância</th>
            <th className="p-3 font-bold text-right">Últimos 5</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {data.map((r, idx) => (
            <tr key={`${r.player}-${idx}`} className="hover:bg-white/5 transition-colors group">
              <td className="p-3">
                <div className="flex flex-col">
                  <span className="font-bold text-white text-sm group-hover:text-accent transition-colors">{r.player}</span>
                  <span className="text-[10px] text-textMuted">Liga {r.league}</span>
                </div>
              </td>
              <td className="p-3">
                <div className="flex flex-col gap-1">
                    <TrendBadge type={r.trends[0].type} />
                    <span className="text-[10px] text-textMuted truncate max-w-[200px]">{r.trends[0].description}</span>
                </div>
              </td>
              <td className="p-3 text-center">
                <div className="flex justify-center">
                    <ConfidenceMeter confidence={r.trends[0].confidence} />
                </div>
              </td>
              <td className="p-3 text-center font-mono text-xs text-white">
                {r.stats.avgScoredFT}
              </td>
              <td className="p-3 text-center font-mono text-xs text-white">
                {r.stats.avgConcededFT}
              </td>
              <td className="p-3 text-center">
                 <span className={`font-mono text-xs font-bold ${r.stats.volatility < 1.5 ? 'text-emerald-400' : 'text-orange-400'}`}>
                    {r.stats.volatility}
                 </span>
              </td>
              <td className="p-3 text-center">
                <span className={`font-mono text-xs font-bold ${r.stats.dominance > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {r.stats.dominance > 0 ? '+' : ''}{r.stats.dominance}
                </span>
              </td>
              <td className="p-3">
                <div className="flex justify-end gap-1">
                    {[...r.last5].reverse().map((m, i) => {
                         const stats = getMatchStats(r.player, m);
                         const isWin = stats.ftSelf > stats.ftOpp;
                         const isDraw = stats.ftSelf === stats.ftOpp;
                         const color = isWin ? 'bg-emerald-500' : isDraw ? 'bg-gray-500' : 'bg-red-500';
                         return (
                             <div key={i} className={`w-1.5 h-4 rounded-sm ${color} opacity-80`} title={`${stats.ftSelf}-${stats.ftOpp}`} />
                         );
                    })}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};



const ConceptGuide: React.FC = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
      <div className="bg-surfaceHighlight/10 p-4 rounded-xl border border-white/5 flex items-start gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 mt-1">
              <Activity size={20} />
          </div>
          <div>
              <h4 className="text-white font-bold text-sm mb-1">Dominância (Saldo de Gols)</h4>
              <p className="text-xs text-textMuted leading-relaxed">
                  Indica a força do jogador. <br/>
                  <span className="text-emerald-400 font-bold">Positiva (+):</span> Marca mais que sofre (Ataque forte/Defesa sólida). <br/>
                  <span className="text-red-400 font-bold">Negativa (-):</span> Sofre mais que marca (Defesa frágil).
              </p>
          </div>
      </div>
      <div className="bg-surfaceHighlight/10 p-4 rounded-xl border border-white/5 flex items-start gap-3">
          <div className="p-2 rounded-lg bg-orange-500/10 text-orange-400 mt-1">
              <Activity size={20} />
          </div>
          <div>
              <h4 className="text-white font-bold text-sm mb-1">Volatilidade (Instabilidade)</h4>
              <p className="text-xs text-textMuted leading-relaxed">
                  Mede a loucura dos jogos. <br/>
                  <span className="text-emerald-400 font-bold">Baixa (&lt; 1.5):</span> Jogos consistentes, placares "normais". <br/>
                  <span className="text-orange-400 font-bold">Alta (&gt; 1.5):</span> Jogos imprevisíveis, goleadas, zebras.
              </p>
          </div>
      </div>
  </div>
);

const BacktestModal: React.FC<{ 
    isOpen: boolean; 
    onClose: () => void;
    leagues: string[];
    playersByLeague: Record<string, Set<string>>;
    playerIds: Record<string, number>;
}> = ({ isOpen, onClose, leagues, playersByLeague, playerIds }) => {
    const [mode, setMode] = useState<'INDIVIDUAL' | 'H2H'>('INDIVIDUAL');
    const [league, setLeague] = useState<string>('');
    const [playerA, setPlayerA] = useState<string>('');
    const [playerB, setPlayerB] = useState<string>('');
    
    const [stake, setStake] = useState(250);
    const [odd, setOdd] = useState(1.70);
    const [gamesCount, setGamesCount] = useState(10);
    
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<any[]>([]);
    const [matchCount, setMatchCount] = useState(0);

    // Reset selection when league changes
    useEffect(() => {
        setPlayerA('');
        setPlayerB('');
    }, [league]);

    // Set default league
    useEffect(() => {
        if (isOpen && leagues.length > 0 && !league) {
            setLeague(leagues[0]);
        }
    }, [isOpen, leagues]);

    const availablePlayers = useMemo(() => {
        if (!league || !playersByLeague[league]) return [];
        return Array.from(playersByLeague[league]).sort();
    }, [league, playersByLeague]);

    const runSimulation = async () => {
        if (!league || !playerA) return;
        if (mode === 'H2H' && !playerB) return;

        setLoading(true);
        setResults([]);
        
        try {
            let matches: HistoryMatch[] = [];

            if (mode === 'INDIVIDUAL') {
                const pid = playerIds[playerA];
                matches = await fetchPlayerHistory(playerA, gamesCount, pid);
            } else {
                const h2hData = await fetchH2H(playerA, playerB, league);
                if (h2hData && h2hData.matches) {
                    // Map H2H matches to HistoryMatch (adding missing league_name)
                    matches = h2hData.matches.map(m => ({
                        ...m,
                        league_name: league,
                        home_id: undefined,
                        away_id: undefined
                    }));
                    
                    // Limit if needed
                    matches = matches.slice(0, gamesCount);
                }
            }

            setMatchCount(matches.length);

            setMatchCount(matches.length);

            let markets: any[] = [];

            if (mode === 'INDIVIDUAL') {
                // INDIVIDUAL MODE: Metrics based on PLAYER GOALS only
                markets = [
                    { 
                        id: 'ind_ht_over05', 
                        label: 'HT Over 0.5 (Player)', 
                        check: (m: any) => {
                            const isHome = m.home_player === playerA || (m.home_player && m.home_player.includes(playerA));
                            const goals = isHome ? m.halftime_score_home : m.halftime_score_away;
                            return goals > 0.5;
                        } 
                    },
                    { 
                        id: 'ind_ht_over15', 
                        label: 'HT Over 1.5 (Player)', 
                        check: (m: any) => {
                            const isHome = m.home_player === playerA || (m.home_player && m.home_player.includes(playerA));
                            const goals = isHome ? m.halftime_score_home : m.halftime_score_away;
                            return goals > 1.5;
                        } 
                    },
                    { 
                        id: 'ind_ft_over05', 
                        label: 'FT Over 0.5 (Player)', 
                        check: (m: any) => {
                            const isHome = m.home_player === playerA || (m.home_player && m.home_player.includes(playerA));
                            const goals = isHome ? m.score_home : m.score_away;
                            return goals > 0.5;
                        } 
                    },
                    { 
                        id: 'ind_ft_over15', 
                        label: 'FT Over 1.5 (Player)', 
                        check: (m: any) => {
                            const isHome = m.home_player === playerA || (m.home_player && m.home_player.includes(playerA));
                            const goals = isHome ? m.score_home : m.score_away;
                            return goals > 1.5;
                        } 
                    },
                    { 
                        id: 'ind_ft_over25', 
                        label: 'FT Over 2.5 (Player)', 
                        check: (m: any) => {
                            const isHome = m.home_player === playerA || (m.home_player && m.home_player.includes(playerA));
                            const goals = isHome ? m.score_home : m.score_away;
                            return goals > 2.5;
                        } 
                    },
                    { 
                        id: 'ind_win', 
                        label: 'Vitória (Player)', 
                        check: (m: any) => {
                            const isHome = m.home_player === playerA || (m.home_player && m.home_player.includes(playerA));
                            if (isHome) return m.score_home > m.score_away;
                            return m.score_away > m.score_home;
                        } 
                    }
                ];
            } else {
                // H2H MODE: Metrics based on TOTAL GOALS (Sum) + Win Rates
                markets = [
                    { id: 'h2h_ht_over05', label: 'HT Over 0.5 (Total)', check: (m: any) => (m.halftime_score_home + m.halftime_score_away) > 0.5 },
                    { id: 'h2h_ht_over15', label: 'HT Over 1.5 (Total)', check: (m: any) => (m.halftime_score_home + m.halftime_score_away) > 1.5 },
                    { id: 'h2h_ht_btts', label: 'HT BTTS', check: (m: any) => m.halftime_score_home > 0 && m.halftime_score_away > 0 },
                    
                    { id: 'h2h_ft_over15', label: 'FT Over 1.5 (Total)', check: (m: any) => (m.score_home + m.score_away) > 1.5 },
                    { id: 'h2h_ft_over25', label: 'FT Over 2.5 (Total)', check: (m: any) => (m.score_home + m.score_away) > 2.5 },
                    { id: 'h2h_ft_over35', label: 'FT Over 3.5 (Total)', check: (m: any) => (m.score_home + m.score_away) > 3.5 },
                    { id: 'h2h_ft_btts', label: 'FT BTTS', check: (m: any) => m.score_home > 0 && m.score_away > 0 },

                    { 
                        id: 'h2h_win_p1', 
                        label: `Vitória ${playerA}`, 
                        check: (m: any) => {
                            // Identify P1 side
                            const isHome = m.home_player === playerA || (m.home_player && m.home_player.includes(playerA));
                            if (isHome) return m.score_home > m.score_away;
                            return m.score_away > m.score_home;
                        } 
                    },
                    { 
                        id: 'h2h_win_p2', 
                        label: `Vitória ${playerB}`, 
                        check: (m: any) => {
                            // Identify P2 side
                            const isHome = m.home_player === playerB || (m.home_player && m.home_player.includes(playerB));
                            if (isHome) return m.score_home > m.score_away;
                            return m.score_away > m.score_home;
                        } 
                    }
                ];
            }

            const calculated = markets.map(market => {
                let wins = 0;
                let losses = 0;
                let totalBets = 0;

                matches.forEach(match => {
                    totalBets++;
                    if (market.check(match)) {
                        wins++;
                    } else {
                        losses++;
                    }
                });

                const profit = (wins * stake * (odd - 1)) - (losses * stake);
                const roi = totalBets > 0 ? (profit / (totalBets * stake)) * 100 : 0;
                const units = profit / stake;
                const winRate = totalBets > 0 ? (wins / totalBets) * 100 : 0;

                return { ...market, wins, losses, totalBets, profit, roi, units, winRate };
            }).sort((a, b) => b.profit - a.profit);

            setResults(calculated);

        } catch (e) {
            console.error("Simulation Error:", e);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-surface border border-white/10 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl relative flex flex-col">
                <button 
                    onClick={onClose}
                    className="absolute top-4 right-4 text-textMuted hover:text-white transition-colors z-10"
                >
                    <X size={24} />
                </button>

                <div className="p-6 border-b border-white/5">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Target className="text-accent" />
                        Simulador de Backtest
                    </h2>
                    <p className="text-textMuted text-sm">Simule lucros baseados em histórico real.</p>
                </div>

                <div className="p-6 space-y-6 overflow-y-auto">
                    {/* Controls */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-textMuted uppercase block mb-2">Modo</label>
                                <div className="flex bg-black/20 p-1 rounded-lg">
                                    <button 
                                        onClick={() => setMode('INDIVIDUAL')}
                                        className={`flex-1 py-2 text-sm font-bold rounded-md transition-colors ${mode === 'INDIVIDUAL' ? 'bg-accent text-surface' : 'text-textMuted hover:text-white'}`}
                                    >
                                        Individual
                                    </button>
                                    <button 
                                        onClick={() => setMode('H2H')}
                                        className={`flex-1 py-2 text-sm font-bold rounded-md transition-colors ${mode === 'H2H' ? 'bg-accent text-surface' : 'text-textMuted hover:text-white'}`}
                                    >
                                        Head-to-Head
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-textMuted uppercase block mb-1">Liga</label>
                                <select 
                                    value={league}
                                    onChange={(e) => setLeague(e.target.value)}
                                    className="w-full bg-surfaceHighlight/10 text-white border border-white/10 rounded-lg px-3 py-2 outline-none focus:border-accent"
                                >
                                    {leagues.map(l => <option key={l} value={l}>{l}</option>)}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-xs font-bold text-textMuted uppercase block mb-1">Jogador A</label>
                                    <select 
                                        value={playerA}
                                        onChange={(e) => setPlayerA(e.target.value)}
                                        className="w-full bg-surfaceHighlight/10 text-white border border-white/10 rounded-lg px-3 py-2 outline-none focus:border-accent"
                                    >
                                        <option value="">Selecione...</option>
                                        {availablePlayers.map(p => <option key={p} value={p}>{p}</option>)}
                                    </select>
                                </div>
                                {mode === 'H2H' && (
                                    <div>
                                        <label className="text-xs font-bold text-textMuted uppercase block mb-1">Jogador B</label>
                                        <select 
                                            value={playerB}
                                            onChange={(e) => setPlayerB(e.target.value)}
                                            className="w-full bg-surfaceHighlight/10 text-white border border-white/10 rounded-lg px-3 py-2 outline-none focus:border-accent"
                                        >
                                            <option value="">Selecione...</option>
                                            {availablePlayers.filter(p => p !== playerA).map(p => <option key={p} value={p}>{p}</option>)}
                                        </select>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="grid grid-cols-3 gap-2">
                                <div>
                                    <label className="text-xs font-bold text-textMuted uppercase block mb-1">Stake (R$)</label>
                                    <input 
                                        type="number" 
                                        value={stake}
                                        onChange={(e) => setStake(Number(e.target.value))}
                                        className="w-full bg-surfaceHighlight/10 text-white border border-white/10 rounded-lg px-3 py-2 outline-none focus:border-accent font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-textMuted uppercase block mb-1">Odd Média</label>
                                    <input 
                                        type="number" 
                                        step="0.01"
                                        value={odd}
                                        onChange={(e) => setOdd(Number(e.target.value))}
                                        className="w-full bg-surfaceHighlight/10 text-white border border-white/10 rounded-lg px-3 py-2 outline-none focus:border-accent font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-textMuted uppercase block mb-1">Jogos</label>
                                    <select 
                                        value={gamesCount}
                                        onChange={(e) => setGamesCount(Number(e.target.value))}
                                        className="w-full bg-surfaceHighlight/10 text-white border border-white/10 rounded-lg px-3 py-2 outline-none focus:border-accent"
                                    >
                                        <option value={5}>5</option>
                                        <option value={10}>10</option>
                                        <option value={20}>20</option>
                                        <option value={50}>50</option>
                                    </select>
                                </div>
                            </div>

                            <button 
                                onClick={runSimulation}
                                disabled={loading || !playerA || (mode === 'H2H' && !playerB)}
                                className="w-full py-3 bg-accent text-surface font-bold rounded-lg hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {loading ? <RefreshCw className="animate-spin" /> : <Target />}
                                Simular Backtest
                            </button>
                        </div>
                    </div>

                    {/* Results */}
                    {results.length > 0 && (
                        <div className="animate-fade-in">
                            <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                                Resultados 
                                <span className="text-xs font-normal text-textMuted bg-white/10 px-2 py-0.5 rounded-full">
                                    Baseado em {matchCount} jogos
                                </span>
                            </h3>
                            <div className="overflow-x-auto rounded-xl border border-white/5 bg-surfaceHighlight/5">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="text-[10px] text-textMuted uppercase border-b border-white/10 bg-white/5">
                                            <th className="p-3">Mercado</th>
                                            <th className="p-3 text-center">Win Rate</th>
                                            <th className="p-3 text-center">ROI</th>
                                            <th className="p-3 text-center">Lucro (R$)</th>
                                            <th className="p-3 text-center">Unidades</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {results.map(m => (
                                            <tr key={m.id} className="hover:bg-white/5">
                                                <td className="p-3 font-bold text-sm text-white">{m.label}</td>
                                                <td className="p-3 text-center">
                                                    <Badge value={m.winRate} />
                                                </td>
                                                <td className="p-3 text-center">
                                                    <span className={`font-bold ${m.roi > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                        {m.roi.toFixed(2)}%
                                                    </span>
                                                </td>
                                                <td className="p-3 text-center font-mono font-bold">
                                                    <span className={m.profit > 0 ? 'text-emerald-400' : 'text-red-400'}>
                                                        R$ {m.profit.toFixed(2)}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-center font-mono">
                                                    <span className={`px-2 py-1 rounded text-xs font-bold ${m.units > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                                                        {m.units > 0 ? '+' : ''}{m.units.toFixed(2)}u
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export const Tendencias: React.FC = () => {
  const [league, setLeague] = useState<string>('A');
  const [availableLeagues, setAvailableLeagues] = useState<string[]>([]);
  const [playersByLeague, setPlayersByLeague] = useState<Record<string, Set<string>>>({});
  const [playerIds, setPlayerIds] = useState<Record<string, number>>({});
  const [results, setResults] = useState<PlayerTrend[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [progress, setProgress] = useState<string>('');
  const [showMetricsGuide, setShowMetricsGuide] = useState(false);
  const [showBacktest, setShowBacktest] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [nextUpdateTimer, setNextUpdateTimer] = useState<number>(120);

  useEffect(() => {
    const bootstrap = async () => {
      const history = await fetchHistoryGames();
      const leagues = Array.from(new Set(history.map(h => h.league_name))).sort();
      setAvailableLeagues(leagues);
      
      const map: Record<string, Set<string>> = {};
      const ids: Record<string, number> = {};
      
      history.forEach(h => {
        const ln = h.league_name || 'Desconhecida';
        if (!map[ln]) map[ln] = new Set<string>();
        map[ln].add(h.home_player);
        map[ln].add(h.away_player);
        
        // Capture IDs if available
        if (h.home_id) ids[h.home_player] = h.home_id;
        if (h.away_id) ids[h.away_player] = h.away_id;
      });
      setPlayersByLeague(map);
      setPlayerIds(ids);

      if (leagues.length > 0 && (!leagues.includes(league) || league === 'A')) {
         if (leagues.includes('A')) setLeague('A');
         else setLeague(leagues[0]);
      }
    };
    bootstrap();
  }, []);

  // Auto-Refresh Timer
  useEffect(() => {
    const timer = setInterval(() => {
      setNextUpdateTimer(prev => {
        if (prev <= 1) return 120;
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Trigger Refresh
  useEffect(() => {
    if (nextUpdateTimer === 120) {
        loadTrends();
    }
  }, [nextUpdateTimer]);

  const loadTrends = async () => {
    console.log("Starting loadTrends for league:", league);
    let playerSet: Set<string>;
    
    if (league === 'TODAS') {
        playerSet = new Set<string>();
        const leagues = Object.keys(playersByLeague);
        console.log("Aggregating leagues:", leagues);
        leagues.forEach(l => {
            const pSet = playersByLeague[l];
            if (pSet) {
                pSet.forEach(p => playerSet.add(p));
            }
        });
    } else {
        playerSet = playersByLeague[league] ?? new Set<string>();
    }

    const players: string[] = Array.from(playerSet);
    console.log(`Found ${players.length} players for analysis.`);
    
    // Increase limit for Global view to catch more top trends
    const limit = league === 'TODAS' ? 150 : 40; 
    const limited = players.slice(0, limit); 
    
    setLoading(true);
    setProgress(`Iniciando análise de ${limited.length} jogadores...`);
    setLastUpdate(new Date());
    
    const out: PlayerTrend[] = [];
    const CONCURRENCY = 8;
    
    for (let i = 0; i < limited.length; i += CONCURRENCY) {
      setProgress(`Analisando ${i} de ${limited.length}...`);
      const batch: string[] = limited.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.all(batch.map(async (p: string) => {
        try {
            const pid = playerIds[p]; // Get ID if available
            const matches = await fetchPlayerHistory(p, 20, pid); // Fetch 20 games for simulator
            return analyzeTrends(p, league === 'TODAS' ? 'Global' : league, matches);
        } catch (e) {
            console.error(`Error analyzing player ${p}:`, e);
            return null;
        }
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
           <div className="flex gap-4 mt-3">
                <button 
                    onClick={() => setShowMetricsGuide(true)}
                    className="text-xs flex items-center gap-1 text-accent hover:text-white transition-colors font-medium"
                >
                    <Info size={14} />
                    Entenda as métricas
                </button>
                <button 
                    onClick={() => setShowBacktest(true)}
                    className="text-xs flex items-center gap-1 text-emerald-400 hover:text-white transition-colors font-bold"
                >
                    <Target size={14} />
                    Simulador Backtest
                </button>
           </div>
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
            <option value="TODAS" className="bg-surface text-textMain font-bold">TODAS AS LIGAS</option>
          </select>
          
          <div className="flex items-center gap-2 px-3 py-2 bg-black/20 rounded-lg border border-white/5">
            <div className="flex flex-col items-end">
                <span className="text-[10px] text-textMuted leading-none">Atualiza em</span>
                <span className="text-xs font-mono font-bold text-accent leading-none">{nextUpdateTimer}s</span>
            </div>
            <RefreshCw size={14} className={`text-accent ${loading ? 'animate-spin' : ''}`} />
          </div>

          <button
            onClick={loadTrends}
            className="px-4 py-2 bg-accent text-surface rounded-lg text-sm font-bold hover:brightness-110 transition-all shadow-lg shadow-accent/20"
          >
            Atualizar Análise
          </button>
        </div>
      </div>

      <ConceptGuide />

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-6">
            <div className="relative">
                <div className="w-16 h-16 border-4 border-surfaceHighlight rounded-full"></div>
                <div className="w-16 h-16 border-4 border-accent border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
            </div>
            <div className="text-center">
                <p className="text-textMuted animate-pulse font-medium">Calculando probabilidades e assertividade...</p>
                <p className="text-xs text-textMuted mt-2 font-mono">{progress}</p>
            </div>
        </div>
      ) : results.length === 0 ? (
        <div className="text-center py-24 text-textMuted bg-surface/30 rounded-2xl border border-white/5 flex flex-col items-center gap-4">
          <XCircle size={48} className="text-white/20" />
          <p>Nenhum padrão de alta confiança encontrado para os jogadores desta liga no momento.</p>
        </div>
      ) : league === 'TODAS' ? (
        <CompactTableView data={results} />
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
                                        <RecordDisplay wins={r.stats.winsHT} draws={r.stats.drawsHT} losses={r.stats.lossesHT} />
                                    </div>
                                    <div className="bg-surface p-2 flex flex-col items-center justify-center text-center">
                                        <span className="text-[9px] text-textMuted uppercase font-bold">Recorde FT</span>
                                        <RecordDisplay wins={r.stats.winsFT} draws={r.stats.drawsFT} losses={r.stats.lossesFT} />
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
                                    <RecordDisplay wins={r.stats.winsHT} draws={r.stats.drawsHT} losses={r.stats.lossesHT} />
                                </div>
                                <div className="bg-surface p-2 flex flex-col items-center justify-center text-center">
                                    <span className="text-[9px] text-textMuted uppercase font-bold">Recorde FT</span>
                                    <RecordDisplay wins={r.stats.winsFT} draws={r.stats.drawsFT} losses={r.stats.lossesFT} />
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
      
      <MetricsGuideModal isOpen={showMetricsGuide} onClose={() => setShowMetricsGuide(false)} />
      <BacktestModal 
        isOpen={showBacktest} 
        onClose={() => setShowBacktest(false)} 
        leagues={availableLeagues}
        playersByLeague={playersByLeague}
        playerIds={playerIds}
      />
    </div>
  );
};