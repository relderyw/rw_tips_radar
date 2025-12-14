import React, { useEffect, useState, useRef, useMemo } from 'react';
import { fetchLiveGames, fetchPlayerHistory } from '../services/api';
import { LiveGame, MatchPotential, HistoryPlayerStats, ConfrontationStats } from '../types';
import { Card } from '../components/ui/Card';
import { getLeagueConfig } from '../utils/format';
import { calculateHistoryPlayerStats, analyzeMatchPotential, calculateConfrontationStats } from '../utils/stats';
import { RefreshCw, Radio, Timer, Swords, ArrowRight, X, Loader2, TrendingUp, Activity, Filter, Flame, Zap, Gem } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// --- Interfaces ---
interface GoalNotification {
    id: string;
    match: string;
    score: string;
    leagueColor: string;
}

type FilterType = 'all' | 'top_clash' | 'top_ht' | 'top_ft';

// --- Helpers ---
const extractPlayerName = (fullName: string): string => {
    const match = fullName.match(/\((.*?)\)/);
    return match ? match[1] : fullName;
};

const extractTeamName = (fullName: string): string => {
    return fullName.split('(')[0].trim();
};

// --- Components ---

// Toast
const GoalToast: React.FC<{ notification: GoalNotification; onClose: (id: string) => void }> = ({ notification, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(() => onClose(notification.id), 5000); 
        return () => clearTimeout(timer);
    }, [notification.id, onClose]);

    return (
        <div className="pointer-events-auto w-full max-w-sm overflow-hidden rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 backdrop-blur-xl border border-green-500/30 shadow-2xl shadow-green-500/20 animate-slide-in-right">
            <div className="p-4 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 to-transparent animate-pulse"></div>
                <div className="flex items-start relative z-10">
                    <div className="h-12 w-12 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg shrink-0">
                        <span className="text-2xl animate-bounce">⚽</span>
                    </div>
                    <div className="ml-3 flex-1">
                        <p className="text-sm font-black text-green-400 uppercase tracking-wider flex items-center gap-2">
                            <span className="inline-block w-2 h-2 bg-green-400 rounded-full animate-ping"></span>
                            GOL!
                        </p>
                        <p className="mt-1 text-sm font-bold text-white">{notification.match}</p>
                        <p className="mt-1 text-lg font-mono font-black text-white">{notification.score}</p>
                    </div>
                    <button className="ml-4 text-white/60 hover:text-white transition-colors" onClick={() => onClose(notification.id)}>
                        <X size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
};

// Stat Badge Compacto
const StatBadge: React.FC<{ label: string; value: string | number; color: string; icon?: React.ReactNode }> = ({ label, value, color, icon }) => (
    <div className={`flex items-center gap-1 px-2 py-1 rounded ${color} backdrop-blur-sm`}>
        {icon && <span className="opacity-80">{icon}</span>}
        <div className="flex flex-col leading-none">
            <span className="text-[8px] font-bold uppercase tracking-wide opacity-70">{label}</span>
            <span className="text-xs font-black font-mono">{value}</span>
        </div>
    </div>
);

// Metric Box Ultra Compacto
const MetricBox: React.FC<{ label: string; value: number }> = ({ label, value }) => {
    const getColor = () => {
        if (value >= 80) return 'text-green-400 border-green-500/40 bg-green-500/10';
        if (value >= 60) return 'text-yellow-400 border-yellow-500/40 bg-yellow-500/10';
        return 'text-red-400 border-red-500/40 bg-red-500/10';
    };

    return (
        <div className={`flex items-center justify-between px-2 py-1 rounded border ${getColor()} backdrop-blur-sm`}>
            <span className="text-[9px] font-bold uppercase tracking-wide opacity-70">{label}</span>
            <span className="text-sm font-black font-mono ml-2">{value}%</span>
        </div>
    );
};

const LiveGameCard: React.FC<{ 
    game: LiveGame; 
    leagueColor: string; 
    stats?: { p1: HistoryPlayerStats, p2: HistoryPlayerStats, potential: MatchPotential };
    loadingStats: boolean;
}> = ({ game, leagueColor, stats, loadingStats }) => {
    const navigate = useNavigate();
    const [isFlashing, setIsFlashing] = useState(false);
    const prevScoreRef = useRef(game.ss);

    useEffect(() => {
        if (prevScoreRef.current !== game.ss) {
            setIsFlashing(true);
            const timer = setTimeout(() => setIsFlashing(false), 3000); 
            prevScoreRef.current = game.ss;
            return () => clearTimeout(timer);
        }
    }, [game.ss]);

    const handleGoToH2H = () => {
        const p1 = extractPlayerName(game.home.name);
        const p2 = extractPlayerName(game.away.name);
        const league = game.league.name;
        navigate(`/h2h?league=${encodeURIComponent(league)}&p1=${encodeURIComponent(p1)}&p2=${encodeURIComponent(p2)}`);
    };

    const homePlayer = extractPlayerName(game.home.name);
    const awayPlayer = extractPlayerName(game.away.name);
    const homeTeam = extractTeamName(game.home.name);
    const awayTeam = extractTeamName(game.away.name);

    const isLive = (game.time_status || '').toString() === '1';
    const potential = stats?.potential || 'none';

    // Card Style Logic
    let gradientClass = 'from-surface/80 to-surfaceHighlight/80';
    let borderGlow = '';
    let potentialBadge = null;

    if (potential === 'top_clash') {
        gradientClass = 'from-red-950/50 to-red-900/30';
        borderGlow = 'shadow-[0_0_30px_rgba(239,68,68,0.3)] ring-2 ring-red-500/50';
        potentialBadge = (
            <div className="absolute -top-1 -right-1 px-2 py-0.5 bg-gradient-to-r from-red-600 to-red-500 rounded-full text-[9px] font-black uppercase tracking-wider shadow-lg z-10 animate-pulse flex items-center gap-1">
                <Flame size={10} /> TOP
            </div>
        );
    } else if (potential === 'top_ht') {
        gradientClass = 'from-yellow-950/40 to-yellow-900/20';
        borderGlow = 'ring-2 ring-yellow-500/40';
        potentialBadge = (
            <div className="absolute -top-1 -right-1 px-2 py-0.5 bg-gradient-to-r from-yellow-600 to-yellow-500 rounded-full text-[9px] font-black uppercase tracking-wider shadow-lg z-10 flex items-center gap-1">
                <Zap size={10} /> HT+
            </div>
        );
    } else if (potential === 'top_ft') {
        gradientClass = 'from-emerald-950/40 to-emerald-900/20';
        borderGlow = 'ring-2 ring-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.2)]';
        potentialBadge = (
            <div className="absolute -top-1 -right-1 px-2 py-0.5 bg-gradient-to-r from-emerald-600 to-emerald-500 rounded-full text-[9px] font-black uppercase tracking-wider shadow-lg z-10 flex items-center gap-1">
                <Gem size={10} /> FT+
            </div>
        );
    }

    const confStats = stats ? calculateConfrontationStats(stats.p1, stats.p2) : undefined;

    return (
        <Card className={`relative overflow-hidden transition-all duration-300 hover:translate-y-[-2px] hover:shadow-xl ${borderGlow} backdrop-blur-sm border-l-4`} 
              style={{ borderLeftColor: leagueColor }}>
            {potentialBadge}
            
            {/* Efeito de fundo */}
            <div className={`absolute inset-0 bg-gradient-to-br ${gradientClass} opacity-90`}></div>
            
            {/* Header ultra compacto */}
            <div className="relative z-10 flex justify-between items-center px-3 py-1.5 border-b border-white/10">
                <div className="flex items-center gap-1.5">
                    {isLive && (
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                        </span>
                    )}
                    <div className="flex items-center gap-1 text-[10px] font-mono font-bold">
                        <Timer size={10} className={isLive ? 'text-green-400' : 'text-textMuted'} />
                        <span className={isLive ? 'text-green-400' : 'text-textMuted'}>{game.timer?.tm ?? 0}'</span>
                    </div>
                </div>
                <div className={`text-[9px] font-black px-2 py-0.5 rounded-full ${isLive ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-white/5 text-textMuted'}`}>
                    {isLive ? 'LIVE' : 'SOON'}
                </div>
            </div>

            {/* Área do Jogo - Compacto */}
            <div className="relative z-10 p-3">
                {/* Players e Score */}
                <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center mb-2">
                    {/* Home */}
                    <div className="text-left min-w-0">
                        <div className="font-black text-sm text-white truncate">{homePlayer}</div>
                        <div className="text-[9px] text-textMuted/70 truncate">{homeTeam}</div>
                    </div>
                    
                    {/* Score */}
                    <div className="flex flex-col items-center gap-0.5">
                        <div className={`font-mono font-black text-3xl tracking-tight px-3 py-1 rounded-lg bg-black/30 backdrop-blur-sm border border-white/10 ${isFlashing ? 'text-green-400 scale-110 shadow-lg shadow-green-500/50' : 'text-white'} transition-all duration-300`}>
                            {game.ss}
                        </div>
                        {game.scores?.['1'] && (
                            <div className="text-[8px] text-textMuted/60 font-mono font-bold bg-black/20 px-1.5 py-0.5 rounded">
                                HT {game.scores['1'].home}-{game.scores['1'].away}
                            </div>
                        )}
                    </div>

                    {/* Away */}
                    <div className="text-right min-w-0">
                        <div className="font-black text-sm text-white truncate">{awayPlayer}</div>
                        <div className="text-[9px] text-textMuted/70 truncate">{awayTeam}</div>
                    </div>
                </div>

                {/* Stats Section - Compacto */}
                {loadingStats ? (
                    <div className="flex justify-center py-2">
                        <Loader2 size={14} className="animate-spin text-accent" />
                    </div>
                ) : stats ? (
                    <div className="space-y-2">
                        {/* Média de Gols */}
                        <div className="grid grid-cols-2 gap-1.5">
                            <StatBadge 
                                label="MD" 
                                value={stats.p1.avgGoalsFT}
                                color={stats.p1.avgGoalsFT >= 2.7 ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-white/5 text-textMuted border border-white/10'}
                                icon={<TrendingUp size={10} />}
                            />
                            <StatBadge 
                                label="MD" 
                                value={stats.p2.avgGoalsFT}
                                color={stats.p2.avgGoalsFT >= 2.7 ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-white/5 text-textMuted border border-white/10'}
                                icon={<TrendingUp size={10} />}
                            />
                        </div>

                        {/* Confronto Direto */}
                        {confStats && (
                            <div className="border border-white/10 rounded-lg bg-black/20 backdrop-blur-sm overflow-hidden">
                                {/* Header */}
                                <div className="px-2 py-1 bg-gradient-to-r from-accent/20 to-transparent border-b border-white/10 flex justify-between items-center">
                                    <span className="text-[9px] font-black text-accent uppercase tracking-wider flex items-center gap-1">
                                        <Activity size={9} />
                                        CONFRONTO DIRETO
                                    </span>
                                    <span className="text-[8px] font-mono font-bold text-white bg-white/10 px-1.5 py-0.5 rounded">
                                        MD: {confStats.avgGoalsFT}
                                    </span>
                                </div>

                                {/* Grid Compacto */}
                                <div className="p-2">
                                    <div className="grid grid-cols-2 gap-2">
                                        {/* HT */}
                                        <div className="space-y-1">
                                            <div className="text-[8px] font-black text-yellow-400 uppercase tracking-wider mb-0.5 flex items-center gap-0.5">
                                                <span className="w-1 h-1 bg-yellow-400 rounded-full"></span>
                                                HT STATS
                                            </div>
                                            <MetricBox label="+0.5" value={confStats.ht05Pct} />
                                            <MetricBox label="+1.5" value={confStats.ht15Pct} />
                                            <MetricBox label="BTTS" value={confStats.htBttsPct} />
                                        </div>
                                        
                                        {/* FT */}
                                        <div className="space-y-1">
                                            <div className="text-[8px] font-black text-emerald-400 uppercase tracking-wider mb-0.5 flex items-center gap-0.5">
                                                <span className="w-1 h-1 bg-emerald-400 rounded-full"></span>
                                                FT STATS
                                            </div>
                                            <MetricBox label="+1.5" value={confStats.ft15Pct} />
                                            <MetricBox label="+2.5" value={confStats.ft25Pct} />
                                            <MetricBox label="BTTS" value={confStats.ftBttsPct} />
                                        </div>
                                    </div>

                                    {/* Previsões Fortes */}
                                    {(confStats.ht15Pct >= 85 || confStats.ftBttsPct >= 85 || confStats.ft25Pct >= 85) && (
                                        <div className="mt-2 pt-2 border-t border-white/10">
                                            <div className="text-[8px] font-black text-purple-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                                                🎯 PREVISÕES FORTES
                                            </div>
                                            <div className="flex flex-wrap gap-1">
                                                {confStats.ht15Pct >= 85 && (
                                                    <div className="px-1.5 py-0.5 bg-yellow-500/20 border border-yellow-500/30 rounded text-[9px] font-bold text-yellow-400">
                                                        +2.5 FT ({confStats.ft25Pct}%)
                                                    </div>
                                                )}
                                                {confStats.ftBttsPct >= 85 && (
                                                    <div className="px-1.5 py-0.5 bg-purple-500/20 border border-purple-500/30 rounded text-[9px] font-bold text-purple-400">
                                                        BTTS ({confStats.ftBttsPct}%)
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                ) : null}
            </div>

            {/* Footer Button */}
            <button 
                onClick={handleGoToH2H}
                className="relative z-10 w-full py-2 bg-gradient-to-r from-accent/20 to-accent/10 hover:from-accent hover:to-accent/80 text-accent hover:text-surface text-[10px] font-black flex items-center justify-center gap-1.5 transition-all duration-300 border-t border-white/10 uppercase tracking-wider group"
            >
                <Swords size={12} className="group-hover:rotate-12 transition-transform" />
                ANÁLISE COMPLETA
                <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
            </button>
        </Card>
    );
};

// Filter Button Component
const FilterButton: React.FC<{ 
    active: boolean; 
    onClick: () => void; 
    icon: React.ReactNode; 
    label: string;
    count?: number;
}> = ({ active, onClick, icon, label, count }) => (
    <button
        onClick={onClick}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-all ${
            active 
                ? 'bg-accent text-surface shadow-lg shadow-accent/30' 
                : 'bg-surfaceHighlight/50 text-textMuted hover:bg-white/10 border border-white/10'
        }`}
    >
        {icon}
        <span>{label}</span>
        {count !== undefined && count > 0 && (
            <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-black ${
                active ? 'bg-surface/30' : 'bg-accent/20 text-accent'
            }`}>
                {count}
            </span>
        )}
    </button>
);

export const LiveGames: React.FC = () => {
    const [games, setGames] = useState<LiveGame[]>([]);
    const [loading, setLoading] = useState(true);
    const [notifications, setNotifications] = useState<GoalNotification[]>([]);
    const [playerStatsCache, setPlayerStatsCache] = useState<Record<string, HistoryPlayerStats>>({});
    const [filter, setFilter] = useState<FilterType>('all');
    
    const previousScores = useRef<Record<string, string>>({});
    const isFirstLoad = useRef(true);

    const fetchMissingStats = async (liveGames: LiveGame[]) => {
        const playersToFetch = new Set<string>();
        
        liveGames.forEach(g => {
            if (g.time_status !== '1' && g.time_status !== 'live') return;
            const p1 = extractPlayerName(g.home.name);
            const p2 = extractPlayerName(g.away.name);
            
            if (!playerStatsCache[p1]) playersToFetch.add(p1);
            if (!playerStatsCache[p2]) playersToFetch.add(p2);
        });

        if (playersToFetch.size === 0) return;

        const queue = Array.from(playersToFetch);
        const BATCH_SIZE = 3;
        
        for (let i = 0; i < queue.length; i += BATCH_SIZE) {
            const batch = queue.slice(i, i + BATCH_SIZE);
            await Promise.all(batch.map(async (player) => {
                try {
                    const history = await fetchPlayerHistory(player, 10, undefined, true);
                    const stats = calculateHistoryPlayerStats(history, player, 5);
                    if (stats) {
                        setPlayerStatsCache(prev => ({ ...prev, [player]: stats }));
                    }
                } catch (e) { 
                    console.error(`Failed stats for ${player}:`, e); 
                }
            }));
        }
    };

    const loadLive = async () => {
        if (isFirstLoad.current) setLoading(true);
        const data = await fetchLiveGames();
        
        data.forEach(game => {
            const prev = previousScores.current[game.id];
            const curr = game.ss;
            if (prev && prev !== curr && !isFirstLoad.current) {
                addNotification({
                    id: `${Date.now()}-${game.id}`,
                    match: `${extractPlayerName(game.home.name)} vs ${extractPlayerName(game.away.name)}`,
                    score: curr,
                    leagueColor: getLeagueConfig(game.league.name).color
                });
            }
            previousScores.current[game.id] = curr;
        });

        setGames(data);
        if (isFirstLoad.current) {
            setLoading(false);
            isFirstLoad.current = false;
        }
        
        fetchMissingStats(data);
    };

    useEffect(() => {
        loadLive();
        const interval = setInterval(loadLive, 10000);
        return () => clearInterval(interval);
    }, []);

    const addNotification = (n: GoalNotification) => {
        setNotifications(prev => [n, ...prev]);
        window.setTimeout(() => {
            removeNotification(n.id);
        }, 6000);
    };
    const removeNotification = (id: string) => setNotifications(prev => prev.filter(n => n.id !== id));

    const isLive = (g: LiveGame) => (g.time_status || '').toString() === '1';
    const isFinished = (g: LiveGame) => {
        const ts = (g.time_status || '').toString().toLowerCase();
        return ts === '3' || ts.includes('ft') || ts.includes('finish');
    };

    // Calculate potentials for all games
    const gamesWithPotential = useMemo(() => {
        return games.filter(isLive).map(g => {
            const p1 = extractPlayerName(g.home.name);
            const p2 = extractPlayerName(g.away.name);
            const statsP1 = playerStatsCache[p1];
            const statsP2 = playerStatsCache[p2];
            
            let potential: MatchPotential = 'none';
            if (statsP1 && statsP2) {
                potential = analyzeMatchPotential(statsP1, statsP2);
            }
            
            return { game: g, potential };
        });
    }, [games, playerStatsCache]);

    // Filter games based on selected filter
    const filteredGames = useMemo(() => {
        if (filter === 'all') return gamesWithPotential;
        return gamesWithPotential.filter(({ potential }) => potential === filter);
    }, [gamesWithPotential, filter]);

    // Count by filter type
    const filterCounts = useMemo(() => {
        const counts = {
            all: gamesWithPotential.length,
            top_clash: 0,
            top_ht: 0,
            top_ft: 0
        };
        gamesWithPotential.forEach(({ potential }) => {
            if (potential === 'top_clash') counts.top_clash++;
            if (potential === 'top_ht') counts.top_ht++;
            if (potential === 'top_ft') counts.top_ft++;
        });
        return counts;
    }, [gamesWithPotential]);

    const groupedLive = useMemo(() => {
        const groups: Record<string, typeof filteredGames> = {};
        filteredGames.forEach(item => {
            const ln = item.game.league.name;
            if (!groups[ln]) groups[ln] = [];
            groups[ln].push(item);
        });
        return Object.entries(groups);
    }, [filteredGames]);

    const finished = useMemo(() => games.filter(isFinished).slice(0, 12), [games]);

    return (
        <div className="space-y-6 animate-fade-in relative">
            {/* Notifications */}
            <div className="fixed top-20 right-4 z-50 flex flex-col gap-2 w-full max-w-sm pointer-events-none">
                {notifications.map(n => <GoalToast key={n.id} notification={n} onClose={removeNotification} />)}
            </div>

            {/* Header */}
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-black text-white flex items-center gap-3">
                    Jogos Ao Vivo
                </h2>
                <button 
                    onClick={() => { isFirstLoad.current = true; loadLive(); }} 
                    className="p-3 bg-surfaceHighlight/50 rounded-xl hover:bg-accent/20 text-textMuted hover:text-accent transition-all border border-white/10 hover:border-accent/30"
                >
                    <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
                </button>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-wrap gap-2 p-4 bg-surface/50 rounded-xl border border-white/10 backdrop-blur-sm">
                <div className="flex items-center gap-2 mr-2">
                    <Filter size={16} className="text-accent" />
                    <span className="text-xs font-bold text-textMuted uppercase">Filtrar:</span>
                </div>
                <FilterButton
                    active={filter === 'all'}
                    onClick={() => setFilter('all')}
                    icon={<Activity size={14} />}
                    label="Todos"
                    count={filterCounts.all}
                />
                <FilterButton
                    active={filter === 'top_clash'}
                    onClick={() => setFilter('top_clash')}
                    icon={<Flame size={14} />}
                    label="Top Clash"
                    count={filterCounts.top_clash}
                />
                <FilterButton
                    active={filter === 'top_ht'}
                    onClick={() => setFilter('top_ht')}
                    icon={<Zap size={14} />}
                    label="HT+"
                    count={filterCounts.top_ht}
                />
                <FilterButton
                    active={filter === 'top_ft'}
                    onClick={() => setFilter('top_ft')}
                    icon={<Gem size={14} />}
                    label="FT+"
                    count={filterCounts.top_ft}
                />
            </div>

            {/* Loading State */}
            {loading && groupedLive.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <div className="animate-spin rounded-full h-16 w-16 border-4 border-accent/20 border-t-accent"></div>
                    <p className="text-textMuted text-sm">Carregando jogos ao vivo...</p>
                </div>
            ) : groupedLive.length === 0 ? (
                <div className="text-center py-20 bg-gradient-to-br from-surface/50 to-surfaceHighlight/50 rounded-2xl border border-white/10 backdrop-blur-sm">
                    <Filter className="mx-auto mb-4 text-textMuted opacity-50" size={48} />
                    <p className="text-textMuted text-lg">
                        {filter === 'all' ? 'Nenhum jogo ao vivo no momento.' : 'Nenhum jogo encontrado com este filtro.'}
                    </p>
                </div>
            ) : (
                <div className="space-y-8">
                    {groupedLive.map(([leagueName, leagueGamesWithPotential]) => {
                        const conf = getLeagueConfig(leagueName);
                        return (
                            <div key={leagueName} className="animate-slide-up">
                                <div className="flex items-center gap-3 mb-4 px-1">
                                    <div className="w-1.5 h-8 rounded-full shadow-lg" style={{ backgroundColor: conf.color }}></div>
                                    <h3 className="font-black text-xl text-white">{leagueName}</h3>
                                    <div className="h-px flex-1 bg-gradient-to-r from-white/20 to-transparent"></div>
                                </div>
                                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
                                    {leagueGamesWithPotential.map(({ game: g, potential }) => {
                                        const p1 = extractPlayerName(g.home.name);
                                        const p2 = extractPlayerName(g.away.name);
                                        const statsP1 = playerStatsCache[p1];
                                        const statsP2 = playerStatsCache[p2];
                                        
                                        let comboStats = undefined;
                                        if (statsP1 && statsP2) {
                                            comboStats = { 
                                                p1: statsP1, 
                                                p2: statsP2, 
                                                potential 
                                            };
                                        }

                                        return (
                                            <LiveGameCard 
                                                key={g.id} 
                                                game={g} 
                                                leagueColor={conf.color}
                                                stats={comboStats}
                                                loadingStats={!statsP1 || !statsP2}
                                            />
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Finished Games */}
            {finished.length > 0 && (
                <div className="mt-10 border-t border-white/10 pt-8">
                    <div className="flex items-center gap-3 mb-4 px-1 opacity-80">
                        <div className="w-1.5 h-8 rounded-full bg-purple-400 shadow-lg"></div>
                        <h3 className="font-black text-xl text-white">Finalizados Recentes</h3>
                        <div className="h-px flex-1 bg-gradient-to-r from-white/20 to-transparent"></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {finished.map(g => (
                            <Card key={g.id} className="p-3 bg-gradient-to-br from-surface/50 to-surfaceHighlight/50 hover:from-white/10 hover:to-white/5 border-l-4 transition-all backdrop-blur-sm" style={{ borderLeftColor: getLeagueConfig(g.league.name).color }}>
                                <div className="flex justify-between items-center text-[10px] text-textMuted mb-2">
                                    <span className="font-bold uppercase tracking-wider">Finalizado</span>
                                    <span className="font-mono font-bold text-white text-lg">{g.ss}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="truncate max-w-[45%] font-semibold text-white">{extractPlayerName(g.home.name)}</span>
                                    <span className="truncate max-w-[45%] text-right font-semibold text-white">{extractPlayerName(g.away.name)}</span>
                                </div>
                            </Card>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};