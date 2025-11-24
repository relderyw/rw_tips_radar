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

export type BetResult = 'Win' | 'Loss' | 'Pending' | 'Void';

export interface Bet {
  id: string;
  matchId: string;
  date: string; // ISO string
  league: string;
  homePlayer: string;
  awayPlayer: string;
  selection: string; // e.g., "Home Win", "Over 2.5"
  odds: number;
  stake: number;
  result: BetResult;
  profit: number; // calculated based on result
  notes?: string;
}
