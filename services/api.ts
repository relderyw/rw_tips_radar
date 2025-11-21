
import { Game, H2HResponse, HistoryResponse, HistoryMatch, LiveGame } from '../types';

const GAMES_API_URL = 'https://api-v2.green365.com.br/api/v2/sport-events';
const H2H_API_URL = 'https://caveira-proxy.onrender.com/api/v1/historico/confronto';
const HISTORY_API_URL = 'https://caveira-proxy.onrender.com/api/historico/partidas';
const PLAYER_HISTORY_API_URL = 'https://caveira-proxy.onrender.com/api/v1/historico/partidas-assincrono';
const LIVE_API_URL = 'https://caveira-proxy.onrender.com/api/matches/live';
const CORS_PROXY = 'https://corsproxy.io/?';

// Helper for delay
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const fetchGames = async (): Promise<Game[]> => {
  let allGames: Game[] = [];
  const MAX_RETRIES = 4;

  // Fetch pages 1 and 2
  for (let page = 1; page <= 2; page++) {
    let attempt = 0;
    let success = false;

    while (attempt < MAX_RETRIES && !success) {
      try {
        // Reduce limit to 50 to prevent 504/408 Timeouts from proxies
        const targetUrl = `${GAMES_API_URL}?page=${page}&limit=50&sport=esoccer&status=ended`;
        
        let data: any = null;

        try {
            // STRATEGY 1: Direct Fetch
            // Using no-store to prevent caching stale 502s
            const res1 = await fetch(targetUrl, { 
                headers: { 'Accept': 'application/json' },
                cache: 'no-store'
            });
            if (!res1.ok) throw new Error(`Direct failed: ${res1.status}`);
            data = await res1.json();
        } catch (e1) {
            // STRATEGY 2: CORS Proxy (corsproxy.io)
            try {
                const res2 = await fetch(`${CORS_PROXY}${encodeURIComponent(targetUrl)}`, { 
                    headers: { 'Accept': 'application/json' },
                    cache: 'no-store'
                });
                if (!res2.ok) throw new Error(`Proxy 1 failed: ${res2.status}`);
                data = await res2.json();
            } catch (e2) {
                // STRATEGY 3: AllOrigins (Reliable Backup for text/json)
                // AllOrigins returns { contents: "stringified_json", status: ... }
                const res3 = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`, {
                    cache: 'no-store'
                });
                if (!res3.ok) throw new Error(`Proxy 2 failed: ${res3.status}`);
                const wrapper = await res3.json();
                if (wrapper.contents) {
                    data = JSON.parse(wrapper.contents);
                } else {
                    throw new Error('Proxy 2 returned empty contents');
                }
            }
        }
        
        if (data && data.items && Array.isArray(data.items)) {
            if (data.items.length > 0) {
                allGames = [...allGames, ...data.items];
            }
            success = true;
        } else {
            // If items is missing or empty, we can consider it a successful empty response (end of list)
            success = true; 
        }

      } catch (error) {
        console.error(`API Error fetching games page ${page} (Attempt ${attempt + 1}/${MAX_RETRIES}):`, error);
        attempt++;
        if (attempt < MAX_RETRIES) {
            // Exponential backoff with higher base for server errors: 2.5s, 5s, 7.5s
            await wait(2500 * (attempt + 1));
        }
      }
    }

    // If we failed to fetch a page completely after retries, stop to avoid inconsistent data state
    if (!success) break;
  }
  return allGames;
};

export const fetchH2H = async (player1: string, player2: string, league: string): Promise<H2HResponse | null> => {
  const tryFetch = async (url: string, cacheMode: RequestCache = 'default') => {
      const resp = await fetch(url, {
          cache: cacheMode,
          headers: { 'Accept': 'application/json' }
      });
      if (resp.status === 304) return null;
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return await resp.json();
  };

  const baseUrl = `${H2H_API_URL}/${encodeURIComponent(player1)}/${encodeURIComponent(player2)}?page=1&limit=30&league=${encodeURIComponent(league)}`;

  try {
      let data = await tryFetch(baseUrl);
      return data;
  } catch (error) {
      console.error("H2H Fetch Error", error);
      return null;
  }
};

// Normalize function to handle various API response structures
const normalizeHistoryMatch = (match: any): HistoryMatch => {
    return {
        home_player: match.home_player || match.homePlayer || match.HomePlayer || "Desconhecido",
        away_player: match.away_player || match.awayPlayer || match.AwayPlayer || "Desconhecido",
        league_name: match.league_name || match.league || match.LeagueName || match.competition_name || "Desconhecida",
        score_home: Number(match.score_home ?? match.scoreHome ?? 0),
        score_away: Number(match.score_away ?? match.scoreAway ?? 0),
        halftime_score_home: Number(match.halftime_score_home ?? match.scoreHTHome ?? match.ht_home ?? 0),
        halftime_score_away: Number(match.halftime_score_away ?? match.scoreHTAway ?? match.ht_away ?? 0),
        data_realizacao: match.data_realizacao || match.date || match.start_at || new Date().toISOString()
    };
};

export const fetchHistoryGames = async (): Promise<HistoryMatch[]> => {
    const fetchWithRetry = async (url: string, retries = 2) => {
        for (let i = 0; i <= retries; i++) {
            try {
                const response = await fetch(url, { 
                    headers: { 'Accept': 'application/json' }
                });
                
                if (response.ok) {
                    try {
                        const data = await response.json();
                        let rawMatches: any[] = [];
                        
                        if (data.partidas && Array.isArray(data.partidas)) rawMatches = data.partidas;
                        else if (data.matches && Array.isArray(data.matches)) rawMatches = data.matches;
                        else if (data.items && Array.isArray(data.items)) rawMatches = data.items;
                        else if (Array.isArray(data)) rawMatches = data;
                        
                        if (rawMatches.length > 0) {
                            return rawMatches.map(normalizeHistoryMatch);
                        }
                        return [];
                    } catch (jsonError) {
                        console.warn("Failed to parse JSON from History API", jsonError);
                    }
                }
                throw new Error(`Request failed: ${response.status}`);
            } catch (e) {
                console.warn(`History API Fetch failed for ${url} (Attempt ${i + 1})`, e);
                if (i < retries) await wait(1500);
            }
        }
        return null;
    };

    const primaryUrl = `${HISTORY_API_URL}?page=1&limit=30`;
    let result = await fetchWithRetry(primaryUrl);

    if (!result) {
         console.error("History Fetch Error: All attempts failed.");
         return [];
    }
    
    return result;
};

export const fetchPlayerHistory = async (player: string, limit: number = 20): Promise<HistoryMatch[]> => {
    try {
        const url = `${PLAYER_HISTORY_API_URL}?jogador=${encodeURIComponent(player)}&limit=${limit}&page=1`;
        
        const response = await fetch(url, {
            headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

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
        // Use CORS proxy or ensure backend allows it. 
        // Note: The user provided URL implies a proxy server is already in use.
        // Adding cache buster
        const url = `${LIVE_API_URL}?_=${Date.now()}`;
        const response = await fetch(url, {
            headers: { 'Accept': 'application/json' }
        });

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
