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
        const url = `${RWTIPS_H2H_URL}/${encodeURIComponent(player1)}/${encodeURIComponent(player2)}?page=1&limit=50`;
        
        const response = await fetch(url, {
            headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) {
            console.warn(`[Rwtips H2H] HTTP ${response.status}`);
            return null;
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
        return null;
    }
};

export const fetchH2H = async (player1: string, player2: string, league: string, useRwtips: boolean = false): Promise<H2HResponse | null> => {
  // If useRwtips is true (for live games), use rwtips API
  if (useRwtips) {
      return fetchH2HRwtips(player1, player2);
  }

  const p1Id = playerIdMap.get(player1.toLowerCase());
  const p2Id = playerIdMap.get(player2.toLowerCase());
  const lId = leagueIdMap.get(league);

  if (!p1Id || !p2Id || !lId) {
      console.warn(`[Green365 H2H] Missing IDs: ${player1}(${p1Id}) vs ${player2}(${p2Id}) in ${league}(${lId})`);
      console.warn(`[Fallback] Using rwtips API instead...`);
      return fetchH2HRwtips(player1, player2);
  }

  const url = `https://api-v2.green365.com.br/api/v2/analysis/sport/dynamic?type=h2h&sport=esoccer&status=manual&competitionID=${lId}&home=${encodeURIComponent(player1)}&away=${encodeURIComponent(player2)}&homeID=${p1Id}&awayID=${p2Id}&period=50g`;
  
  try {
      console.log(`[Green365 H2H] Fetching ${player1} vs ${player2}...`);
      const response = await fetch(url, {
          headers: {
              'Accept': 'application/json',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
      });

      if (!response.ok) {
          console.warn(`[Green365 H2H] HTTP ${response.status}, falling back to rwtips...`);
          return fetchH2HRwtips(player1, player2);
      }

      const data = await response.json();
      
      const sessionEvents = data.info?.sessions?.sessionEvents || data.sessions?.sessionEvents || data.sessionEvents;
      
      if (!sessionEvents) {
          console.warn(`[Green365 H2H] sessionEvents not found, falling back to rwtips...`);
          return fetchH2HRwtips(player1, player2);
      }

      const headToHeadEvents = sessionEvents.headToHeadEvents || [];
      const homeEvents = sessionEvents.homeEvents || [];
      const awayEvents = sessionEvents.awayEvents || [];

      console.log(`[Green365 H2H] Events found: ${headToHeadEvents.length}, Home: ${homeEvents.length}, Away: ${awayEvents.length}`);

      const matches = headToHeadEvents.map(normalizeHistoryMatch);
      const p1Matches = homeEvents.map(normalizeHistoryMatch);
      const p2Matches = awayEvents.map(normalizeHistoryMatch);

      let p1Wins = 0, p2Wins = 0, draws = 0;
      matches.forEach(m => {
          if (m.score_home === m.score_away) {
              draws++;
          } else if (m.home_player === player1) {
              if (m.score_home > m.score_away) p1Wins++; 
              else p2Wins++;
          } else {
              if (m.score_away > m.score_home) p1Wins++; 
              else p2Wins++;
          }
      });
      
      const total = matches.length;

      return {
          total_matches: total,
          player1_wins: p1Wins,
          player2_wins: p2Wins,
          draws: draws,
          player1_win_percentage: total > 0 ? (p1Wins / total) * 100 : 0,
          player2_win_percentage: total > 0 ? (p2Wins / total) * 100 : 0,
          draw_percentage: total > 0 ? (draws / total) * 100 : 0,
          matches: matches,
          player1_stats: { games: p1Matches },
          player2_stats: { games: p2Matches }
      };
  } catch (e) {
      console.error("[Green365 H2H] Error:", e);
      console.warn(`[Fallback] Using rwtips API instead...`);
      return fetchH2HRwtips(player1, player2);
  }
};

const HISTORY_API_URL = 'https://api-v2.green365.com.br/api/v2/sport-events';

export const fetchHistoryGames = async (): Promise<HistoryMatch[]> => {
    try {
        console.log('[fetchHistoryGames] Starting to fetch recent games...');
        const pages = Array.from({ length: 5 }, (_, i) => i + 1);
        
        const green365Promises = pages.map(page => 
            fetch(`${HISTORY_API_URL}?page=${page}&limit=24&sport=esoccer&status=ended`, { 
                headers: { 
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                } 
            }).then(res => {
                if (!res.ok) console.error(`Green365 Fetch Error Page ${page}:`, res.status);
                return res.ok ? res.json() : null;
            }).catch(err => {
                console.error(`Green365 Fetch Failed Page ${page}:`, err);
                return null;
            })
        );

        const results = await Promise.all(green365Promises);
        let allMatches: any[] = [];
        
        results.forEach(data => {
            if (data) {
                if (data.items && Array.isArray(data.items)) allMatches = [...allMatches, ...data.items];
                else if (Array.isArray(data)) allMatches = [...allMatches, ...data];
            }
        });

        const normalized = allMatches.map(normalizeHistoryMatch);
        console.log(`[fetchHistoryGames] Loaded ${normalized.length} matches from ${pages.length} pages`);
        
        // Log sample of player names
        if (normalized.length > 0) {
            const sampleNames = normalized.slice(0, 3).map(m => 
                `"${m.home_player}" vs "${m.away_player}"`
            );
            console.log('[fetchHistoryGames] Sample player names:', sampleNames);
        }
        
        return normalized;
    } catch (error) {
        console.error("Error fetching history games:", error);
        return [];
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
        const url = `${RWTIPS_PLAYER_HISTORY_URL}?jogador=${encodeURIComponent(player)}&page=1&limit=${limit}`;
        
        const response = await fetch(url, {
            headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) {
            console.warn(`[Rwtips API] HTTP ${response.status} for player ${player}`);
            return [];
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
        return [];
    }
};

export const fetchPlayerHistory = async (player: string, limit: number = 20, playerId?: number, useRwtips: boolean = false): Promise<HistoryMatch[]> => {
    // If useRwtips is true (for live games), use rwtips API directly
    if (useRwtips) {
        return fetchPlayerHistoryRwtips(player, limit);
    }

    const cacheKey = `${player.toLowerCase()}-${playerId || 'noid'}-${limit}`;
    
    if (playerHistoryCache.has(cacheKey)) {
        const cached = playerHistoryCache.get(cacheKey)!;
        if (Date.now() - cached.timestamp < CACHE_TTL) {
            console.log(`[Cache Hit] Returning cached data for ${player}`);
            return cached.data;
        }
    }

    try {
        if (!playerId) {
            playerId = playerIdMap.get(player.toLowerCase());
            if (playerId) {
                console.log(`[ID Found] Player "${player}" → ID ${playerId}`);
            }
        }

        if (playerId) {
            const period = `${limit}g`;
            const url = `https://api-v2.green365.com.br/api/v2/analysis/participant/dynamic?sport=esoccer&participantID=${playerId}&participantName=${encodeURIComponent(player)}&period=${period}`;
            
            console.log(`[Green365 API] Fetching history for ${player} (ID: ${playerId})...`);
            
            const response = await fetch(url, { 
                headers: { 
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                } 
            });
            
            if (response.ok) {
                const data = await response.json();
                
                let rawEvents: any[] = [];
                
                if (data.info?.sessions?.sessionEvents?.events && Array.isArray(data.info.sessions.sessionEvents.events)) {
                    rawEvents = data.info.sessions.sessionEvents.events;
                } else if (data.sessions?.sessionEvents?.events && Array.isArray(data.sessions.sessionEvents.events)) {
                    rawEvents = data.sessions.sessionEvents.events;
                } else if (data.sessionEvents?.events && Array.isArray(data.sessionEvents.events)) {
                    rawEvents = data.sessionEvents.events;
                }

                if (rawEvents.length > 0) {
                    const result = rawEvents.map(normalizeHistoryMatch);
                    playerHistoryCache.set(cacheKey, { timestamp: Date.now(), data: result });
                    console.log(`[Green365 API] Found ${result.length} matches for ${player}`);
                    return result;
                }
            }
        }

        // Fallback to rwtips API
        console.warn(`[Fallback] Using rwtips API for ${player}...`);
        return fetchPlayerHistoryRwtips(player, limit);

    } catch (error) {
        console.error(`[Error] Error fetching history for player ${player}:`, error);
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
