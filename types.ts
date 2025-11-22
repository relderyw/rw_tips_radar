
export interface Team {
  id: number;
  name: string;
  team_name: string; // Sometimes the API gives team_name
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
  scoreHT?: Score; // The API might use different field names, adapted from user code
  // Adapted based on user code utilizing `scoreHT`
  halftime_score_home?: number; 
  halftime_score_away?: number;
}

// Normalized Game Structure for internal use
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
  
  // Percentages
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
  
  // New Analysis Field
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

// New Interface for the History API to populate Dropdowns
export interface HistoryMatch {
    home_player: string;
    away_player: string;
    league_name: string;
    score_home: number;
    score_away: number;
    data_realizacao: string;
    // Added optional HT fields to support full stats calculation
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
    avgGoalsHT: number; // Total goals in match
    avgGoalsFT: number; // Total goals in match
    
    // New: Specific Player Output
    avgScored: number; 
    avgScoredHT: number; // Individual HT goals
    avgConceded: number;

    htOver05Pct: number;
    htOver15Pct: number;
    htBttsPct: number; // Added for Super Over logic
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
    probability: number; // 0-100
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
    tm: number; // minutes
    ts: number; // seconds
    tt: string; // status (1 = playing?)
}

export interface LiveGame {
    id: string;
    time: string;
    time_status: string;
    league: LiveLeague;
    home: LiveTeam;
    away: LiveTeam;
    ss: string; // score string "2-1"
    timer: LiveTimer;
    scores: any;
    
    // Optional computed fields
    isSuperClash?: boolean;
}
