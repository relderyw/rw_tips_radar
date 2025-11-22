import { Game, ProcessedGame, PlayerMetrics, H2HMatch, HistoryMatch, HistoryPlayerStats, LeagueStats, Projection, PlayerVerdict, MatchPotential } from '../types';

export const processRawGames = (games: any[]): ProcessedGame[] => {
  return games.map(game => {
    const homePlayer = game.home_player || game.homePlayer || game.home?.name || 'Desconhecido';
    const awayPlayer = game.away_player || game.awayPlayer || game.away?.name || 'Desconhecido';
    const league = game.league_name || game.league || game.competition?.name || 'Liga Desconhecida';
    const date = game.data_realizacao || game.date || game.start_at || new Date().toISOString();
    
    const scoreHome = Number(game.score_home ?? game.score?.home ?? 0);
    const scoreAway = Number(game.score_away ?? game.score?.away ?? 0);
    const scoreHTHome = Number(game.halftime_score_home ?? game.scoreHT?.home ?? 0);
    const scoreHTAway = Number(game.halftime_score_away ?? game.scoreHT?.away ?? 0);

    const homeTeam = game.home_team || game.home?.team_name || '';
    const awayTeam = game.away_team || game.away?.team_name || '';

    return {
      id: game.id || Math.random(),
      league: league,
      date: date,
      homePlayer: homePlayer,
      awayPlayer: awayPlayer,
      homeTeam: homeTeam,
      awayTeam: awayTeam,
      scoreHome: scoreHome,
      scoreAway: scoreAway,
      scoreHTHome: scoreHTHome,
      scoreHTAway: scoreHTAway,
      totalGoals: scoreHome + scoreAway,
      totalGoalsHT: scoreHTHome + scoreHTAway,
      isBTTS: scoreHome > 0 && scoreAway > 0,
      isBTTS_HT: scoreHTHome > 0 && scoreHTAway > 0,
    };
  });
};

const calculatePlayerVerdict = (
    ftOver25Pct: number, 
    bttsPct: number, 
    htOver05Pct: number, 
    avgGoalsFT: number
): PlayerVerdict => {
    if (ftOver25Pct >= 80 && bttsPct >= 75 && avgGoalsFT >= 3.0) return 'sniper';
    if (avgGoalsFT <= 2.2 || ftOver25Pct <= 40) return 'wall';
    if (htOver05Pct <= 60 && ftOver25Pct >= 70) return 'troll';
    return 'neutral';
};

export const calculatePlayerMetrics = (games: ProcessedGame[], player: string, windowSize: number = 10): PlayerMetrics | null => {
  const playerGames = games.filter(g => g.homePlayer === player || g.awayPlayer === player);
  const recent = playerGames.slice(0, windowSize);
  
  if (recent.length === 0) return null;

  const league = recent[0].league; 

  let htOver05 = 0, htOver15 = 0, htOver25 = 0, htBtts = 0;
  let ftOver05 = 0, ftOver15 = 0, ftOver25 = 0, ftOver35 = 0, ftBtts = 0;
  let totalGoalsHT = 0, totalGoalsFT = 0, wins = 0;

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
  const avgGoalsFT = parseFloat((totalGoalsFT / recent.length).toFixed(2));
  const avgGoalsHT = parseFloat((totalGoalsHT / recent.length).toFixed(2));
  const ftOver25Pct = toPct(ftOver25);
  const bttsPct = toPct(ftBtts);
  const htOver05Pct = toPct(htOver05);

  const verdict = calculatePlayerVerdict(ftOver25Pct, bttsPct, htOver05Pct, avgGoalsFT);

  return {
    player, league, games: recent.length,
    htOver05, htOver15, htOver25, htBtts,
    ftOver05, ftOver15, ftOver25, ftOver35, ftBtts,
    wins, avgGoalsHT, avgGoalsFT,
    htOver05Pct, htOver15Pct: toPct(htOver15), htOver25Pct: toPct(htOver25), htBttsPct: toPct(htBtts),
    ftOver05Pct: toPct(ftOver05), ftOver15Pct: toPct(ftOver15), ftOver25Pct,
    ftOver35Pct: toPct(ftOver35), ftBttsPct: bttsPct, winPct: toPct(wins),
    verdict
  };
};

export const calculateH2HStats = (matches: H2HMatch[], player1: string, player2: string) => {
    const total = matches.length;
    if (total === 0) return { total: 0, p1Wins: 0, p2Wins: 0, draws: 0, player1_win_percentage: 0, player2_win_percentage: 0, draw_percentage: 0, avgGoals: 0, avgGoalsHT: 0, ht: { over05Pct: 0, over15Pct: 0, bttsPct: 0 }, ft: { over15Pct: 0, over25Pct: 0, over35Pct: 0, bttsPct: 0 } };

    let p1Wins = 0, p2Wins = 0, draws = 0;
    let htOver05 = 0, htOver15 = 0, htBtts = 0, totalGoalsHT = 0;
    let ftOver15 = 0, ftOver25 = 0, ftOver35 = 0, ftBtts = 0, totalGoalsFT = 0;

    matches.forEach(m => {
        const sHome = Number(m.score_home);
        const sAway = Number(m.score_away);
        const htHome = Number(m.halftime_score_home ?? 0);
        const htAway = Number(m.halftime_score_away ?? 0);
        
        if (m.home_player === player1) {
            if (sHome > sAway) p1Wins++; else if (sAway > sHome) p2Wins++; else draws++;
        } else {
            if (sAway > sHome) p1Wins++; else if (sHome > sAway) p2Wins++; else draws++;
        }

        const tHT = htHome + htAway;
        const tFT = sHome + sAway;
        totalGoalsHT += tHT;
        totalGoalsFT += tFT;

        if (tHT > 0.5) htOver05++;
        if (tHT > 1.5) htOver15++;
        if (htHome > 0 && htAway > 0) htBtts++;
        if (tFT > 1.5) ftOver15++;
        if (tFT > 2.5) ftOver25++;
        if (tFT > 3.5) ftOver35++;
        if (sHome > 0 && sAway > 0) ftBtts++;
    });

    const pct = (n: number) => Math.round((n/total)*100);
    return {
        total, p1Wins, p2Wins, draws,
        player1_win_percentage: pct(p1Wins), player2_win_percentage: pct(p2Wins), draw_percentage: pct(draws),
        avgGoals: Number((totalGoalsFT/total).toFixed(2)),
        avgGoalsHT: Number((totalGoalsHT/total).toFixed(2)),
        ht: { over05Pct: pct(htOver05), over15Pct: pct(htOver15), bttsPct: pct(htBtts) },
        ft: { over15Pct: pct(ftOver15), over25Pct: pct(ftOver25), over35Pct: pct(ftOver35), bttsPct: pct(ftBtts) }
    };
};

export const calculateHistoryPlayerStats = (matches: HistoryMatch[], player: string, windowSize: number): HistoryPlayerStats | null => {
    const playerMatches = matches.filter(m => m.home_player === player || m.away_player === player).slice(0, windowSize);
    if (playerMatches.length === 0) return null;

    let totalGoalsHT = 0, totalGoalsFT = 0, totalScored = 0, totalConceded = 0, totalScoredHT = 0, wins = 0;
    let htOver05 = 0, htOver15 = 0, htOver25 = 0, htBtts = 0; 
    let ftOver15 = 0, ftOver25 = 0, btts = 0;

    playerMatches.forEach(m => {
        const isHome = m.home_player === player;
        const sHome = Number(m.score_home), sAway = Number(m.score_away);
        const htHome = Number(m.halftime_score_home ?? 0), htAway = Number(m.halftime_score_away ?? 0);
        
        const myScore = isHome ? sHome : sAway;
        const opScore = isHome ? sAway : sHome;
        const myScoreHT = isHome ? htHome : htAway;
        
        const tHT = htHome + htAway;
        const tFT = sHome + sAway;
        
        totalGoalsHT += tHT;
        totalGoalsFT += tFT;
        totalScored += myScore;
        totalConceded += opScore;
        totalScoredHT += myScoreHT;
        if (myScore > opScore) wins++;

        if (tHT > 0.5) htOver05++;
        if (tHT > 1.5) htOver15++;
        if (tHT > 2.5) htOver25++; 
        if (htHome > 0 && htAway > 0) htBtts++;
        
        if (tFT > 1.5) ftOver15++;
        if (tFT > 2.5) ftOver25++;
        if (sHome > 0 && sAway > 0) btts++;
    });

    const total = playerMatches.length;
    const pct = (n: number) => Math.round((n/total)*100);

    return {
        player, games: total,
        avgGoalsHT: Number((totalGoalsHT/total).toFixed(2)),
        avgGoalsFT: Number((totalGoalsFT/total).toFixed(2)),
        avgScored: Number((totalScored/total).toFixed(2)),
        avgScoredHT: Number((totalScoredHT/total).toFixed(2)),
        avgConceded: Number((totalConceded/total).toFixed(2)),
        htOver05Pct: pct(htOver05), htOver15Pct: pct(htOver15), htOver25Pct: pct(htOver25), htBttsPct: pct(htBtts),
        ftOver15Pct: pct(ftOver15), ftOver25Pct: pct(ftOver25), bttsPct: pct(btts), winPct: pct(wins)
    };
};

export const calculateLeagueStatsFromHistory = (matches: HistoryMatch[], league: string, windowSize: number): LeagueStats | null => {
    const matches_ = matches.filter(m => m.league_name === league).slice(0, windowSize);
    if (matches_.length === 0) return null;
    let totalHT = 0, totalFT = 0, ht05 = 0, ht15 = 0, ft25 = 0, btts = 0;
    matches_.forEach(m => {
        const ht = Number(m.halftime_score_home??0) + Number(m.halftime_score_away??0);
        const ft = Number(m.score_home) + Number(m.score_away);
        totalHT+=ht; totalFT+=ft;
        if(ht>0.5) ht05++; if(ht>1.5) ht15++; if(ft>2.5) ft25++;
        if(Number(m.score_home)>0 && Number(m.score_away)>0) btts++;
    });
    const total = matches_.length;
    const pct = (n: number) => Math.round((n/total)*100);
    return { name: league, avgGoalsHT: Number((totalHT/total).toFixed(2)), avgGoalsFT: Number((totalFT/total).toFixed(2)), htOver05Pct: pct(ht05), htOver15Pct: pct(ht15), ftOver25Pct: pct(ft25), bttsPct: pct(btts) };
};

// --- NEW LOGIC: ANALYZE MATCH POTENTIAL (3 TIERS) ---
export const analyzeMatchPotential = (p1: HistoryPlayerStats, p2: HistoryPlayerStats): MatchPotential => {
    const avg = (a: number, b: number) => (a + b) / 2;

    // 1. TOP CONFRONTO
    const isTopClash = 
        p1.htOver05Pct === 100 && p2.htOver05Pct === 100 &&
        avg(p1.htOver15Pct, p2.htOver15Pct) >= 95 &&
        p1.bttsPct === 100 && p2.bttsPct === 100 &&
        p1.ftOver15Pct === 100 && p2.ftOver15Pct === 100 &&
        avg(p1.ftOver25Pct, p2.ftOver25Pct) >= 95 &&
        p1.avgGoalsFT >= 2.7 && p2.avgGoalsFT >= 2.7;

    if (isTopClash) return 'top_clash';

    // 2. TOP HT
    const isTopHT = 
        p1.htOver05Pct === 100 && p2.htOver05Pct === 100 &&
        p1.htOver15Pct === 100 && p2.htOver15Pct === 100 &&
        p1.htOver25Pct === 100 && p2.htOver25Pct === 100 &&
        p1.htBttsPct === 100 && p2.htBttsPct === 100;

    if (isTopHT) return 'top_ht';

    // 3. TOP FT
    const isTopFT = 
        p1.ftOver15Pct === 100 && p2.ftOver15Pct === 100 &&
        p1.ftOver25Pct === 100 && p2.ftOver25Pct === 100 &&
        p1.bttsPct === 100 && p2.bttsPct === 100;

    if (isTopFT) return 'top_ft';

    return 'none';
};

export const generateProjections = (h2hStats: any, p1Stats: HistoryPlayerStats, p2Stats: HistoryPlayerStats, leagueStats: LeagueStats): Projection[] => {
    const projections: Projection[] = [];
    const checkLine = (market: string, h2h: number, p1: number, p2: number, lg: number, th: number) => {
        const avgP = (p1+p2)/2;
        let prob = (h2hStats && h2hStats.total > 0) ? (h2h*0.4 + avgP*0.4 + lg*0.2) : (avgP*0.7 + lg*0.3);
        prob = Math.round(prob);
        const risk = (p1 > 70 && p2 > 70 && lg < 55);
        if (prob >= 65) {
            const r = [];
            if (h2h >= 80) r.push(`H2H Forte: ${h2h}%`);
            if (p1 >= 75) r.push(`${p1Stats.player}: ${p1}%`);
            if (p2 >= 75) r.push(`${p2Stats.player}: ${p2}%`);
            if (risk) r.push(`⚠️ Liga Baixa (${lg}%)`);
            else if (lg >= 70) r.push(`✅ Liga Favorável (${lg}%)`);
            projections.push({ market, probability: prob, confidence: prob >= 80 ? 'High' : 'Medium', reasoning: r, riskFactor: risk });
        }
    };
    if (h2hStats?.ht) {
        checkLine('Over 0.5 HT', h2hStats.ht.over05Pct, p1Stats.htOver05Pct, p2Stats.htOver05Pct, leagueStats.htOver05Pct, 80);
        checkLine('BTTS HT', h2hStats.ht.bttsPct, p1Stats.htBttsPct, p2Stats.htBttsPct, leagueStats.bttsPct, 60);
    }
    if (h2hStats?.ft) {
        checkLine('Over 2.5 FT', h2hStats.ft.over25Pct, p1Stats.ftOver25Pct, p2Stats.ftOver25Pct, leagueStats.ftOver25Pct, 70);
        checkLine('BTTS FT', h2hStats.ft.bttsPct, p1Stats.bttsPct, p2Stats.bttsPct, leagueStats.bttsPct, 70);
    }
    return projections.sort((a, b) => b.probability - a.probability);
};