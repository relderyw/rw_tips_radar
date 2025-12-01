import { Game, H2HResponse, HistoryResponse, HistoryMatch, LiveGame } from '../types';

// API URLs
const GAMES_API_URL = 'https://api-v2.green365.com.br/api/v2/sport-events';
const LIVE_API_URL = 'https://rwtips-r943.onrender.com/api/matches/live';
const RWTIPS_PLAYER_HISTORY_URL = 'https://rwtips-r943.onrender.com/api/v1/historico/partidas-assincrono';
const RWTIPS_H2H_URL = 'https://rwtips-r943.onrender.com/api/v1/historico/confronto';

// Helper for delay
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper for normalizing inconsistent API data
const normalizeHistoryMatch = (match: any): HistoryMatch => {
    // Check if it's the new Green365 structure
    if (match.sport === 'esoccer' && match.score && match.home?.name) {
        // Capture IDs for future use (Critical for H2H and Analysis)
        // IMPORTANT: Store names in lowercase for case-insensitive lookup
        if (match.home?.id && match.home?.name) {
            playerIdMap.set(match.home.name.toLowerCase(), match.home.id);
        }
        if (match.away?.id && match.away?.name) {
            playerIdMap.set(match.away.name.toLowerCase(), match.away.id);
        }
        if (match.competition?.id && match.competition?.name) {
            leagueIdMap.set(match.competition.name, match.competition.id);
        }

        return {
            home_player: match.home.name,
            away_player: match.away.name,
            league_name: match.competition?.name || "Desconhecida",
            score_home: Number(match.score.home ?? 0),
            score_away: Number(match.score.away ?? 0),
            halftime_score_home: Number(match.scoreHT?.home ?? 0),
            halftime_score_away: Number(match.scoreHT?.away ?? 0),
            data_realizacao: match.startTime || new Date().toISOString(),
            home_id: match.home?.id,
            away_id: match.away?.id
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

// Maps to store IDs for Analysis API
const playerIdMap = new Map<string, number>();
const leagueIdMap = new Map<string, number>();

// Helper to get player ID from map or return undefined
export const getPlayerIdFromCache = (playerName: string): number | undefined => {
    return playerIdMap.get(playerName.toLowerCase());
};

// Helper to check if we have IDs cached
export const hasPlayerIds = (): boolean => {
    return playerIdMap.size > 0;
};



export const fetchGames = async (): Promise<Game[]> => {
  const MAX_PAGES = 10;
  const CONCURRENCY_LIMIT = 5; 
  let allGames: any[] = [];

  const fetchPage = async (page: number) => {
      try {
          const url = `${GAMES_API_URL}?page=${page}&limit=50&sport=esoccer&status=ended`;
          const response = await fetch(url, { 
              headers: { 
                  'Accept': 'application/json',
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
              } 
          });
          
          if (!response.ok) return [];
          
          const data = await response.json();
          
          if (data.items && Array.isArray(data.items)) return data.items;
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

// Fetch H2H from rwtips API (for live games and manual queries)
export const fetchH2HRwtips = async (player1: string, player2: string): Promise<H2HResponse | null> => {
    try {
        console.log(`[Rwtips H2H] Fetching ${player1} vs ${player2}...`);
        const url = `${RWTIPS_H2H_URL}/${encodeURIComponent(player1)}/${encodeURIComponent(player2)}?page=1&limit=20`;
        
        const response = await fetch(url, {
            headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) {
            console.warn(`[Rwtips H2H] HTTP ${response.status}`);
            throw new Error('MAINTENANCE');
        }

        const data = await response.json();
        console.log(`[Rwtips H2H] Found ${data.total_matches} total matches`);

        // Normalize matches
        const matches = data.matches?.map((m: any) => ({
            home_player: m.home_player || "Desconhecido",
            away_player: m.away_player || "Desconhecido",
            league_name: m.league_name || "Desconhecida",
            score_home: Number(m.score_home ?? 0),
            score_away: Number(m.score_away ?? 0),
            halftime_score_home: Number(m.halftime_score_home ?? 0),
            halftime_score_away: Number(m.halftime_score_away ?? 0),
            data_realizacao: m.data_realizacao || new Date().toISOString()
        })) || [];

        return {
            total_matches: data.total_matches || 0,
            player1_wins: data.player1_wins || 0,
            player2_wins: data.player2_wins || 0,
            draws: data.draws || 0,
            player1_win_percentage: data.player1_win_percentage || 0,
            player2_win_percentage: data.player2_win_percentage || 0,
            draw_percentage: data.draw_percentage || 0,
            matches: matches,
            player1_stats: { games: [] }, // Will be fetched separately if needed
            player2_stats: { games: [] }
        };
    } catch (error) {
        console.error(`[Rwtips H2H] Error:`, error);
        throw new Error('MAINTENANCE');
    }
};

export const fetchH2H = async (player1: string, player2: string, league?: string, useRwtips: boolean = false): Promise<H2HResponse | null> => {
  // Always use RWTips API now
  return fetchH2HRwtips(player1, player2);
};

const HISTORY_API_URL = 'https://rwtips-r943.onrender.com/api/historico/partidas';

export const fetchHistoryGames = async (): Promise<HistoryMatch[]> => {
    try {
        console.log('[fetchHistoryGames] Starting to fetch recent games from RWTips...');
        const pages = Array.from({ length: 5 }, (_, i) => i + 1);
        
        const promises = pages.map(page => 
            fetch(`${HISTORY_API_URL}?page=${page}&limit=20`, { 
                headers: { 
                    'Accept': 'application/json'
                } 
            }).then(res => {
                if (!res.ok) throw new Error('MAINTENANCE');
                return res.json();
            })
        );

        const results = await Promise.all(promises);
        let allMatches: any[] = [];
        
        results.forEach(data => {
            if (data && data.partidas && Array.isArray(data.partidas)) {
                allMatches = [...allMatches, ...data.partidas];
            }
        });

        const normalized = allMatches.map(m => ({
            home_player: m.home_player || "Desconhecido",
            away_player: m.away_player || "Desconhecido",
            league_name: m.league_name || "Desconhecida",
            score_home: Number(m.score_home ?? 0),
            score_away: Number(m.score_away ?? 0),
            halftime_score_home: Number(m.halftime_score_home ?? 0),
            halftime_score_away: Number(m.halftime_score_away ?? 0),
            data_realizacao: m.data_realizacao || new Date().toISOString()
        }));

        console.log(`[fetchHistoryGames] Loaded ${normalized.length} matches from ${pages.length} pages`);
        
        return normalized;
    } catch (error) {
        console.error("Error fetching history games:", error);
        throw new Error('MAINTENANCE');
    }
};

// Simple in-memory cache
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes
const playerHistoryCache = new Map<string, { timestamp: number, data: HistoryMatch[] }>();

// Fetch player history from rwtips API (for live games)
export const fetchPlayerHistoryRwtips = async (player: string, limit: number = 20): Promise<HistoryMatch[]> => {
    const cacheKey = `rwtips-${player.toLowerCase()}-${limit}`;
    
    if (playerHistoryCache.has(cacheKey)) {
        const cached = playerHistoryCache.get(cacheKey)!;
        if (Date.now() - cached.timestamp < CACHE_TTL) {
            console.log(`[Cache Hit] Returning cached rwtips data for ${player}`);
            return cached.data;
        }
    }

    try {
        console.log(`[Rwtips API] Fetching history for ${player}...`);
        const url = `${RWTIPS_PLAYER_HISTORY_URL}?jogador=${encodeURIComponent(player)}&limit=${limit}&page=1`;
        
        const response = await fetch(url, {
            headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) {
            console.warn(`[Rwtips API] HTTP ${response.status} for player ${player}`);
            throw new Error('MAINTENANCE');
        }

        const data = await response.json();
        
        if (data.partidas && Array.isArray(data.partidas)) {
            const matches = data.partidas.map((p: any) => ({
                home_player: p.home_player || p.homePlayer || "Desconhecido",
                away_player: p.away_player || p.awayPlayer || "Desconhecido",
                league_name: p.league_name || p.league || "Desconhecida",
                score_home: Number(p.score_home ?? 0),
                score_away: Number(p.score_away ?? 0),
                halftime_score_home: Number(p.halftime_score_home ?? 0),
                halftime_score_away: Number(p.halftime_score_away ?? 0),
                data_realizacao: p.data_realizacao || new Date().toISOString()
            }));

            playerHistoryCache.set(cacheKey, { timestamp: Date.now(), data: matches });
            console.log(`[Rwtips API] Found ${matches.length} matches for ${player}`);
            return matches;
        }

        return [];
    } catch (error) {
        console.error(`[Rwtips API] Error fetching history for ${player}:`, error);
        throw new Error('MAINTENANCE');
    }
};

export const fetchPlayerHistory = async (player: string, limit: number = 20, playerId?: number, useRwtips: boolean = false): Promise<HistoryMatch[]> => {
    // Always use RWTips API now
    return fetchPlayerHistoryRwtips(player, limit);
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
