import { H2HResponse, HistoryMatch, LiveGame } from '../types';

// API URLs - Simple rwtips only
const LIVE_API_URL = 'https://rwtips-r943.onrender.com/api/matches/live';
const RWTIPS_PLAYER_HISTORY_URL = 'https://rwtips-r943.onrender.com/api/v1/historico/partidas-assincrono';
const RWTIPS_H2H_URL = 'https://rwtips-r943.onrender.com/api/v1/historico/confronto';

// Cache
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes
const playerHistoryCache = new Map<string, { timestamp: number, data: HistoryMatch[] }>();
const h2hCache = new Map<string, { timestamp: number, data: H2HResponse }>();

// ==================== PLAYER HISTORY ====================

export const fetchPlayerHistory = async (player: string, limit: number = 20): Promise<HistoryMatch[]> => {
    const cacheKey = `${player.toLowerCase()}-${limit}`;
    
    // Check cache
    if (playerHistoryCache.has(cacheKey)) {
        const cached = playerHistoryCache.get(cacheKey)!;
        if (Date.now() - cached.timestamp < CACHE_TTL) {
            console.log(`[Cache] Using cached data for ${player}`);
            return cached.data;
        }
    }

    try {
        console.log(`[API] Fetching history for ${player}...`);
        const url = `${RWTIPS_PLAYER_HISTORY_URL}?jogador=${encodeURIComponent(player)}&page=1&limit=${limit}`;
        
        const response = await fetch(url, {
            headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        
        if (!data.partidas || !Array.isArray(data.partidas)) {
            throw new Error('Invalid response structure');
        }

        const matches: HistoryMatch[] = data.partidas.map((p: any) => ({
            home_player: p.home_player || "Desconhecido",
            away_player: p.away_player || "Desconhecido",
            league_name: p.league_name || "Desconhecida",
            score_home: Number(p.score_home ?? 0),
            score_away: Number(p.score_away ?? 0),
            halftime_score_home: Number(p.halftime_score_home ?? 0),
            halftime_score_away: Number(p.halftime_score_away ?? 0),
            data_realizacao: p.data_realizacao || new Date().toISOString()
        }));

        playerHistoryCache.set(cacheKey, { timestamp: Date.now(), data: matches });
        console.log(`[API] Found ${matches.length} matches for ${player}`);
        return matches;

    } catch (error) {
        console.error(`[API Error] Failed to fetch history for ${player}:`, error);
        throw new Error('MAINTENANCE'); // Signal maintenance error
    }
};

// ==================== HEAD TO HEAD ====================

export const fetchH2H = async (player1: string, player2: string): Promise<H2HResponse> => {
    const cacheKey = `${player1.toLowerCase()}-${player2.toLowerCase()}`;
    
    // Check cache
    if (h2hCache.has(cacheKey)) {
        const cached = h2hCache.get(cacheKey)!;
        if (Date.now() - cached.timestamp < CACHE_TTL) {
            console.log(`[Cache] Using cached H2H data for ${player1} vs ${player2}`);
            return cached.data;
        }
    }

    try {
        console.log(`[API] Fetching H2H: ${player1} vs ${player2}...`);
        const url = `${RWTIPS_H2H_URL}/${encodeURIComponent(player1)}/${encodeURIComponent(player2)}?page=1&limit=50`;
        
        const response = await fetch(url, {
            headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        
        if (!data.matches || !Array.isArray(data.matches)) {
            throw new Error('Invalid response structure');
        }

        const matches: HistoryMatch[] = data.matches.map((m: any) => ({
            home_player: m.home_player || "Desconhecido",
            away_player: m.away_player || "Desconhecido",
            league_name: m.league_name || "Desconhecida",
            score_home: Number(m.score_home ?? 0),
            score_away: Number(m.score_away ?? 0),
            halftime_score_home: Number(m.halftime_score_home ?? 0),
            halftime_score_away: Number(m.halftime_score_away ?? 0),
            data_realizacao: m.data_realizacao || new Date().toISOString()
        }));

        const result: H2HResponse = {
            total_matches: data.total_matches || 0,
            player1_wins: data.player1_wins || 0,
            player2_wins: data.player2_wins || 0,
            draws: data.draws || 0,
            player1_win_percentage: data.player1_win_percentage || 0,
            player2_win_percentage: data.player2_win_percentage || 0,
            draw_percentage: data.draw_percentage || 0,
            matches: matches,
            player1_stats: { games: [] }, // Will be fetched separately
            player2_stats: { games: [] }  // Will be fetched separately
        };

        h2hCache.set(cacheKey, { timestamp: Date.now(), data: result });
        console.log(`[API] Found ${result.total_matches} H2H matches`);
        return result;

    } catch (error) {
        console.error(`[API Error] Failed to fetch H2H for ${player1} vs ${player2}:`, error);
        throw new Error('MAINTENANCE'); // Signal maintenance error
    }
};

// ==================== LIVE GAMES ====================

export const fetchLiveGames = async (): Promise<LiveGame[]> => {
    try {
        const url = `${LIVE_API_URL}?_=${Date.now()}`;
        const response = await fetch(url, { 
            headers: { 'Accept': 'application/json' } 
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const json = await response.json();
        
        if (json && json.data && Array.isArray(json.data)) {
            return json.data;
        }
        
        return [];
    } catch (error) {
        console.error("[API Error] Failed to fetch live games:", error);
        return []; // Return empty array, not critical error
    }
};
