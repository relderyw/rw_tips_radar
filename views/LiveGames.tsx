import React, { useEffect, useState, useRef, useMemo } from 'react';
import { fetchLiveGames, fetchPlayerHistory } from '../services/api';
import { LiveGame, MatchPotential, HistoryPlayerStats, ConfrontationStats } from '../types';
import { Card } from '../components/ui/Card';
import { getLeagueConfig } from '../utils/format';
import { calculateHistoryPlayerStats, analyzeMatchPotential, calculateConfrontationStats } from '../utils/stats';
import { RefreshCw, Radio, Timer, Swords, ArrowRight, X, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// --- Interfaces ---
interface GoalNotification {
    id: string;
    match: string;
    score: string;
    leagueColor: string;
}

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
        <div className="pointer-events-auto w-full max-w-sm overflow-hidden rounded-lg bg-surface border border-white/10 shadow-lg ring-1 ring-black ring-opacity-5 animate-slide-in-right transition-all duration-500">
            <div className="p-4 bg-gradient-to-r from-surfaceHighlight to-surface relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: notification.leagueColor }}></div>
                <div className="flex items-start">
                    <div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center animate-pulse shrink-0">
                        <span className="text-xl">⚽</span>
                    </div>
                    <div className="ml-3 w-0 flex-1 pt-0.5">
                        <p className="text-sm font-black text-green-400 uppercase tracking-wider">GOL!</p>
                        <p className="mt-1 text-sm font-medium text-white truncate">{notification.match}</p>
                        <p className="mt-1 text-xs text-textMuted font-mono font-bold">{notification.score}</p>
                    </div>
                    <button className="ml-4 text-textMuted hover:text-white" onClick={() => onClose(notification.id)}>
                        <X size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
};

// Clean Signal Badge com tooltip
const SignalBadge: React.FC<{ label: string; color: string; icon?: React.ReactNode; tooltip?: string }> = ({ label, color, icon, tooltip }) => (
    <div className={`relative group flex items-center gap-1 px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider border bg-surfaceHighlight/50 ${color}`}>
        {icon}
        <span>{label}</span>
        {tooltip && (
            <div className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-black/90 text-white text-[10px] px-2 py-1 border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-lg">
                {tooltip}
            </div>
        )}
    </div>
);

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
    let borderColor = leagueColor;
    let ringClass = '';
    let bgClass = 'bg-surface/50';
    let potentialBadge = null;

    if (potential === 'top_clash') {
        borderColor = '#ef4444';
        ringClass = 'ring-1 ring-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.2)]';
        bgClass = 'bg-gradient-to-br from-surface to-red-900/10';
        potentialBadge = <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-red-500 to-transparent animate-pulse" />;
    } else if (potential === 'top_ht') {
        borderColor = '#eab308';
        ringClass = 'ring-1 ring-yellow-500/50';
        potentialBadge = <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-yellow-500 to-transparent" />;
    } else if (potential === 'top_ft') {
        borderColor = '#10b981';
        ringClass = 'ring-1 ring-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)]';
        potentialBadge = <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent" />;
    }

    const confStats = stats ? calculateConfrontationStats(stats.p1, stats.p2) : undefined;
    return (
        <Card className={`border-l-4 p-0 relative overflow-hidden transition-all hover:translate-y-[-2px] ${ringClass} ${bgClass}`} style={{ borderLeftColor: borderColor }}>
            {potentialBadge}
            
            {/* Header Status */}
            <div className="flex justify-between items-start p-3 pb-0">
                <div className="flex items-center gap-1 text-xs font-mono bg-black/30 px-2 py-0.5 rounded text-textMuted">
                    <Timer size={10} className={isLive ? 'text-green-400' : 'text-textMuted'} />
                    {game.timer?.tm ?? 0}'
                </div>
                <div className={`text-xs font-bold px-2 py-0.5 rounded ${isLive ? 'bg-green-500/10 text-green-400' : 'bg-white/5 text-textMuted'}`}>
                    {isLive ? 'AO VIVO' : 'AGENDADO'}
                </div>
            </div>

            {/* Match Content */}
            <div className="p-4 pt-2 flex flex-col gap-3">
                {/* Score & Teams */}
                <div className="flex justify-between items-center">
                    <div className="flex-1 min-w-0">
                        <div className="font-bold text-white text-sm truncate">{homePlayer}</div>
                        <div className="text-[10px] text-textMuted truncate">{homeTeam}</div>
                    </div>
                    
                    <div className={`font-mono font-black text-2xl px-3 ${isFlashing ? 'text-green-400 scale-110' : 'text-white'} transition-all`}>
                        {game.ss}
                    </div>

                    <div className="flex-1 min-w-0 text-right">
                        <div className="font-bold text-white text-sm truncate">{awayPlayer}</div>
                        <div className="text-[10px] text-textMuted truncate">{awayTeam}</div>
                    </div>
                </div>

                {/* HT Score */}
                {game.scores?.['1'] && (
                    <div className="text-center text-[10px] text-textMuted font-mono -mt-1 opacity-60">
                        HT: {game.scores['1'].home}-{game.scores['1'].away}
                    </div>
                )}

                {/* STATS AREA (The "Verdict") */}
                {loadingStats ? (
                    <div className="flex justify-center py-2">
                        <Loader2 size={14} className="animate-spin text-textMuted" />
                    </div>
                ) : stats ? (
                    <div className="space-y-2">
                        
                        {/* 1. Averages (Always Show) */}
                        <div className="flex justify-between items-center bg-black/20 rounded px-2 py-1.5">
                            <span className={`text-xs font-mono font-bold ${stats.p1.avgGoalsFT >= 2.7 ? 'text-green-400' : 'text-textMuted'}`}>
                                {stats.p1.avgGoalsFT}
                            </span>
                            <span className="text-[9px] uppercase text-textMuted font-bold tracking-widest">Média Gols FT</span>
                            <span className={`text-xs font-mono font-bold ${stats.p2.avgGoalsFT >= 2.7 ? 'text-green-400' : 'text-textMuted'}`}>
                                {stats.p2.avgGoalsFT}
                            </span>
                        </div>

                        
                        {confStats && (
                            <div className="mt-2 border border-white/10 rounded">
                                <div className="px-3 py-2 text-[10px] font-black text-white flex justify-between">
                                    <span>Confronto - 5 Jogos</span>
                                    <span className="text-textMuted">MD GOLS {confStats.avgGoalsFT}</span>
                                </div>
                                <div className="grid grid-cols-3 text-center text-[10px]">
                                    <div className="p-2 border-t border-white/10">
                                        <div className="text-accent font-black">HT</div>
                                        <div className="mt-2 grid grid-cols-2 gap-1">
                                            <div className="bg-black/30 px-2 py-1 rounded">+0.5<br/><span className="text-green-400 font-mono">{confStats.ht05Pct}%</span></div>
                                            <div className="bg-black/30 px-2 py-1 rounded">+1.5<br/><span className="text-yellow-400 font-mono">{confStats.ht15Pct}%</span></div>
                                            <div className="bg-black/30 px-2 py-1 rounded">+2.5<br/><span className="text-emerald-400 font-mono">{confStats.ht25Pct}%</span></div>
                                            <div className="bg-black/30 px-2 py-1 rounded">BTTS<br/><span className="text-purple-400 font-mono">{confStats.htBttsPct}%</span></div>
                                            <div className="bg-black/30 px-2 py-1 rounded">0 x 0<br/><span className="text-red-400 font-mono">{confStats.ht0x0Pct}%</span></div>
                                        </div>
                                    </div>
                                    <div className="p-2 border-t border-l border-white/10">
                                        <div className="text-accent font-black">FT</div>
                                        <div className="mt-2 grid grid-cols-2 gap-1">
                                            <div className="bg-black/30 px-2 py-1 rounded">+1.5<br/><span className="text-green-400 font-mono">{confStats.ft15Pct}%</span></div>
                                            <div className="bg-black/30 px-2 py-1 rounded">+2.5<br/><span className="text-emerald-400 font-mono">{confStats.ft25Pct}%</span></div>
                                            <div className="bg-black/30 px-2 py-1 rounded">+3.5<br/><span className="text-emerald-400 font-mono">{confStats.ft35Pct}%</span></div>
                                            <div className="bg-black/30 px-2 py-1 rounded">+4.5<br/><span className="text-emerald-400 font-mono">{confStats.ft45Pct}%</span></div>
                                            <div className="bg-black/30 px-2 py-1 rounded">BTTS<br/><span className="text-purple-400 font-mono">{confStats.ftBttsPct}%</span></div>
                                        </div>
                                    </div>
                                    <div className="p-2 border-t border-l border-white/10">
                                        <div className="text-accent font-black">Previsões</div>
                                        <div className="mt-2 space-y-1">
                                            {confStats.ht15Pct >= 85 && (
                                                <div className="bg-black/30 px-2 py-1 rounded">+1.5 HT <span className="text-yellow-400 font-mono">{confStats.ht15Pct}%</span></div>
                                            )}
                                            {confStats.ftBttsPct >= 85 && (
                                                <div className="bg-black/30 px-2 py-1 rounded">BTTS FT <span className="text-purple-400 font-mono">{confStats.ftBttsPct}%</span></div>
                                            )}
                                            <div className="bg-black/30 px-2 py-1 rounded">{confStats.avgGoalsFT} GOLS</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ) : null}
            </div>

            <button 
                onClick={handleGoToH2H}
                className="w-full py-2 bg-surfaceHighlight/50 hover:bg-accent hover:text-surface text-accent text-[10px] font-bold flex items-center justify-center gap-1 transition-colors border-t border-white/5"
            >
                <Swords size={12} /> ANALISAR DETALHES <ArrowRight size={12} />
            </button>
        </Card>
    );
};

export const LiveGames: React.FC = () => {
    const [games, setGames] = useState<LiveGame[]>([]);
    const [loading, setLoading] = useState(true);
    const [notifications, setNotifications] = useState<GoalNotification[]>([]);
    const [playerStatsCache, setPlayerStatsCache] = useState<Record<string, HistoryPlayerStats>>({});
    
    const previousScores = useRef<Record<string, string>>({});
    const isFirstLoad = useRef(true);

    const fetchMissingStats = async (liveGames: LiveGame[]) => {
        const playersToFetch = new Set<string>();
        
        console.log(`[LiveGames] Processing ${liveGames.length} live games`);
        
        liveGames.forEach(g => {
            if (g.time_status !== '1' && g.time_status !== 'live') return;
            const p1 = extractPlayerName(g.home.name);
            const p2 = extractPlayerName(g.away.name);
            
            console.log(`[LiveGames] Extracted players: ${p1} vs ${p2} (status: ${g.time_status})`);
            
            if (!playerStatsCache[p1]) playersToFetch.add(p1);
            if (!playerStatsCache[p2]) playersToFetch.add(p2);
        });

        console.log(`[LiveGames] Players to fetch: ${Array.from(playersToFetch).join(', ')}`);

        if (playersToFetch.size === 0) return;

        const queue = Array.from(playersToFetch);
        const BATCH_SIZE = 3;
        
        for (let i = 0; i < queue.length; i += BATCH_SIZE) {
            const batch = queue.slice(i, i + BATCH_SIZE);
            await Promise.all(batch.map(async (player) => {
                try {
                    console.log(`[LiveGames] Fetching history for ${player}...`);
                    const history = await fetchPlayerHistory(player, 10, undefined, true);
                    console.log(`[LiveGames] Got ${history.length} matches for ${player}`);
                    
                    const stats = calculateHistoryPlayerStats(history, player, 5);
                    if (stats) {
                        console.log(`[LiveGames] Calculated stats for ${player}:`, stats);
                        setPlayerStatsCache(prev => ({ ...prev, [player]: stats }));
                    } else {
                        console.warn(`[LiveGames] No stats calculated for ${player}`);
                    }
                } catch (e) { 
                    console.error(`[LiveGames] Failed stats for ${player}:`, e); 
                }
            }));
        }
    };

    const loadLive = async () => {
        if (isFirstLoad.current) setLoading(true);
        console.log('[LiveGames] Loading live games...');
        const data = await fetchLiveGames();
        console.log(`[LiveGames] Received ${data.length} live games`);
        
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
        // Remoção automática como failsafe em 6s
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

    const groupedLive = useMemo(() => {
        const groups: Record<string, LiveGame[]> = {};
        games.filter(isLive).forEach(g => {
            const ln = g.league.name;
            if (!groups[ln]) groups[ln] = [];
            groups[ln].push(g);
        });
        return Object.entries(groups);
    }, [games]);

    const finished = useMemo(() => games.filter(isFinished).slice(0, 12), [games]);

    return (
        <div className="space-y-6 animate-fade-in relative">
            <div className="fixed top-20 right-4 z-50 flex flex-col gap-2 w-full max-w-sm pointer-events-none">
                {notifications.map(n => <GoalToast key={n.id} notification={n} onClose={removeNotification} />)}
            </div>

            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Radio className="text-red-500 animate-pulse" /> Jogos Ao Vivo
                </h2>
                <button onClick={() => { isFirstLoad.current = true; loadLive(); }} className="p-2 bg-surfaceHighlight rounded hover:bg-white/10 text-textMuted">
                    <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                </button>
            </div>

            {loading && groupedLive.length === 0 ? (
                <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent"></div></div>
            ) : groupedLive.length === 0 ? (
                <div className="text-center py-20 text-textMuted bg-surface/30 rounded-xl border border-white/5"><p>Nenhum jogo ao vivo.</p></div>
            ) : (
                <div className="space-y-8">
                    {groupedLive.map(([leagueName, leagueGames]) => {
                        const conf = getLeagueConfig(leagueName);
                        return (
                            <div key={leagueName} className="animate-slide-up">
                                <div className="flex items-center gap-2 mb-3 px-1">
                                    <div className="w-1 h-6 rounded-full" style={{ backgroundColor: conf.color }}></div>
                                    <h3 className="font-bold text-lg text-white">{leagueName}</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {leagueGames.map(g => {
                                        const p1 = extractPlayerName(g.home.name);
                                        const p2 = extractPlayerName(g.away.name);
                                        const statsP1 = playerStatsCache[p1];
                                        const statsP2 = playerStatsCache[p2];
                                        
                                        let comboStats = undefined;
                                        if (statsP1 && statsP2) {
                                            comboStats = { 
                                                p1: statsP1, 
                                                p2: statsP2, 
                                                potential: analyzeMatchPotential(statsP1, statsP2) 
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

            {finished.length > 0 && (
                <div className="mt-10 border-t border-white/5 pt-8">
                    <div className="flex items-center gap-2 mb-4 px-1 opacity-70">
                        <div className="w-1 h-6 rounded-full bg-purple-400"></div>
                        <h3 className="font-bold text-lg text-white">Finalizados Recentes</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {finished.map(g => (
                            <Card key={g.id} className="p-3 bg-white/5 hover:bg-white/10 border-l-4" style={{ borderLeftColor: getLeagueConfig(g.league.name).color }}>
                                <div className="flex justify-between items-center text-[10px] text-textMuted mb-2">
                                    <span>FINALIZADO</span>
                                    <span className="font-mono font-bold text-white text-base">{g.ss}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="truncate max-w-[45%]">{extractPlayerName(g.home.name)}</span>
                                    <span className="truncate max-w-[45%] text-right">{extractPlayerName(g.away.name)}</span>
                                </div>
                            </Card>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
