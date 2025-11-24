export interface Match {
  id: string;
  data_realizacao: string;
  league_name: string;
  home_player: string;
  away_player: string;
  home_team: string;
  away_team: string;
  score_home: number;
  score_away: number;
  halftime_score_home: number;
  halftime_score_away: number;
}

export interface MatchResponse {
  partidas: Match[];
  paginacao: {
    pagina_atual: number;
    total_paginas: number;
    total_partidas: number;
    itens_por_pagina: number;
    proxima_pagina: number | null;
    pagina_anterior: number | null;
  };
}

export interface Market {
  id: string;
  name: string;
}

export type BetResult = 'Win' | 'Loss' | 'HalfWin' | 'HalfLoss' | 'Void' | 'Pending';

export interface Bet {
  id: string;
  matchId?: string; // Optional now as some bets might be manual/custom
  date: string; // ISO string
  league: string;
  homePlayer: string;
  awayPlayer: string;
  market: string; // Changed from selection to market to match new requirement
  odds: number;
  stake: number;
  result: BetResult;
  profit: number;
  notes?: string;
}
