
import { Game, H2HResponse, HistoryResponse, HistoryMatch, LiveGame } from '../types';

// Updated to Green365 API
const GAMES_API_URL = 'https://api-v2.green365.com.br/api/v2/sport-events';
const H2H_API_URL = 'https://rwtips-r943.onrender.com/api/v1/historico/confronto';

const PLAYER_HISTORY_API_URL = 'https://rwtips-r943.onrender.com/api/v1/historico/partidas-assincrono';
const LIVE_API_URL = 'https://rwtips-r943.onrender.com/api/matches/live';
const CAVEIRA_API_URL = 'https://esoccer.dev3.caveira.tips/v1/esoccer/search';
const CAVEIRA_TOKEN = 'Bearer oat_MTIyMDAw.dDJSVU5VSmxaSUcyYmZRMzljai1fU3BsekV1U2FlZmVvblJNNzRhdjIxNjE1MjcwODc';
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

const normalizeCaveiraMatch = (match: any): HistoryMatch => {
    // Capture IDs
    if (match.player_home_id && match.player_home_name) playerIdMap.set(match.player_home_name, match.player_home_id);
    if (match.player_away_id && match.player_away_name) playerIdMap.set(match.player_away_name, match.player_away_id);
    if (match.league_id && match.league_name) leagueIdMap.set(match.league_name, match.league_id);

    return {
        home_player: match.player_home_name,
        away_player: match.player_away_name,
        league_name: match.league_name,
        score_home: match.total_goals_home,
        score_away: match.total_goals_away,
        halftime_score_home: match.ht_goals_home,
        halftime_score_away: match.ht_goals_away,
        data_realizacao: match.time,
        home_team: match.player_home_team_name,
        away_team: match.player_away_team_name,
        home_id: match.player_home_id,
        away_id: match.player_away_id
    };
};

const fetchCaveiraHistory = async (): Promise<HistoryMatch[]> => {
    try {
        const pages = [0, 1, 2, 3, 4]; // 5 pages
        const limit = 20;

        const promises = pages.map(async (pageIndex) => {
            const offset = pageIndex * limit;
            
            // Construct filters based on user observation (offset only in filters if > 0? or always? 
            // User showed it in page 2. Safe to include or follow exact pattern. 
            // Pattern: Page 1 (offset 0) didn't have it in filters. Page 2 (offset 20) did.
            // Let's include it if offset > 0 to be precise, or maybe just always is fine but let's stick to the observed payload if possible.
            // Actually, usually APIs are consistent. If I send offset 0 in filters it probably works. 
            // But I'll stick to the user's exact payload structure to be safe.
            
            const filters: any = {
                status: 3,
                last_7_days: true,
                sort: "-time"
            };
            
            if (offset > 0) {
                filters.offset = offset;
            }

            try {
                const response = await fetch(CAVEIRA_API_URL, {
                    method: 'POST',
                    headers: {
                        'Authorization': CAVEIRA_TOKEN,
                        'Content-Type': 'application/json',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
                    },
                    body: JSON.stringify({
                        filters: filters,
                        query: {
                            sort: "-time",
                            limit: limit,
                            offset: offset
                        }
                    })
                });

                if (!response.ok) return [];
                const json = await response.json();
                if (json.success && json.data && Array.isArray(json.data.results)) {
                    return json.data.results.map(normalizeCaveiraMatch);
                }
                return [];
            } catch (e) {
                console.error(`Caveira Page ${pageIndex} Error:`, e);
                return [];
            }
        });

        const results = await Promise.all(promises);
        return results.flat();
    } catch (error) {
        console.error("Caveira API Error:", error);
        return [];
    }
};

const fetchCaveiraAnalysis = async (player1Id: number, player2Id: number, leagueId: number): Promise<H2HResponse | null> => {
    try {
        const response = await fetch('https://esoccer.dev3.caveira.tips/v1/esoccer/analysis', {
            method: 'POST',
            headers: {
                'Authorization': CAVEIRA_TOKEN,
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
            },
            body: JSON.stringify({
                league_id: String(leagueId),
                player_id_1: String(player1Id),
                player_id_2: String(player2Id),
                last_games: "all"
            })
        });

        if (!response.ok) return null;
        const json = await response.json();
        
        if (json.success && json.data) {
            const d = json.data;
            
            // Helper to normalize analysis matches
            const norm = (list: any[]): HistoryMatch[] => {
                if (!Array.isArray(list)) return [];
                return list.map(m => ({
                    home_player: m.player_home_name,
                    away_player: m.player_away_name,
                    league_name: m.league_name,
                    score_home: m.total_goals_home,
                    score_away: m.total_goals_away,
                    halftime_score_home: m.ht_goals_home,
                    halftime_score_away: m.ht_goals_away,
                    data_realizacao: m.time,
                    home_team: m.player_home_team_name,
                    away_team: m.player_away_team_name,
                    home_id: m.player_home_id,
                    away_id: m.player_away_id
                }));
            };

            const matches = norm(d.last_events);
            const p1Matches = norm(d.last_events_p1);
            const p2Matches = norm(d.last_events_p2);

            // Calculate wins/draws from matches
            let p1Wins = 0, p2Wins = 0, draws = 0;
            matches.forEach(m => {
                if (m.score_home === m.score_away) draws++;
                else if (m.home_id === player1Id) {
                    if (m.score_home > m.score_away) p1Wins++; else p2Wins++;
                } else {
                    if (m.score_away > m.score_home) p1Wins++; else p2Wins++;
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
        }
        return null;
    } catch (error) {
        console.error("Caveira Analysis Error:", error);
        return null;
    }
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

  // STRATEGY: Check for Adriatic League
  if (league.includes('Adriatic') || league.includes('10 mins play')) {
      // TRY CAVEIRA ANALYSIS FIRST (If we have IDs)
      const p1Id = playerIdMap.get(player1);
      const p2Id = playerIdMap.get(player2);
      const lId = leagueIdMap.get(league);

      if (p1Id && p2Id && lId) {
          const analysis = await fetchCaveiraAnalysis(p1Id, p2Id, lId);
          if (analysis) return analysis;
      }

      // FALLBACK TO GREEN365 (Old Logic)
      const url = `https://api.green365.com.br/api/e-soccer/event/stats?homeID=null&awayID=null&home=${encodeURIComponent(player1)}&away=${encodeURIComponent(player2)}&league=null&eventID=0&period=last_30`;
      
      try {
          const data = await tryFetch(url);
          
          if (data && data.gameMutualInformation && Array.isArray(data.gameMutualInformation.lastGames)) {
              const rawMatches = data.gameMutualInformation.lastGames;
              
              const matches: HistoryMatch[] = rawMatches.map((m: any) => {
                  const [homeScore, awayScore] = (m.score || "0-0").split('-').map(Number);
                  const [htHome, htAway] = (m.scoreHT || "0-0").split('-').map(Number);
                  
                  return {
                      home_player: m.home.includes('(') ? m.home.split('(')[1].replace(')', '') : m.home, // Extract name from "Team (Player)"
                      away_player: m.away.includes('(') ? m.away.split('(')[1].replace(')', '') : m.away,
                      score_home: homeScore,
                      score_away: awayScore,
                      halftime_score_home: htHome,
                      halftime_score_away: htAway,
                      data_realizacao: m.date ? new Date(m.timestamp * 1000).toISOString() : new Date().toISOString(),
                      home_team: m.home.includes('(') ? m.home.split('(')[0].trim() : undefined,
                      away_team: m.away.includes('(') ? m.away.split('(')[0].trim() : undefined
                  };
              });

              // Calculate stats manually since the API structure is different
              let p1WinsCount = 0;
              let p2WinsCount = 0;
              let drawsCount = 0;
              
              matches.forEach(m => {
                  // Normalize names for comparison (case insensitive, trim)
                  const hName = m.home_player.toLowerCase();
                  const p1Name = player1.toLowerCase();
                  
                  let p1IsHome = hName.includes(p1Name);
                  
                  if (m.score_home === m.score_away) {
                      drawsCount++;
                  } else if (m.score_home > m.score_away) {
                      if (p1IsHome) p1WinsCount++; else p2WinsCount++;
                  } else {
                      if (p1IsHome) p2WinsCount++; else p1WinsCount++;
                  }
              });

              const total = matches.length;
              
              return {
                  total_matches: total,
                  player1_wins: p1WinsCount,
                  player2_wins: p2WinsCount,
                  draws: drawsCount,
                  player1_win_percentage: total > 0 ? (p1WinsCount / total) * 100 : 0,
                  player2_win_percentage: total > 0 ? (p2WinsCount / total) * 100 : 0,
                  draw_percentage: total > 0 ? (drawsCount / total) * 100 : 0,
                  matches: matches,
                  player1_stats: data.players?.playerA,
                  player2_stats: data.players?.playerB
              };
          }
      } catch (e) {
          console.error("Error fetching Adriatic H2H:", e);
          // Fallback to standard flow if this fails
      }
  }

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

// const HISTORY_API_URL = 'https://rwtips-r943.onrender.com/api/historico/partidas'; // Old API
const RWTIPS_HISTORY_URL = 'https://rwtips-r943.onrender.com/api/historico/partidas'; // Old API (Source of Truth for Standard Leagues)
const HISTORY_API_URL = 'https://api-v2.green365.com.br/api/v2/sport-events'; // New API

export const fetchHistoryGames = async (): Promise<HistoryMatch[]> => {
    try {
        // STRATEGY: Fetch from BOTH APIs to ensure we have:
        // 1. Correct casing/names for Standard Leagues (from RWTips)
        // 2. Adriatic League data (from Green365)
        
        const pages = Array.from({ length: 10 }, (_, i) => i + 1); // Fetch 10 pages (1000 games)
        
        // 1. Fetch from RWTips (Old API) - Source of Truth for Standard Leagues
        const rwTipsPromises = pages.map(page => 
            fetch(`${CORS_PROXY}${RWTIPS_HISTORY_URL}?page=${page}&limit=100`, { 
                headers: { 'Accept': 'application/json' } 
            }).then(res => {
                if (!res.ok) console.error(`RWTips Fetch Error Page ${page}:`, res.status);
                return res.ok ? res.json() : null;
            }).catch(err => {
                console.error(`RWTips Fetch Failed Page ${page}:`, err);
                return null;
            })
        );

        // 2. Fetch from Green365 (REMOVED to avoid duplicates with Caveira)
        // const green365Promises = ...

        // 3. Fetch from Caveira API (New Source)
        const caveiraPromise = fetchCaveiraHistory();

        const results = await Promise.all([...rwTipsPromises, caveiraPromise]);
        let allMatches: any[] = [];

        // Handle Caveira results separately as they are already normalized
        const caveiraMatches = results.pop(); 
        
        results.forEach(data => {
            if (data) {
                // RWTips structure
                if (data.partidas && Array.isArray(data.partidas)) allMatches = [...allMatches, ...data.partidas];
                // Fallbacks
                else if (data.data && Array.isArray(data.data)) allMatches = [...allMatches, ...data.data];
                else if (Array.isArray(data)) allMatches = [...allMatches, ...data];
            }
        });

        const normalizedStandard = allMatches.map(normalizeHistoryMatch);
        
        // Merge with Caveira matches
        return [...normalizedStandard, ...(Array.isArray(caveiraMatches) ? caveiraMatches : [])];
    } catch (error) {
        console.error("Error fetching history games:", error);
        return [];
    }
};

// Simple in-memory cache
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes
const playerHistoryCache = new Map<string, { timestamp: number, data: HistoryMatch[] }>();

export const fetchPlayerHistory = async (player: string, limit: number = 20, playerId?: number): Promise<HistoryMatch[]> => {
    const cacheKey = `${player}-${playerId || 'noid'}-${limit}`;
    
    // Check Cache
    if (playerHistoryCache.has(cacheKey)) {
        const cached = playerHistoryCache.get(cacheKey)!;
        if (Date.now() - cached.timestamp < CACHE_TTL) {
            // console.log(`Cache hit for ${player}`);
            return cached.data;
        }
    }

    try {
        // STRATEGY 1: If we have a Player ID, use the Analysis API (Required for Adriatic)
        if (playerId) {
            const url = `https://api-v2.green365.com.br/api/v2/analysis/participant?sport=esoccer&participantID=${playerId}&participantName=${encodeURIComponent(player)}`;
            const response = await fetch(url, { headers: { 'Accept': 'application/json' } });
            
            if (response.ok) {
                const data = await response.json();
                // The structure is: sessions -> sessionEvents -> events
                // We need to find the 'events' array inside sessionEvents
                // Based on user sample: data.sessions.sessionEvents.events
                
                // However, the user sample showed:
                // sessions: { ... }
                // sessionEvents: { category: "events", events: [...] }
                // It seems 'sessionEvents' might be at the root or inside sessions?
                // Let's try to find 'events' array recursively or check specific paths.
                
                // User sample:
                // { sport: "esoccer", sessions: {...}, sessionEvents: { category: "events", events: [...] } }
                
                let rawEvents: any[] = [];
                
                if (data.sessionEvents && Array.isArray(data.sessionEvents.events)) {
                    rawEvents = data.sessionEvents.events;
                } else if (data.sessions && data.sessions.sessionEvents && Array.isArray(data.sessions.sessionEvents.events)) {
                     rawEvents = data.sessions.sessionEvents.events;
                }

                if (rawEvents.length > 0) {
                    const result = rawEvents.slice(0, limit).map(normalizeHistoryMatch);
                    playerHistoryCache.set(cacheKey, { timestamp: Date.now(), data: result });
                    return result;
                }
            }
        }

        // STRATEGY 2: Fallback to old API (Name based)
        const url = `${PLAYER_HISTORY_API_URL}?jogador=${encodeURIComponent(player)}&limit=${limit}&page=1`;
        const response = await fetch(url, { headers: { 'Accept': 'application/json' } });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        let rawMatches: any[] = [];

        if (data.partidas && Array.isArray(data.partidas)) rawMatches = data.partidas;
        else if (Array.isArray(data)) rawMatches = data;
        else if (data.matches && Array.isArray(data.matches)) rawMatches = data.matches;

        if (rawMatches.length > 0) {
            const result = rawMatches.map(normalizeHistoryMatch);
            playerHistoryCache.set(cacheKey, { timestamp: Date.now(), data: result });
            return result;
        }
        return [];

    } catch (error) {
        console.error(`Error fetching specific history for player ${player} (ID: ${playerId}):`, error);
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
