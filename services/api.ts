
import { Game, H2HResponse, HistoryResponse, HistoryMatch, LiveGame } from '../types';

// Updated to Green365 API
const GAMES_API_URL = 'https://api-v2.green365.com.br/api/v2/sport-events';
const H2H_API_URL = 'https://rwtips-r943.onrender.com/api/v1/historico/confronto';
// const HISTORY_API_URL = 'https://rwtips-r943.onrender.com/api/historico/partidas'; // Old API
const HISTORY_API_URL = 'https://api-v2.green365.com.br/api/v2/sport-events'; // New API
const PLAYER_HISTORY_API_URL = 'https://rwtips-r943.onrender.com/api/v1/historico/partidas-assincrono';
const LIVE_API_URL = 'https://rwtips-r943.onrender.com/api/matches/live';
const CORS_PROXY = 'https://corsproxy.io/?';

// Helper for delay
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper for normalizing inconsistent API data
const normalizeHistoryMatch = (match: any): HistoryMatch => {
    // Check if it's the new Green365 structure
    if (match.sport === 'esoccer' && match.score && match.home?.name) {
        return {
            home_player: match.home.name,
            away_player: match.away.name,
            league_name: match.competition?.name || "Desconhecida",
            score_home: Number(match.score.home ?? 0),
            score_away: Number(match.score.away ?? 0),
            halftime_score_home: Number(match.scoreHT?.home ?? 0),
            halftime_score_away: Number(match.scoreHT?.away ?? 0),
            data_realizacao: match.startTime || new Date().toISOString()
        };
    }

    // Fallback to old structure (for H2H or other endpoints if they still use it)
    return {
        home_player: match.home_player || match.homePlayer || match.HomePlayer || "Desconhecido",
        away_player: match.away_player || match.awayPlayer || match.AwayPlayer || "Desconhecido",
        league_name: match.league_name || match.league || match.LeagueName || match.competition_name || "Desconhecida",
        score_home: Number(match.score_home ?? match.scoreHome ?? 0),
        score_away: Number(match.score_away ?? match.scoreAway ?? 0),
        // Normalize HT scores aggressively to catch variations
        halftime_score_home: Number(match.halftime_score_home ?? match.scoreHTHome ?? match.ht_home ?? match.scoreHT?.home ?? 0),
        halftime_score_away: Number(match.halftime_score_away ?? match.scoreHTAway ?? match.ht_away ?? match.scoreHT?.away ?? 0),
        data_realizacao: match.data_realizacao || match.date || match.start_at || new Date().toISOString()
    };
};

export const fetchGames = async (): Promise<Game[]> => {
  const MAX_PAGES = 10;
  const CONCURRENCY_LIMIT = 5; 
  let allGames: any[] = [];

  const fetchPage = async (page: number) => {
      try {
          // New API params
          const url = `${HISTORY_API_URL}?page=${page}&limit=50&sport=esoccer&status=ended`;
          const response = await fetch(url, { headers: { 'Accept': 'application/json' } });
          
          if (!response.ok) return [];
          
          const data = await response.json();
          
          // New API returns items in data.items
          if (data.items && Array.isArray(data.items)) return data.items;
          
          // Old fallbacks
          if (data.partidas && Array.isArray(data.partidas)) return data.partidas;
          if (data.matches && Array.isArray(data.matches)) return data.matches;
          if (Array.isArray(data)) return data;
          
          return [];
      } catch (e) {
          console.warn(`Error fetching history page ${page}:`, e);
          return [];
      }
  };

  const pages = Array.from({ length: MAX_PAGES }, (_, i) => i + 1);
  
  for (let i = 0; i < pages.length; i += CONCURRENCY_LIMIT) {
      const batch = pages.slice(i, i + CONCURRENCY_LIMIT);
      const results = await Promise.all(batch.map(p => fetchPage(p)));
      results.forEach(r => allGames.push(...r));
  }

  return allGames;
};

export const fetchH2H = async (player1: string, player2: string, league: string): Promise<H2HResponse | null> => {
  const tryFetch = async (url: string) => {
      const resp = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return await resp.json();
  };

  const baseUrl = `${H2H_API_URL}/${encodeURIComponent(player1)}/${encodeURIComponent(player2)}?page=1&limit=30&league=${encodeURIComponent(league)}`;

  try {
      const data = await tryFetch(baseUrl);
      
      // Normalize matches inside H2H response to ensure stats are correct
      if (data && data.matches && Array.isArray(data.matches)) {
          data.matches = data.matches.map(normalizeHistoryMatch);
      }
      
      return data;
  } catch (error) {
      console.error("H2H Fetch Error", error);
      return null;
  }
};

export const fetchHistoryGames = async (): Promise<HistoryMatch[]> => {
    try {
        // Updated to use new API params
        const url = `${HISTORY_API_URL}?page=1&limit=24&sport=esoccer&status=ended`;
        const response = await fetch(url, { headers: { 'Accept': 'application/json' } });
        if(response.ok) {
            const data = await response.json();
            // New API structure: data.items
            const raw = data.items || data.partidas || data.matches || (Array.isArray(data) ? data : []);
            return raw.map(normalizeHistoryMatch);
        }
    } catch (e) {
        console.error("Failed to fetch history games list", e);
    }
    return [];
};

export const fetchPlayerHistory = async (player: string, limit: number = 20): Promise<HistoryMatch[]> => {
    try {
        const url = `${PLAYER_HISTORY_API_URL}?jogador=${encodeURIComponent(player)}&limit=${limit}&page=1`;
        const response = await fetch(url, { headers: { 'Accept': 'application/json' } });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        let rawMatches: any[] = [];

        if (data.partidas && Array.isArray(data.partidas)) rawMatches = data.partidas;
        else if (Array.isArray(data)) rawMatches = data;
        else if (data.matches && Array.isArray(data.matches)) rawMatches = data.matches;

        if (rawMatches.length > 0) {
            return rawMatches.map(normalizeHistoryMatch);
        }
        return [];

    } catch (error) {
        console.error(`Error fetching specific history for player ${player}:`, error);
        return [];
    }
};

export const fetchLiveGames = async (): Promise<LiveGame[]> => {
    try {
        const url = `${LIVE_API_URL}?_=${Date.now()}`;
        const response = await fetch(url, { headers: { 'Accept': 'application/json' } });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const json = await response.json();
        
        if (json && json.data && Array.isArray(json.data)) {
            return json.data;
        }
        return [];
    } catch (error) {
        console.error("Live Games Fetch Error:", error);
        return [];
    }
};
