export interface Team {
  id: number;
  name: string;
  team_name: string;
}

export interface Competition {
  id: number;
  name: string;
}

export interface Score {
  home: number;
  away: number;
}

export interface Game {
  id: number;
  start_at: string;
  status: string;
  competition: Competition;
  home: Team;
  away: Team;
  score: Score;
  scoreHT?: Score;
  halftime_score_home?: number; 
  halftime_score_away?: number;
}

export interface ProcessedGame {
  id: number;
  league: string;
  date: string;
  homePlayer: string;
  awayPlayer: string;
  homeTeam: string;
  awayTeam: string;
  scoreHome: number;
  scoreAway: number;
  scoreHTHome: number;
  scoreHTAway: number;
  totalGoals: number;
  totalGoalsHT: number;
  isBTTS: boolean;
  isBTTS_HT: boolean;
}

export type PlayerVerdict = 'sniper' | 'troll' | 'wall' | 'neutral';

export interface PlayerMetrics {
  player: string;
  league: string;
  games: number;
  htOver05: number;
  htOver15: number;
  htOver25: number;
  htBtts: number;
  
  ftOver05: number;
  ftOver15: number;
  ftOver25: number;
  ftOver35: number;
  ftBtts: number;
  
  avgGoalsHT: number;
  avgGoalsFT: number;
  wins: number;
  
  htOver05Pct: number;
  htOver15Pct: number;
  htOver25Pct: number;
  htBttsPct: number;
  
  ftOver05Pct: number;
  ftOver15Pct: number;
  ftOver25Pct: number;
  ftOver35Pct: number;
  ftBttsPct: number;
  
  winPct: number;
  verdict: PlayerVerdict;
}

export interface H2HMatch {
  home_player: string;
  away_player: string;
  score_home: number;
  score_away: number;
  halftime_score_home: number;
  halftime_score_away: number;
  data_realizacao: string;
  home_team?: string;
  away_team?: string;
}

export interface H2HResponse {
  total_matches: number;
  player1_wins: number;
  player2_wins: number;
  draws: number;
  player1_win_percentage: number;
  player2_win_percentage: number;
  draw_percentage: number;
  matches: H2HMatch[];
}

export interface HistoryMatch {
    home_player: string;
    away_player: string;
    league_name: string;
    score_home: number;
    score_away: number;
    data_realizacao: string;
    halftime_score_home: number;
    halftime_score_away: number;
}

export interface HistoryResponse {
    matches: HistoryMatch[];
    total: number;
}

export interface HistoryPlayerStats {
    player: string;
    games: number;
    avgGoalsHT: number; 
    avgGoalsFT: number; 
    
    avgScored: number; 
    avgScoredHT: number; 
    avgConceded: number;

    htOver05Pct: number;
    htOver15Pct: number;
    htOver25Pct: number; // Added for Top HT logic
    htBttsPct: number; 
    
    ftOver15Pct: number;
    ftOver25Pct: number;
    bttsPct: number;
    winPct: number;
}

export interface LeagueStats {
    name: string;
    avgGoalsHT: number;
    avgGoalsFT: number;
    htOver05Pct: number;
    htOver15Pct: number;
    ftOver25Pct: number;
    bttsPct: number;
}

export interface Projection {
    market: string;
    probability: number; 
    confidence: 'High' | 'Medium' | 'Low';
    reasoning: string[];
    riskFactor?: boolean;
}

// --- LIVE GAMES TYPES ---
export interface LiveTeam {
    id: string;
    name: string;
    image_id: string;
}

export interface LiveLeague {
    id: string;
    name: string;
}

export interface LiveTimer {
    tm: number; 
    ts: number; 
    tt: string; 
}

export type MatchPotential = 'top_clash' | 'top_ht' | 'top_ft' | 'none';

export interface LiveGame {
    id: string;
    time: string;
    time_status: string;
    league: LiveLeague;
    home: LiveTeam;
    away: LiveTeam;
    ss: string; 
    timer: LiveTimer;
    scores: any;
    
    matchPotential?: MatchPotential;
}