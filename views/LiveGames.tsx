import React, { useEffect, useState, useRef, useMemo } from 'react';
import { fetchLiveGames, fetchPlayerHistory } from '../services/api';
import { LiveGame, MatchPotential, HistoryPlayerStats } from '../types';
import { Card } from '../components/ui/Card';
import { getLeagueConfig } from '../utils/format';
import { calculateHistoryPlayerStats, analyzeMatchPotential } from '../utils/stats';
import { RefreshCw, Radio, Timer, Swords, ArrowRight, X, Flame, Zap, Rocket, Loader2, Repeat } from 'lucide-react';
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
                        <p className="text-sm font-black text-green-400 uppercase tracking-wider">GOL DETECTADO!</p>
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

// New Component: Compact Signal Badge (Only shows if stat is good)
const StatSignal: React.FC<{ label: string; val: number; threshold: number; color: string; icon?: React.ReactNode }> = ({ label, val, threshold, color, icon }) => {
    if (val < threshold) return null; // Don't show if not relevant (Clean UI)
    
    return (
        <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${color}`}>
            {icon}
            <span>{label}</span>
            {val === 100 && <span className="text-[8px]">★</span>}
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

    let BadgeComponent = null;
    let borderColor = leagueColor;
    let ringClass = '';

    // Top Badges Logic
    if (potential === 'top_clash') {
        borderColor = '#ef4444';
        ringClass = 'ring-2 ring-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)]';
        BadgeComponent = <span className="bg-red-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse"><Flame size={10} fill="white" /> TOP CONFRONTO</span>;
    } else if (potential === 'top_ht') {
        borderColor = '#eab308';
        ringClass = 'ring-2 ring-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.4)]';
        BadgeComponent = <span className="bg-yellow-500 text-black text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse"><Zap size={10} fill="black" /> TOP HT</span>;
    } else if (potential === 'top_ft') {
        borderColor = '#10b981';
        ringClass = 'ring-2 ring-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)]';
        BadgeComponent = <span className="bg-emerald-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse"><Rocket size={10} fill="white" /> TOP FT</span>;
    }

    return (
        <Card className={`border-l-4 p-3 hover:bg-surfaceHighlight/20 transition-all group relative ${isFlashing ? 'animate-pulse ring-2 ring-accent bg-accent/10' : ''} ${ringClass}`} style={{ borderLeftColor: borderColor }}>
            <div className="absolute top-0 right-0 px-2 py-1 rounded-bl text-[9px] font-bold bg-black/40 text-textMuted flex items-center gap-1">
                {isLive && <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>}
                {isLive ? 'AO VIVO' : 'AGENDADO'}
            </div>

            {BadgeComponent && (
                <div className="absolute top-0 left-0 right-0 flex justify-center -mt-2.5">
                    {BadgeComponent}
                </div>
            )}

            {/* Score Board */}
            <div className="flex justify-between items-center mb-3 mt-1">
                <div className="flex items-center gap-1 text-xs font-mono text-textMuted bg-black/20 px-2 py-0.5 rounded">
                    <Timer size={12} className={isLive ? 'text-green-400' : 'text-textMuted'} />
                    {game.timer?.tm ?? 0}'
                </div>
                <div className={`font-mono font-bold text-xl tracking-widest text-white ${isFlashing ? 'text-green-400 scale-110' : ''}`}>
                    {game.ss}
                </div>
            </div>

            {/* Teams Info */}
            <div className="space-y-2 mb-3">
                <div className="flex justify-between items-center">
                    <div className="overflow-hidden">
                        <div className="font-bold text-white truncate max-w-[100px] text-xs">{homePlayer}</div>
                        <div className="text-[9px] text-textMuted truncate max-w-[100px]">{homeTeam}</div>
                    </div>
                    {game.scores?.['1'] && <span className="text-[10px] text-textMuted font-mono opacity-60">(HT {game.scores['1'].home}-{game.scores['1'].away})</span>}
                </div>
                <div className="flex justify-between items-center">
                    <div className="overflow-hidden">
                        <div className="font-bold text-white truncate max-w-[100px] text-xs">{awayPlayer}</div>
                        <div className="text-[9px] text-textMuted truncate max-w-[100px]">{awayTeam}</div>
                    </div>
                </div>
            </div>

            {/* SMART SIGNALS (Clean Layout) */}
            {loadingStats ? (
                <div className="bg-black/20 rounded p-1 mb-2 flex justify-center text-[9px] text-textMuted gap-1 h-[26px] items-center">
                    <Loader2 size={10} className="animate-spin" /> Analisando...
                </div>
            ) : stats ? (
                <div className="mb-3">
                    {/* Averages Row */}
                    <div className="flex justify-between items-center bg-white/5 rounded px-2 py-1 mb-1.5">
                        <span className={`text-[10px] font-mono font-bold ${stats.p1.avgGoalsFT >= 2.7 ? 'text-green-400' : 'text-textMuted'}`}>
                            {stats.p1.avgGoalsFT}
                        </span>
                        <span className="text-[8px] uppercase text-textMuted font-bold">Médias FT</span>
                        <span className={`text-[10px] font-mono font-bold ${stats.p2.avgGoalsFT >= 2.7 ? 'text-green-400' : 'text-textMuted'}`}>
                            {stats.p2.avgGoalsFT}
                        </span>
                    </div>

                    {/* Signals Row - Only High Probability Tags */}
                    <div className="flex flex-wrap justify-center gap-1.5">
                        {/* Player 1 Signals */}
                        <StatSignal label="HT+" val={stats.p1.htOver05Pct} threshold={90} color="text-blue-400 border-blue-500/30 bg-blue-500/5" />
                        <StatSignal label="BTTS" val={stats.p1.bttsPct} threshold={75} color="text-purple-400 border-purple-500/30 bg-purple-500/5" icon={<Repeat size={8}/>} />
                        
                        {/* Player 2 Signals */}
                        <StatSignal label="HT+" val={stats.p2.htOver05Pct} threshold={90} color="text-blue-400 border-blue-500/30 bg-blue-500/5" />
                        <StatSignal label="BTTS" val={stats.p2.bttsPct} threshold={75} color="text-purple-400 border-purple-500/30 bg-purple-500/5" icon={<Repeat size={8}/>} />
                    </div>
                    
                    {/* Empty State if no good stats */}
                    {stats.p1.htOver05Pct < 90 && stats.p2.htOver05Pct < 90 && stats.p1.bttsPct < 75 && stats.p2.bttsPct < 75 && (
                        <div className="text-center text-[9px] text-textMuted/30 italic py-0.5">Sem tendências fortes</div>
                    )}
                </div>
            ) : null}

            <button onClick={handleGoToH2H} className="w-full py-1.5 bg-white/5 hover:bg-accent hover:text-surface text-accent text-[10px] font-bold rounded flex items-center justify-center gap-1 transition-colors">
                <Swords size={12} /> ANALISAR
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
                    const history = await fetchPlayerHistory(player, 10);
                    const stats = calculateHistoryPlayerStats(history, player, 10);
                    if (stats) {
                        setPlayerStatsCache(prev => ({ ...prev, [player]: stats }));
                    }
                } catch (e) { console.warn(`Failed stats for ${player}`, e); }
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
                    id: Date.now() + game.id,
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

    const addNotification = (n: GoalNotification) => setNotifications(prev => [n, ...prev]);
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