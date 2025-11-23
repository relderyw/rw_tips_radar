import { Game, H2HResponse, HistoryResponse, HistoryMatch, LiveGame } from '../types';

// Updated to Green365 API
const GAMES_API_URL = 'https://api-v2.green365.com.br/api/v2/sport-events';
const H2H_API_URL = 'https://rwtips-r943.onrender.com/api/v1/historico/confronto';
const RWTIPS_HISTORY_URL = 'https://rwtips-r943.onrender.com/api/historico/partidas'; // Old API (Source of Truth for Standard Leagues)
const HISTORY_API_URL = 'https://api-v2.green365.com.br/api/v2/sport-events'; // New API (Source for Adriatic)
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

// Helper to normalize player names (Title Case) for rwtips API
const formatPlayerName = (name: string): string => {
    if (!name) return "";
    return name.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

export const fetchH2H = async (player1: string, player2: string, league: string): Promise<H2HResponse | null> => {
  const tryFetch = async (url: string) => {
      const resp = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return await resp.json();
  };

  // STRATEGY: Check for Adriatic League
  if (league.includes('Adriatic') || league.includes('10 mins play')) {
      // Use raw names for Adriatic as they come from the same source (Green365)
      const url = `https://api.green365.com.br/api/e-soccer/event/stats?homeID=null&awayID=null&home=${encodeURIComponent(player1)}&away=${encodeURIComponent(player2)}&league=null&eventID=0&period=last_30`;
      
      try {
          const data = await tryFetch(url);
          if (data) {
              const matches = (data.gameMutualInformation?.lastGames || []).map((g: any) => ({
                  home_player: g.home.includes('(') ? g.home.split('(')[1].replace(')', '') : g.home,
                  away_player: g.away.includes('(') ? g.away.split('(')[1].replace(')', '') : g.away,
                  league_name: league,
                  score_home: Number((g.score || "0-0").split('-')[0]),
                  score_away: Number((g.score || "0-0").split('-')[1]),
                  halftime_score_home: Number((g.scoreHT || "0-0").split('-')[0]),
                  halftime_score_away: Number((g.scoreHT || "0-0").split('-')[1]),
                  data_realizacao: g.date ? new Date(g.timestamp * 1000).toISOString() : new Date().toISOString()
              }));

              const total = matches.length;
              const p1WinsCount = matches.filter((m: any) => m.score_home > m.score_away && m.home_player.includes(player1) || m.score_away > m.score_home && m.away_player.includes(player1)).length;
              const p2WinsCount = matches.filter((m: any) => m.score_home > m.score_away && m.home_player.includes(player2) || m.score_away > m.score_home && m.away_player.includes(player2)).length;
              const drawsCount = matches.filter((m: any) => m.score_home === m.score_away).length;

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
          console.error("Adriatic H2H Error:", e);
          return null;
      }
  } else {
      // Standard Leagues: Use rwtips API with NORMALIZED names
      const p1Formatted = formatPlayerName(player1);
      const p2Formatted = formatPlayerName(player2);
      const url = `${H2H_API_URL}/${encodeURIComponent(p1Formatted)}/${encodeURIComponent(p2Formatted)}?page=1&limit=20`;
      
      try {
          const data = await tryFetch(url);
          const matches = (data.confrontos || []).map(normalizeHistoryMatch);
          
          const total = data.total_jogos || matches.length;
          const p1Wins = data.vitorias_jogador1 || 0;
          const p2Wins = data.vitorias_jogador2 || 0;
          const draws = data.empates || 0;

          return {
              total_matches: total,
              player1_wins: p1Wins,
              player2_wins: p2Wins,
              draws: draws,
              player1_win_percentage: total > 0 ? (p1Wins / total) * 100 : 0,
              player2_win_percentage: total > 0 ? (p2Wins / total) * 100 : 0,
              draw_percentage: total > 0 ? (draws / total) * 100 : 0,
              matches: matches
          };
      } catch (e) {
          console.error("H2H Fetch Error:", e);
          return null;
      }
  }
  return null;
};

// Simple in-memory cache
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes
const playerHistoryCache = new Map<string, { timestamp: number, data: HistoryMatch[] }>();

const getCache = (key: string) => {
    if (playerHistoryCache.has(key)) {
        const cached = playerHistoryCache.get(key)!;
        if (Date.now() - cached.timestamp < CACHE_TTL) return cached.data;
    }
    return null;
};

const setCache = (key: string, data: HistoryMatch[]) => {
    playerHistoryCache.set(key, { timestamp: Date.now(), data });
};

export const fetchPlayerHistory = async (player: string, limit: number = 20): Promise<HistoryMatch[]> => {
    try {
        // Normalize name for rwtips API
        const formattedPlayer = formatPlayerName(player);
        const url = `${PLAYER_HISTORY_API_URL}?jogador=${encodeURIComponent(formattedPlayer)}&limit=${limit}&page=1`;
        
        // Check cache
        const cacheKey = `history_${formattedPlayer}_${limit}`;
        const cached = getCache(cacheKey);
        if (cached) return cached;

        const response = await fetch(url, { headers: { 'Accept': 'application/json' } });
        if (response.ok) {
            const data = await response.json();
            const matches = (data.partidas || data.data || []).map(normalizeHistoryMatch);
            setCache(cacheKey, matches);
            return matches;
        }
        return [];
    } catch (error) {
        console.error(`Error fetching specific history for player ${player}:`, error);
        return [];
    }
};

export const fetchHistoryGames = async (): Promise<HistoryMatch[]> => {
    try {
        // STRATEGY: Fetch from BOTH APIs to ensure we have:
        // 1. Correct casing/names for Standard Leagues (from RWTips)
        // 2. Adriatic League data (from Green365)
        
        const pages = [1, 2];
        
        // 1. Fetch from RWTips (Old API)
        const rwTipsPromises = pages.map(page => 
            fetch(`${RWTIPS_HISTORY_URL}?page=${page}&limit=100&sport=esoccer&status=ended`, { 
                headers: { 'Accept': 'application/json' } 
            }).then(res => res.ok ? res.json() : null)
        );

        // 2. Fetch from Green365 (New API)
        const green365Promises = pages.map(page => 
            fetch(`${HISTORY_API_URL}?page=${page}&limit=100&sport=esoccer&status=ended`, { 
                headers: { 'Accept': 'application/json' } 
            }).then(res => res.ok ? res.json() : null)
        );

        const results = await Promise.all([...rwTipsPromises, ...green365Promises]);
        let allMatches: any[] = [];

        results.forEach(data => {
            if (data) {
                // Green365 structure
                if (data.items && Array.isArray(data.items)) allMatches = [...allMatches, ...data.items];
                // RWTips structure
                else if (data.partidas && Array.isArray(data.partidas)) allMatches = [...allMatches, ...data.partidas];
                // Fallbacks
                else if (data.data && Array.isArray(data.data)) allMatches = [...allMatches, ...data.data];
                else if (Array.isArray(data)) allMatches = [...allMatches, ...data];
            }
        });

        return allMatches.map(normalizeHistoryMatch);
    } catch (error) {
        console.error("Error fetching history games:", error);
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
