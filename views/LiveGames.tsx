
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { fetchLiveGames, fetchPlayerHistory } from '../services/api';
import { LiveGame } from '../types';
import { Card } from '../components/ui/Card';
import { getLeagueConfig } from '../utils/format';
import { calculateHistoryPlayerStats, checkSuperClash } from '../utils/stats';
import { RefreshCw, Radio, Timer, Swords, ArrowRight, X, Flame } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// --- Types & Interfaces ---
interface GoalNotification {
    id: string;
    match: string;
    score: string;
    leagueColor: string;
}

// --- Helper Functions ---
const extractPlayerName = (fullName: string): string => {
    const match = fullName.match(/\((.*?)\)/);
    return match ? match[1] : fullName;
};

const extractTeamName = (fullName: string): string => {
    return fullName.split('(')[0].trim();
};

// --- Components ---

// 1. Toast Notification Component
const GoalToast: React.FC<{ notification: GoalNotification; onClose: (id: string) => void }> = ({ notification, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose(notification.id);
        }, 5000); 
        return () => clearTimeout(timer);
    }, [notification.id, onClose]);

    return (
        <div className="pointer-events-auto w-full max-w-sm overflow-hidden rounded-lg bg-surface border border-white/10 shadow-lg ring-1 ring-black ring-opacity-5 animate-slide-in-right transition-all duration-500">
            <div className="p-4 bg-gradient-to-r from-surfaceHighlight to-surface relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: notification.leagueColor }}></div>
                <div className="flex items-start">
                    <div className="flex-shrink-0">
                        <div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center animate-pulse">
                            <span className="text-xl">⚽</span>
                        </div>
                    </div>
                    <div className="ml-3 w-0 flex-1 pt-0.5">
                        <p className="text-sm font-black text-green-400 uppercase tracking-wider">GOL DETECTADO!</p>
                        <p className="mt-1 text-sm font-medium text-white truncate">{notification.match}</p>
                        <p className="mt-1 text-xs text-textMuted font-mono font-bold">{notification.score}</p>
                    </div>
                    <div className="ml-4 flex flex-shrink-0">
                        <button
                            type="button"
                            className="inline-flex rounded-md text-textMuted hover:text-white focus:outline-none"
                            onClick={() => onClose(notification.id)}
                        >
                            <span className="sr-only">Close</span>
                            <X size={16} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// 2. Individual Game Card Component
const LiveGameCard: React.FC<{ game: LiveGame, leagueColor: string }> = ({ game, leagueColor }) => {
    const navigate = useNavigate();
    const [isFlashing, setIsFlashing] = useState(false);
    const [isSuperClash, setIsSuperClash] = useState(false);
    const prevScoreRef = useRef(game.ss);
    const hasCheckedClash = useRef(false);

    useEffect(() => {
        if (prevScoreRef.current !== game.ss) {
            setIsFlashing(true);
            const timer = setTimeout(() => setIsFlashing(false), 3000); 
            prevScoreRef.current = game.ss;
            return () => clearTimeout(timer);
        }
    }, [game.ss]);

    // Check for Super Clash (Background fetch history)
    useEffect(() => {
        const checkClash = async () => {
            if (hasCheckedClash.current) return;
            hasCheckedClash.current = true;

            const p1 = extractPlayerName(game.home.name);
            const p2 = extractPlayerName(game.away.name);
            
            try {
                const [p1Hist, p2Hist] = await Promise.all([
                    fetchPlayerHistory(p1, 10),
                    fetchPlayerHistory(p2, 10)
                ]);
                
                const p1Stats = calculateHistoryPlayerStats(p1Hist, p1, 10);
                const p2Stats = calculateHistoryPlayerStats(p2Hist, p2, 10);

                if (p1Stats && p2Stats && checkSuperClash(p1Stats, p2Stats)) {
                    setIsSuperClash(true);
                }
            } catch (e) {
                console.warn("Failed to check super clash for live game", e);
            }
        };
        
        // Only check if game is live
        if (game.time_status === '1' || game.time_status === 'live') {
            checkClash();
        }
    }, []);

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

    // Status helpers
    const timeStatus = (game.time_status || '').toString().toLowerCase();
    const isLive = timeStatus === '1' || timeStatus === 'live';
    const isFinished = timeStatus === '3' || timeStatus.includes('ft') || timeStatus.includes('finish');
    const statusClass = isLive
        ? 'bg-green-500/20 text-green-400'
        : isFinished
        ? 'bg-purple-500/20 text-purple-400'
        : 'bg-red-500/20 text-red-400';
    const statusLabel = isLive ? 'AO VIVO' : isFinished ? 'FINALIZADO' : 'AGENDADO';

    return (
        <Card 
            className={`border-l-4 p-4 hover:bg-surfaceHighlight/20 transition-all group relative ${isFlashing ? 'animate-pulse ring-2 ring-accent bg-accent/10' : ''} ${isSuperClash ? 'ring-2 ring-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)]' : ''}`} 
            style={{ borderLeftColor: isSuperClash ? '#ef4444' : leagueColor }}
        >
            {/* Status badge */}
            <div className={`absolute top-0 right-0 px-2 py-1 rounded-bl text-[10px] font-bold ${statusClass}`}>
                {statusLabel}
            </div>

            {isSuperClash && (
                <div className="absolute top-0 left-0 right-0 flex justify-center -mt-3">
                    <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-lg flex items-center gap-1 animate-bounce">
                        <Flame size={10} fill="white" /> SUPER CLASH
                    </span>
                </div>
            )}

            <div className="flex justify-between items-center mb-4 mt-2">
                <div className="flex items-center gap-1 text-xs font-mono text-textMuted bg-black/20 px-2 py-1 rounded">
                    <Timer size={12} className={game.time_status === '1' ? 'text-green-400' : 'text-textMuted'} />
                    {game.timer?.tm ?? 0}'
                </div>
                <div className={`font-mono font-bold text-xl tracking-widest text-white transition-all duration-300 ${isFlashing ? 'text-green-400 scale-125' : ''}`}>
                    {game.ss}
                </div>
            </div>

            <div className="space-y-3 mb-4">
                <div className="flex justify-between items-center">
                    <div className="overflow-hidden">
                        <div className="font-bold text-white truncate max-w-[120px]" title={homePlayer}>{homePlayer}</div>
                        <div className="text-[10px] text-textMuted truncate max-w-[120px]" title={homeTeam}>{homeTeam}</div>
                    </div>
                    {game.scores && game.scores['1'] && (
                        <span className="text-xs text-textMuted opacity-50 whitespace-nowrap ml-2">
                            (HT: {game.scores['1'].home}-{game.scores['1'].away})
                        </span>
                    )}
                </div>
                <div className="flex justify-between items-center">
                    <div className="overflow-hidden">
                        <div className="font-bold text-white truncate max-w-[120px]" title={awayPlayer}>{awayPlayer}</div>
                        <div className="text-[10px] text-textMuted truncate max-w-[120px]" title={awayTeam}>{awayTeam}</div>
                    </div>
                </div>
            </div>

            <button 
                onClick={handleGoToH2H}
                className="w-full py-2 bg-white/5 hover:bg-accent hover:text-surface text-accent text-xs font-bold rounded flex items-center justify-center gap-2 transition-colors"
            >
                <Swords size={14} />
                ANALISAR H2H
                <ArrowRight size={14} />
            </button>
        </Card>
    );
};

// 3. Main Page Component
export const LiveGames: React.FC = () => {
    const [games, setGames] = useState<LiveGame[]>([]);
    const [loading, setLoading] = useState(true);
    
    const [notifications, setNotifications] = useState<GoalNotification[]>([]);
    const previousScores = useRef<Record<string, string>>({});
    const isFirstLoad = useRef(true);

    const addNotification = (notification: GoalNotification) => {
        setNotifications((prev) => [notification, ...prev]);
    };

    const removeNotification = (id: string) => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
    };

    const loadLive = async () => {
        if (isFirstLoad.current) setLoading(true);
        
        const data = await fetchLiveGames();
        
        // Goal Detection Logic
        data.forEach(game => {
            const prevScore = previousScores.current[game.id];
            const currentScore = game.ss;

            if (prevScore && prevScore !== currentScore && !isFirstLoad.current) {
                const leagueColor = getLeagueConfig(game.league.name).color;
                const home = extractPlayerName(game.home.name);
                const away = extractPlayerName(game.away.name);
                
                addNotification({
                    id: Date.now().toString() + game.id,
                    match: `${home} vs ${away}`,
                    score: currentScore,
                    leagueColor
                });
            }
            previousScores.current[game.id] = currentScore;
        });

        setGames(data);
        
        if (isFirstLoad.current) {
            setLoading(false);
            isFirstLoad.current = false;
        }
    };

    useEffect(() => {
        loadLive();
        const interval = setInterval(loadLive, 10000);
        return () => clearInterval(interval);
    }, []);

    const isLive = (g: LiveGame) => {
        const ts = (g.time_status || '').toString().toLowerCase();
        return ts === '1' || ts === 'live';
    };
    const isFinished = (g: LiveGame) => {
        const ts = (g.time_status || '').toString().toLowerCase();
        return ts === '3' || ts.includes('ft') || ts.includes('finish');
    };

    const groupedLiveGames = useMemo<Record<string, LiveGame[]>>(() => {
        const groups: Record<string, LiveGame[]> = {};
        games.filter(isLive).forEach(g => {
            const leagueName = g.league.name;
            if (!groups[leagueName]) groups[leagueName] = [];
            groups[leagueName].push(g);
        });
        return groups;
    }, [games]);

    const groupedLiveEntries = useMemo<[string, LiveGame[]][]>(
        () => Object.entries(groupedLiveGames) as [string, LiveGame[]][],
        [groupedLiveGames]
    );

    const finishedGames = useMemo<LiveGame[]>(() => games.filter(isFinished), [games]);

    return (
        <div className="space-y-6 animate-fade-in relative">
            
            <div className="fixed top-20 right-4 z-50 flex flex-col gap-2 w-full max-w-sm pointer-events-none">
                {notifications.map(n => (
                    <GoalToast key={n.id} notification={n} onClose={removeNotification} />
                ))}
            </div>

            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Radio className="text-red-500 animate-pulse" /> Jogos Ao Vivo
                </h2>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-textMuted animate-pulse flex items-center gap-1">
                        <span className="w-2 h-2 bg-green-500 rounded-full inline-block"></span>
                        Live
                    </span>
                    <button 
                        onClick={() => { isFirstLoad.current = true; loadLive(); }} 
                        className="p-2 bg-surfaceHighlight rounded-lg hover:bg-white/10 transition-colors text-textMuted hover:text-white"
                        disabled={loading}
                    >
                        <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                    </button>
                </div>
            </div>

            {loading && Object.keys(groupedLiveGames).length === 0 ? (
                <div className="flex justify-center py-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent"></div>
                </div>
            ) : Object.keys(groupedLiveGames).length === 0 ? (
                <div className="text-center py-20 text-textMuted bg-surface/30 rounded-xl border border-white/5">
                    <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-textMuted">
                        <Swords size={24} />
                    </div>
                    <p>Nenhum jogo ao vivo no momento.</p>
                </div>
            ) : (
                <div className="space-y-8">
                    {groupedLiveEntries.map(([leagueName, leagueGames]) => {
                        const leagueConfig = getLeagueConfig(leagueName);
                        
                        return (
                            <div key={leagueName} className="animate-slide-up">
                                <div className="flex items-center gap-2 mb-3 px-1">
                                    <div 
                                        className="w-1 h-6 rounded-full"
                                        style={{ backgroundColor: leagueConfig.color }}
                                    ></div>
                                    <h3 className="font-bold text-lg text-white">{leagueName}</h3>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {leagueGames.map(game => (
                                        <LiveGameCard 
                                            key={game.id} 
                                            game={game} 
                                            leagueColor={leagueConfig.color} 
                                        />
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {finishedGames.length > 0 && (
                <div className="mt-10 border-t border-white/5 pt-8">
                    <div className="flex items-center gap-2 mb-4 px-1 opacity-70">
                        <div className="w-1 h-6 rounded-full bg-purple-400"></div>
                        <h3 className="font-bold text-lg text-white">Finalizados Recentes</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {finishedGames.slice(0, 9).map((game) => {
                            const leagueColor = getLeagueConfig(game.league.name).color;
                            return (
                                <Card key={`finished-${game.id}`} className="border-l-4 p-4 bg-white/5 hover:bg-white/10 transition-colors" style={{ borderLeftColor: leagueColor }}>
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-xs font-mono text-textMuted">FT</span>
                                        <span className="text-xs px-2 py-0.5 rounded bg-purple-500/20 text-purple-400 font-bold">FINALIZADO</span>
                                    </div>
                                    <div className="text-white font-mono font-bold text-center text-lg">{game.ss}</div>
                                    <div className="text-[11px] text-textMuted mt-2 flex justify-between">
                                        <span className="truncate max-w-[45%]">{extractPlayerName(game.home.name)}</span>
                                        <span className="truncate max-w-[45%] text-right">{extractPlayerName(game.away.name)}</span>
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};