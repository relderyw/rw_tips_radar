
import { Game, ProcessedGame, PlayerMetrics, H2HMatch, HistoryMatch, HistoryPlayerStats, LeagueStats, Projection } from '../types';

export const processRawGames = (games: Game[]): ProcessedGame[] => {
  return games.map(game => {
    const scoreHTHome = Number((game as any).scoreHT?.home ?? (game as any).halftime_score_home ?? 0);
    const scoreHTAway = Number((game as any).scoreHT?.away ?? (game as any).halftime_score_away ?? 0);
    const date = game.start_at || (game as any).startTime || (game as any).date;

    return {
      id: game.id,
      league: game.competition.name,
      date: date,
      homePlayer: game.home.name,
      awayPlayer: game.away.name,
      homeTeam: game.home.team_name,
      awayTeam: game.away.team_name,
      scoreHome: Number(game.score.home),
      scoreAway: Number(game.score.away),
      scoreHTHome,
      scoreHTAway,
      totalGoals: Number(game.score.home) + Number(game.score.away),
      totalGoalsHT: scoreHTHome + scoreHTAway,
      isBTTS: game.score.home > 0 && game.score.away > 0,
      isBTTS_HT: scoreHTHome > 0 && scoreHTAway > 0,
    };
  });
};

export const calculatePlayerMetrics = (games: ProcessedGame[], player: string, windowSize: number = 10): PlayerMetrics | null => {
  const playerGames = games.filter(g => g.homePlayer === player || g.awayPlayer === player);
  const recent = playerGames.slice(0, windowSize);
  
  if (recent.length === 0) return null;

  const league = recent[0].league; 

  let htOver05 = 0;
  let htOver15 = 0;
  let htOver25 = 0;
  let htBtts = 0;
  
  let ftOver05 = 0;
  let ftOver15 = 0;
  let ftOver25 = 0;
  let ftOver35 = 0;
  let ftBtts = 0;
  
  let totalGoalsHT = 0;
  let totalGoalsFT = 0;
  let wins = 0;

  recent.forEach(g => {
    totalGoalsHT += g.totalGoalsHT;
    totalGoalsFT += g.totalGoals;

    if (g.totalGoalsHT > 0.5) htOver05++;
    if (g.totalGoalsHT > 1.5) htOver15++;
    if (g.totalGoalsHT > 2.5) htOver25++;
    if (g.isBTTS_HT) htBtts++;

    if (g.totalGoals > 0.5) ftOver05++;
    if (g.totalGoals > 1.5) ftOver15++;
    if (g.totalGoals > 2.5) ftOver25++;
    if (g.totalGoals > 3.5) ftOver35++;
    if (g.isBTTS) ftBtts++;
    
    const isHome = g.homePlayer === player;
    const myScore = isHome ? g.scoreHome : g.scoreAway;
    const opScore = isHome ? g.scoreAway : g.scoreHome;
    if (myScore > opScore) wins++;
  });

  const toPct = (val: number) => Math.round((val / recent.length) * 100);

  return {
    player,
    league,
    games: recent.length,
    htOver05,
    htOver15,
    htOver25,
    htBtts,
    ftOver05,
    ftOver15,
    ftOver25,
    ftOver35,
    ftBtts,
    wins,
    avgGoalsHT: parseFloat((totalGoalsHT / recent.length).toFixed(2)),
    avgGoalsFT: parseFloat((totalGoalsFT / recent.length).toFixed(2)),
    htOver05Pct: toPct(htOver05),
    htOver15Pct: toPct(htOver15),
    htOver25Pct: toPct(htOver25),
    htBttsPct: toPct(htBtts),
    ftOver05Pct: toPct(ftOver05),
    ftOver15Pct: toPct(ftOver15),
    ftOver25Pct: toPct(ftOver25),
    ftOver35Pct: toPct(ftOver35),
    ftBttsPct: toPct(ftBtts),
    winPct: toPct(wins),
  };
};

export const calculateH2HStats = (matches: H2HMatch[], player1: string, player2: string) => {
    const total = matches.length;
    
    // Initialize counters
    let p1Wins = 0;
    let p2Wins = 0;
    let draws = 0;
    
    let htOver05 = 0;
    let htOver15 = 0;
    let htBtts = 0;
    let totalGoalsHT = 0;
    
    let ftOver15 = 0;
    let ftOver25 = 0;
    let ftOver35 = 0;
    let ftBtts = 0;
    let totalGoalsFT = 0;

    if (total === 0) {
        return {
            total: 0, p1Wins: 0, p2Wins: 0, draws: 0,
            player1_win_percentage: 0, player2_win_percentage: 0, draw_percentage: 0,
            avgGoals: 0, avgGoalsHT: 0,
            ht: { over05Pct: 0, over15Pct: 0, bttsPct: 0 },
            ft: { over15Pct: 0, over25Pct: 0, over35Pct: 0, bttsPct: 0 }
        };
    }

    matches.forEach(m => {
        const sHome = Number(m.score_home);
        const sAway = Number(m.score_away);
        const htHome = Number(m.halftime_score_home ?? 0);
        const htAway = Number(m.halftime_score_away ?? 0);

        // 1. Winner Logic
        const isP1Home = m.home_player === player1;
        const p1Score = isP1Home ? sHome : sAway;
        const p2Score = isP1Home ? sAway : sHome;

        if (p1Score > p2Score) p1Wins++;
        else if (p2Score > p1Score) p2Wins++;
        else draws++;

        // 2. Goals Logic (Match Totals)
        const totalHT = htHome + htAway;
        const totalFT = sHome + sAway;
        
        totalGoalsHT += totalHT;
        totalGoalsFT += totalFT;

        // 3. Markets
        if (totalHT > 0.5) htOver05++;
        if (totalHT > 1.5) htOver15++;
        if (htHome > 0 && htAway > 0) htBtts++;

        if (totalFT > 1.5) ftOver15++;
        if (totalFT > 2.5) ftOver25++;
        if (totalFT > 3.5) ftOver35++;
        if (sHome > 0 && sAway > 0) ftBtts++;
    });

    const toPct = (val: number) => Math.round((val / total) * 100);

    return {
        total,
        p1Wins,
        p2Wins,
        draws,
        player1_win_percentage: toPct(p1Wins),
        player2_win_percentage: toPct(p2Wins),
        draw_percentage: toPct(draws),
        avgGoals: parseFloat((totalGoalsFT / total).toFixed(2)),
        avgGoalsHT: parseFloat((totalGoalsHT / total).toFixed(2)),
        ht: {
            over05Pct: toPct(htOver05),
            over15Pct: toPct(htOver15),
            bttsPct: toPct(htBtts)
        },
        ft: {
            over15Pct: toPct(ftOver15),
            over25Pct: toPct(ftOver25),
            over35Pct: toPct(ftOver35),
            bttsPct: toPct(ftBtts)
        }
    };
};

export const calculateHistoryPlayerStats = (matches: HistoryMatch[], player: string, windowSize: number): HistoryPlayerStats | null => {
    const playerMatches = matches.filter(m => m.home_player === player || m.away_player === player).slice(0, windowSize);
    
    if (playerMatches.length === 0) return null;

    let totalGoalsHT = 0;
    let totalGoalsFT = 0;
    let totalScored = 0;
    let totalConceded = 0;
    let totalScoredHT = 0;
    let wins = 0;
    
    let htOver05 = 0;
    let htOver15 = 0;
    let htBtts = 0;
    let ftOver15 = 0;
    let ftOver25 = 0;
    let btts = 0;

    playerMatches.forEach(m => {
        const isHome = m.home_player === player;
        const myScore = Number(isHome ? m.score_home : m.score_away);
        const opScore = Number(isHome ? m.score_away : m.score_home);
        
        const htHome = Number(m.halftime_score_home ?? 0); 
        const htAway = Number(m.halftime_score_away ?? 0);
        const myScoreHT = isHome ? htHome : htAway;
        
        const htTotal = htHome + htAway;
        const ftTotal = Number(m.score_home) + Number(m.score_away);

        totalGoalsHT += htTotal;
        totalGoalsFT += ftTotal;
        
        totalScored += myScore;
        totalConceded += opScore;
        totalScoredHT += myScoreHT;

        if (myScore > opScore) wins++;

        if (htTotal > 0.5) htOver05++;
        if (htTotal > 1.5) htOver15++;
        if (htHome > 0 && htAway > 0) htBtts++; 

        if (ftTotal > 1.5) ftOver15++;
        if (ftTotal > 2.5) ftOver25++;
        if (Number(m.score_home) > 0 && Number(m.score_away) > 0) btts++;
    });

    const total = playerMatches.length;
    const toPct = (val: number) => Math.round((val / total) * 100);

    return {
        player,
        games: total,
        avgGoalsHT: parseFloat((totalGoalsHT / total).toFixed(2)),
        avgGoalsFT: parseFloat((totalGoalsFT / total).toFixed(2)),
        
        avgScored: parseFloat((totalScored / total).toFixed(2)), 
        avgScoredHT: parseFloat((totalScoredHT / total).toFixed(2)), 
        avgConceded: parseFloat((totalConceded / total).toFixed(2)), 

        htOver05Pct: toPct(htOver05),
        htOver15Pct: toPct(htOver15),
        htBttsPct: toPct(htBtts), 
        ftOver15Pct: toPct(ftOver15),
        ftOver25Pct: toPct(ftOver25),
        bttsPct: toPct(btts),
        winPct: toPct(wins)
    };
};

export const calculateLeagueStatsFromHistory = (matches: HistoryMatch[], league: string, windowSize: number): LeagueStats | null => {
    const leagueMatches = matches.filter(m => m.league_name === league).slice(0, windowSize);
    if (leagueMatches.length === 0) return null;

    let totalGoalsHT = 0;
    let totalGoalsFT = 0;
    let htOver05 = 0;
    let htOver15 = 0;
    let ftOver25 = 0;
    let btts = 0;

    leagueMatches.forEach(m => {
        const htHome = Number(m.halftime_score_home ?? 0); 
        const htAway = Number(m.halftime_score_away ?? 0);
        const htTotal = htHome + htAway;
        const ftTotal = Number(m.score_home) + Number(m.score_away);

        totalGoalsHT += htTotal;
        totalGoalsFT += ftTotal;

        if (htTotal > 0.5) htOver05++;
        if (htTotal > 1.5) htOver15++;
        if (ftTotal > 2.5) ftOver25++;
        if (Number(m.score_home) > 0 && Number(m.score_away) > 0) btts++;
    });

    const total = leagueMatches.length;
    const toPct = (val: number) => Math.round((val / total) * 100);

    return {
        name: league,
        avgGoalsHT: parseFloat((totalGoalsHT / total).toFixed(2)),
        avgGoalsFT: parseFloat((totalGoalsFT / total).toFixed(2)),
        htOver05Pct: toPct(htOver05),
        htOver15Pct: toPct(htOver15),
        ftOver25Pct: toPct(ftOver25),
        bttsPct: toPct(btts)
    };
};

export const generateProjections = (
    h2hStats: any, 
    p1Stats: HistoryPlayerStats, 
    p2Stats: HistoryPlayerStats, 
    leagueStats: LeagueStats
): Projection[] => {
    const projections: Projection[] = [];

    const checkLine = (
        marketName: string,
        h2hPct: number,
        p1Pct: number,
        p2Pct: number,
        leaguePct: number,
        threshold = 75
    ) => {
        // Weighted Probability
        const avgPlayers = (p1Pct + p2Pct) / 2;
        let probability = 0;
        
        // If we have H2H data, use it heavily (40%)
        if (h2hStats && h2hStats.total > 0) {
            probability = (h2hPct * 0.4) + (avgPlayers * 0.4) + (leaguePct * 0.2);
        } else {
            // No H2H, rely on players form (70%) and league (30%)
            probability = (avgPlayers * 0.7) + (leaguePct * 0.3);
        }
        
        probability = Math.round(probability);
        const riskFactor = (p1Pct > 70 && p2Pct > 70) && (leaguePct < 55);
        
        if (probability >= 65) {
            const reasoning: string[] = [];
            
            if (h2hStats && h2hStats.total > 0) {
                if (h2hPct >= 80) reasoning.push(`Histórico H2H muito forte (${h2hPct}%)`);
                else if (h2hPct >= 60) reasoning.push(`Histórico H2H favorável (${h2hPct}%)`);
            }

            if (p1Pct >= 75) reasoning.push(`${p1Stats.player} vem com ${p1Pct}% nesta linha`);
            if (p2Pct >= 75) reasoning.push(`${p2Stats.player} vem com ${p2Pct}% nesta linha`);
            
            if (riskFactor) {
                reasoning.push(`⚠️ Cuidado: A média da liga (${leaguePct}%) é baixa para este mercado.`);
            }

            projections.push({
                market: marketName,
                probability,
                confidence: probability >= 80 ? 'High' : 'Medium',
                reasoning,
                riskFactor
            });
        }
    };

    if (h2hStats?.ht) {
        checkLine('Over 0.5 HT', h2hStats.ht.over05Pct, p1Stats.htOver05Pct, p2Stats.htOver05Pct, leagueStats.htOver05Pct, 80);
        checkLine('Over 1.5 HT', h2hStats.ht.over15Pct, p1Stats.htOver15Pct, p2Stats.htOver15Pct, leagueStats.htOver15Pct, 60);
        checkLine('BTTS HT', h2hStats.ht.bttsPct, p1Stats.bttsPct, p2Stats.bttsPct, leagueStats.bttsPct, 60); 
    }
    
    if (h2hStats?.ft) {
        checkLine('Over 2.5 FT', h2hStats.ft.over25Pct, p1Stats.ftOver25Pct, p2Stats.ftOver25Pct, leagueStats.ftOver25Pct, 70);
        checkLine('BTTS FT', h2hStats.ft.bttsPct, p1Stats.bttsPct, p2Stats.bttsPct, leagueStats.bttsPct, 70);
    }

    return projections.sort((a, b) => b.probability - a.probability);
};
