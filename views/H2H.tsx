
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { fetchH2H, fetchHistoryGames, fetchPlayerHistory } from '../services/api';
import { H2HResponse, HistoryMatch, HistoryPlayerStats, LeagueStats, Projection } from '../types';
import { calculateH2HStats, calculateHistoryPlayerStats, calculateLeagueStatsFromHistory, generateProjections } from '../utils/stats';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Swords, AlertCircle, RefreshCw, BrainCircuit, Target, Scale, ChevronDown, Search, X, Zap } from 'lucide-react';
import { formatDateSafe } from '../utils/format';
import { LineChart, Line, XAxis, Tooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area } from 'recharts';
import { useSearchParams } from 'react-router-dom';

// --- Visual Components ---

// 1. Player Consistency Chart
const PlayerConsistencyChart: React.FC<{ matches: HistoryMatch[], playerName: string, color: string }> = ({ matches, playerName, color }) => {
    const data = useMemo(() => {
        const chronological = [...matches].reverse();
        let accScored = 0;
        let accConceded = 0;

        return chronological.map((m, i) => {
            const isHome = m.home_player === playerName;
            const scored = isHome ? m.score_home : m.score_away;
            const conceded = isHome ? m.score_away : m.score_home;

            accScored += scored;
            accConceded += conceded;

            return {
                game: i + 1,
                scored: accScored,
                conceded: accConceded
            };
        });
    }, [matches, playerName]);

    if (data.length < 2) return <div className="h-24 flex items-center justify-center text-xs text-textMuted italic">Sem dados suficientes</div>;

    return (
        <div className="h-32 w-full mt-2 bg-white/5 rounded-lg p-2 border border-white/5">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                    <defs>
                        <linearGradient id={`grad${playerName.replace(/\s/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
                            <stop offset="95%" stopColor={color} stopOpacity={0}/>
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                    <XAxis dataKey="game" hide />
                    <Tooltip 
                        contentStyle={{ backgroundColor: '#18181b', borderColor: '#ffffff10', fontSize: '12px' }}
                        itemStyle={{ padding: 0 }}
                        labelStyle={{ display: 'none' }}
                        formatter={(value, name) => [value, name === 'scored' ? 'Gols Pró (Acum)' : 'Gols Sofridos (Acum)']}
                    />
                    <Area 
                        type="monotone" 
                        dataKey="scored" 
                        stroke={color} 
                        fill={`url(#grad${playerName.replace(/\s/g, '')})`}
                        strokeWidth={2} 
                        name="scored"
                    />
                    <Line 
                        type="monotone" 
                        dataKey="conceded" 
                        stroke="#ef4444" 
                        strokeWidth={2} 
                        dot={false} 
                        name="conceded"
                        strokeDasharray="3 3"
                    />
                </AreaChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-4 mt-1 text-[9px] text-textMuted uppercase font-bold">
                <span style={{ color }}>● Acumulado Pró</span>
                <span className="text-red-500">● Acumulado Contra</span>
            </div>
        </div>
    );
};

// 2. Searchable Select
const SearchableSelect: React.FC<{
    options: string[];
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
    disabled?: boolean;
}> = ({ options, value, onChange, placeholder, disabled }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState(value);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setSearch(value);
    }, [value]);

    const filteredOptions = useMemo(() => {
        if (!search) return options;
        return options.filter(opt => opt.toLowerCase().includes(search.toLowerCase()));
    }, [options, search]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSelect = (opt: string) => {
        onChange(opt);
        setSearch(opt);
        setIsOpen(false);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setSearch(val);
        onChange(val);
        setIsOpen(true);
    };

    const clearInput = (e: React.MouseEvent) => {
        e.stopPropagation();
        setSearch('');
        onChange('');
        setIsOpen(true);
    };

    return (
        <div className="relative" ref={wrapperRef}>
            <div className="relative">
                <input
                    type="text"
                    className={`w-full bg-surfaceHighlight text-white border border-white/10 rounded-lg px-3 py-2 pr-8 outline-none focus:border-accent transition-colors ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    value={search}
                    onChange={handleInputChange}
                    onClick={() => !disabled && setIsOpen(true)}
                    onFocus={() => !disabled && setIsOpen(true)}
                    placeholder={placeholder}
                    disabled={disabled}
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 text-textMuted cursor-pointer">
                    {search ? (
                        <X size={14} onClick={clearInput} className="hover:text-white" />
                    ) : (
                        <ChevronDown size={14} />
                    )}
                </div>
            </div>
            
            {isOpen && !disabled && (
                <div className="absolute z-50 w-full mt-1 bg-surfaceHighlight border border-white/10 rounded-lg shadow-xl max-h-60 overflow-y-auto custom-scrollbar">
                    {filteredOptions.length > 0 ? (
                        filteredOptions.map(opt => (
                            <div key={opt} className="px-3 py-2 hover:bg-white/10 cursor-pointer text-sm text-white border-b border-white/5 last:border-0" onClick={() => handleSelect(opt)}>
                                {opt}
                            </div>
                        ))
                    ) : (
                         <div className="px-3 py-2 text-xs text-textMuted italic">Pressione Enter para buscar na API</div>
                    )}
                </div>
            )}
        </div>
    );
};

// 3. H2H Stat Bar
const H2HStatBar: React.FC<{
    label: string;
    percentage: number;
    color?: string;
}> = ({ label, percentage, color = 'bg-accent' }) => {
    return (
        <div className="w-full mb-3">
            <div className="flex justify-between items-end mb-1 px-1">
                <span className="text-[10px] uppercase tracking-widest font-bold text-textMuted">{label}</span>
                <span className="font-mono font-bold text-sm text-white">{percentage}%</span>
            </div>
            <div className="h-2 w-full bg-surfaceHighlight rounded-full overflow-hidden">
                <div 
                    style={{ width: `${percentage}%` }} 
                    className={`h-full transition-all duration-700 ${percentage >= 70 ? color : 'bg-white/30'}`} 
                />
            </div>
        </div>
    );
};

// 4. Recent Games List
const RecentGamesList: React.FC<{ matches: HistoryMatch[], playerName: string, color: 'primary' | 'accent' }> = ({ matches, playerName, color }) => {
    const limited = matches.slice(0, 5);
    const highlightClass = color === 'primary' ? 'text-primary font-bold' : 'text-accent font-bold';
    
    return (
        <div className="flex flex-col gap-1 mt-4">
            <div className="flex justify-between px-2 text-[10px] text-textMuted uppercase font-bold mb-1">
                <span className="w-[25%]">Data</span>
                <span className="w-[25%] text-right">Mandante</span>
                <span className="w-[25%] text-center">Placar</span>
                <span className="w-[25%] text-left">Visitante</span>
            </div>
            {limited.map((m, i) => {
                const isHome = m.home_player === playerName;
                const isAway = m.away_player === playerName;
                
                return (
                    <div key={i} className="flex justify-between items-center text-xs p-2 bg-surfaceHighlight/20 rounded hover:bg-surfaceHighlight/40 transition-colors">
                        <div className="w-[25%] text-textMuted text-[10px] whitespace-nowrap overflow-hidden font-mono">
                            {formatDateSafe(m.data_realizacao)}
                        </div>
                        <div className={`w-[25%] text-right truncate ${isHome ? highlightClass : 'text-textMuted'} text-[11px]`}>
                            {m.home_player}
                        </div>
                        <div className="w-[25%] text-center font-mono font-bold flex flex-col items-center leading-none">
                            <span className="text-white text-sm">{m.score_home}-{m.score_away}</span>
                            <span className="text-[9px] text-textMuted opacity-70 mt-0.5">
                                ({m.halftime_score_home}-{m.halftime_score_away})
                            </span>
                        </div>
                        <div className={`w-[25%] text-left truncate ${isAway ? highlightClass : 'text-textMuted'} text-[11px]`}>
                            {m.away_player}
                        </div>
                    </div>
                )
            })}
            {limited.length === 0 && <div className="text-center text-textMuted text-xs py-2">Sem jogos recentes</div>}
        </div>
    );
};

// 5. Win Prob Bar
const WinProbabilityBar: React.FC<{
    p1Name: string; p2Name: string;
    p1WinPct: number; p2WinPct: number; drawPct: number;
    p1Wins: number; p2Wins: number; draws: number;
    total: number;
}> = ({ p1Name, p2Name, p1WinPct, p2WinPct, drawPct, p1Wins, p2Wins, draws, total }) => {
    return (
        <div className="relative w-full bg-surface/50 border border-white/10 rounded-xl p-6 mb-4 overflow-hidden">
            <div className="flex justify-between items-center mb-4 relative z-10">
                <div className="text-left">
                    <div className="text-[10px] text-textMuted uppercase tracking-wider mb-1">JOGADOR 1</div>
                    <div className="text-xl md:text-2xl font-black text-primary tracking-tight">{p1Name}</div>
                </div>
                <div className="flex flex-col items-center">
                     <span className="bg-surfaceHighlight px-3 py-1 rounded-full text-xs font-bold text-textMuted border border-white/10">VS</span>
                </div>
                <div className="text-right">
                    <div className="text-[10px] text-textMuted uppercase tracking-wider mb-1">JOGADOR 2</div>
                    <div className="text-xl md:text-2xl font-black text-accent tracking-tight">{p2Name}</div>
                </div>
            </div>
            <div className="relative z-10">
                <div className="flex justify-between text-xs font-bold mb-2 px-1">
                    <span className="text-primary">{p1Wins} Vit ({p1WinPct}%)</span>
                    <span className="text-warning">{draws} Emp</span>
                    <span className="text-accent">{p2Wins} Vit ({p2WinPct}%)</span>
                </div>
                <div className="h-3 w-full bg-surfaceHighlight rounded-full flex overflow-hidden shadow-inner">
                    <div style={{ width: `${p1WinPct}%` }} className="bg-primary h-full" />
                    <div style={{ width: `${drawPct}%` }} className="bg-warning h-full" />
                    <div style={{ width: `${p2WinPct}%` }} className="bg-accent h-full" />
                </div>
                <div className="text-center mt-2 text-[9px] text-textMuted uppercase">Baseado em {total} confrontos</div>
            </div>
        </div>
    );
}

export const H2H: React.FC = () => {
    const [historyMatches, setHistoryMatches] = useState<HistoryMatch[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [selectedLeague, setSelectedLeague] = useState('');
    const [player1, setPlayer1] = useState('');
    const [player2, setPlayer2] = useState('');
    const [windowSize, setWindowSize] = useState(5);
    const [h2hData, setH2HData] = useState<H2HResponse | null>(null);
    const [p1Matches, setP1Matches] = useState<HistoryMatch[]>([]);
    const [p2Matches, setP2Matches] = useState<HistoryMatch[]>([]);
    const [loadingCompare, setLoadingCompare] = useState(false);
    
    const [searchParams] = useSearchParams();
    const hasAutoTriggered = useRef(false);

    useEffect(() => {
        const load = async () => {
            setLoadingHistory(true);
            const matches = await fetchHistoryGames();
            if (matches && matches.length > 0) setHistoryMatches(matches);
            setLoadingHistory(false);
        };
        load();
    }, []);

    useEffect(() => {
        const league = searchParams.get('league');
        const p1 = searchParams.get('p1');
        const p2 = searchParams.get('p2');

        if (league && p1 && p2 && !hasAutoTriggered.current) {
            setSelectedLeague(league);
            setPlayer1(p1);
            setPlayer2(p2);
            setTimeout(() => {
                handleCompare(league, p1, p2);
            }, 100);
            hasAutoTriggered.current = true;
        }
    }, [searchParams]);

    const leagues = useMemo(() => Array.from(new Set(historyMatches.map(m => m.league_name))).sort(), [historyMatches]);
    const players = useMemo(() => {
        if (!selectedLeague) return [];
        const set = new Set<string>();
        historyMatches.filter(m => m.league_name === selectedLeague).forEach(m => {
            if (m.home_player) set.add(m.home_player);
            if (m.away_player) set.add(m.away_player);
        });
        return Array.from(set).sort();
    }, [selectedLeague, historyMatches]);

    const handleCompare = async (l = selectedLeague, p1 = player1, p2 = player2) => {
        if(!p1 || !p2 || p1 === p2) return;
        setLoadingCompare(true);
        setH2HData(null);
        try {
            const h2h = await fetchH2H(p1, p2, l);
            setH2HData(h2h);

            // OPTIMIZATION: For Adriatic League, use the data already returned by fetchH2H
            if ((l.includes('Adriatic') || l.includes('10 mins play')) && h2h?.player1_stats && h2h?.player2_stats) {
                // Helper to normalize Adriatic games to HistoryMatch
                const normalizeAdriaticGames = (games: any[], playerName: string): HistoryMatch[] => {
                    return games.map((g: any) => {
                         const [hScore, aScore] = (g.score || "0-0").split('-').map(Number);
                         const [htH, htA] = (g.scoreHT || "0-0").split('-').map(Number);
                         return {
                             home_player: g.home.includes('(') ? g.home.split('(')[1].replace(')', '') : g.home,
                             away_player: g.away.includes('(') ? g.away.split('(')[1].replace(')', '') : g.away,
                             score_home: hScore,
                             score_away: aScore,
                             halftime_score_home: htH,
                             halftime_score_away: htA,
                             data_realizacao: g.date ? new Date(g.timestamp * 1000).toISOString() : new Date().toISOString(),
                             league_name: l
                         };
                    });
                };

                if (h2h.player1_stats.games) setP1Matches(normalizeAdriaticGames(h2h.player1_stats.games, p1));
                if (h2h.player2_stats.games) setP2Matches(normalizeAdriaticGames(h2h.player2_stats.games, p2));
            } else {
                // Standard flow for other leagues
                const [p1Hist, p2Hist] = await Promise.all([
                    fetchPlayerHistory(p1, 20),
                    fetchPlayerHistory(p2, 20)
                ]);
                setP1Matches(p1Hist);
                setP2Matches(p2Hist);
            }
        } catch (e) { console.error(e); } 
        finally { setLoadingCompare(false); }
    };

    const computedStats = useMemo(() => {
        if (!h2hData || p1Matches.length === 0 || p2Matches.length === 0) return null;
        
        const h2hSliced = h2hData.matches?.slice(0, windowSize) || [];
        const h2hStats = calculateH2HStats(h2hSliced, player1, player2);
        
        const p1Stats = calculateHistoryPlayerStats(p1Matches, player1, windowSize);
        const p2Stats = calculateHistoryPlayerStats(p2Matches, player2, windowSize);
        const leagueStats = calculateLeagueStatsFromHistory(historyMatches, selectedLeague, 20);
        const projections = (p1Stats && p2Stats && leagueStats) ? generateProjections(h2hStats, p1Stats, p2Stats, leagueStats) : [];
        
        let xG = null;
        if (p1Stats && p2Stats) {
            const p1Exp = (p1Stats.avgScored + p2Stats.avgConceded) / 2;
            const p2Exp = (p2Stats.avgScored + p1Stats.avgConceded) / 2;
            const h2hAvg = h2hStats?.avgGoals || 0;
            const total = h2hAvg > 0 ? (p1Exp + p2Exp + h2hAvg) / 2 : (p1Exp + p2Exp);
            xG = { p1: p1Exp.toFixed(1), p2: p2Exp.toFixed(1), total: total.toFixed(1) };
        }
        return { h2hStats, p1Stats, p2Stats, projections, xG };
    }, [h2hData, p1Matches, p2Matches, windowSize, player1, player2, historyMatches, selectedLeague]);

    return (
        <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
            {/* 1. Control Panel */}
            <Card className="bg-surface/50 border-white/5 p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                    <div>
                        <label className="text-[10px] text-textMuted uppercase font-bold mb-1 block">Liga</label>
                        <select 
                            className="w-full bg-surfaceHighlight text-white text-sm border border-white/10 rounded-lg px-3 py-2 outline-none focus:border-accent"
                            value={selectedLeague}
                            onChange={e => { setSelectedLeague(e.target.value); setPlayer1(''); setPlayer2(''); }}
                            disabled={loadingHistory}
                        >
                            <option value="">{loadingHistory ? 'Carregando...' : 'Selecione'}</option>
                            {leagues.map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                    </div>
                    <div>
                         <label className="text-[10px] text-textMuted uppercase font-bold mb-1 block">Jogador 1</label>
                         <SearchableSelect value={player1} onChange={setPlayer1} options={players} disabled={!selectedLeague} placeholder="Buscar..." />
                    </div>
                    <div>
                         <label className="text-[10px] text-textMuted uppercase font-bold mb-1 block">Jogador 2</label>
                         <SearchableSelect value={player2} onChange={setPlayer2} options={players} disabled={!selectedLeague} placeholder="Buscar..." />
                    </div>
                    <div className="flex gap-2">
                        <div className="w-1/2">
                            <label className="text-[10px] text-textMuted uppercase font-bold mb-1 block">Jogos</label>
                            <select 
                                className="w-full bg-surfaceHighlight text-white text-sm border border-white/10 rounded-lg px-3 py-2 outline-none focus:border-accent"
                                value={windowSize} onChange={e => setWindowSize(Number(e.target.value))}
                            >
                                <option value={5}>5</option>
                                <option value={10}>10</option>
                                <option value={20}>20</option>
                            </select>
                        </div>
                        <button 
                            onClick={() => handleCompare()}
                            disabled={!player1 || !player2 || loadingCompare}
                            className="w-1/2 bg-accent hover:bg-emerald-400 text-surface font-bold rounded-lg h-[38px] mt-auto transition-all disabled:opacity-50 flex items-center justify-center"
                        >
                            {loadingCompare ? <RefreshCw className="animate-spin" size={18} /> : 'VS'}
                        </button>
                    </div>
                </div>
            </Card>

            {computedStats && computedStats.h2hStats && computedStats.p1Stats && computedStats.p2Stats && (
                <div className="animate-slide-up space-y-6">
                    
                    {/* 2. Hero Section: The Verdict */}
                    <WinProbabilityBar 
                        p1Name={player1} p2Name={player2}
                        p1Wins={computedStats.h2hStats.p1Wins}
                        p2Wins={computedStats.h2hStats.p2Wins}
                        draws={computedStats.h2hStats.draws}
                        p1WinPct={computedStats.h2hStats.player1_win_percentage}
                        p2WinPct={computedStats.h2hStats.player2_win_percentage}
                        drawPct={computedStats.h2hStats.draw_percentage}
                        total={computedStats.h2hStats.total}
                    />

                    {/* 3. The Analysis Grid (4-4-4 Layout) */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        
                        {/* PLAYER 1 */}
                        <div className="lg:col-span-4 space-y-4">
                            <div className="bg-surface/30 rounded-xl border border-white/5 p-4">
                                <div className="text-primary font-bold text-lg truncate border-b border-white/5 pb-2 mb-2">{player1}</div>
                                <div className="grid grid-cols-2 gap-2 mb-4">
                                    <div className="bg-primary/10 rounded p-2 text-center border border-primary/20">
                                        <div className="text-lg font-mono font-bold text-primary">{computedStats.p1Stats.avgScoredHT}</div>
                                        <div className="text-[7px] uppercase text-primary/70">Média Pró HT (Ind)</div>
                                    </div>
                                    <div className="bg-primary/10 rounded p-2 text-center border border-primary/20">
                                        <div className="text-lg font-mono font-bold text-primary">{computedStats.p1Stats.avgScored}</div>
                                        <div className="text-[7px] uppercase text-primary/70">Média Pró FT (Ind)</div>
                                    </div>
                                </div>
                                <PlayerConsistencyChart matches={p1Matches} playerName={player1} color="#6366f1" />
                            </div>
                            <RecentGamesList matches={p1Matches} playerName={player1} color="primary" />
                        </div>

                        {/* CENTER: H2H STATS (RAIO-X) */}
                        <div className="lg:col-span-4 flex flex-col gap-4">
                            <div className="bg-surface/50 rounded-xl border border-white/10 p-6 shadow-lg h-full">
                                <div className="flex items-center justify-center gap-2 mb-6 text-textMuted">
                                    <Zap size={16} className="text-accent" />
                                    <span className="text-xs uppercase tracking-widest font-bold">Raio-X do Confronto</span>
                                </div>
                                
                                {computedStats.h2hStats.total > 0 ? (
                                    <div className="space-y-6">
                                        <div>
                                            <H2HStatBar label="Over 0.5 HT" percentage={computedStats.h2hStats.ht.over05Pct} />
                                            <H2HStatBar label="Over 1.5 HT" percentage={computedStats.h2hStats.ht.over15Pct} />
                                            <H2HStatBar label="Ambos Marcam HT" percentage={computedStats.h2hStats.ht.bttsPct} />
                                        </div>
                                        <div className="h-px bg-white/5"></div>
                                        <div>
                                            <H2HStatBar label="Over 2.5 FT" percentage={computedStats.h2hStats.ft.over25Pct} />
                                            <H2HStatBar label="Ambos Marcam FT" percentage={computedStats.h2hStats.ft.bttsPct} />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center text-textMuted italic py-4">Sem jogos H2H suficientes</div>
                                )}

                                <div className="mt-8 pt-6 border-t border-white/5">
                                    <div className="text-center text-[10px] text-textMuted uppercase font-bold mb-3">Comparativo de Forma (Geral)</div>
                                    <div className="flex justify-between text-xs px-2">
                                        <span className="text-primary">{computedStats.p1Stats.htOver05Pct}%</span>
                                        <span className="text-textMuted">Over 0.5 HT (Ind)</span>
                                        <span className="text-accent">{computedStats.p2Stats.htOver05Pct}%</span>
                                    </div>
                                    <div className="w-full h-1 bg-surfaceHighlight mt-1 flex">
                                        <div style={{width: `${computedStats.p1Stats.htOver05Pct}%`}} className="bg-primary/50 h-full"></div>
                                        <div className="flex-1 bg-transparent"></div>
                                        <div style={{width: `${computedStats.p2Stats.htOver05Pct}%`}} className="bg-accent/50 h-full"></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* PLAYER 2 */}
                        <div className="lg:col-span-4 space-y-4">
                            <div className="bg-surface/30 rounded-xl border border-white/5 p-4">
                                <div className="text-accent font-bold text-lg truncate border-b border-white/5 pb-2 mb-2">{player2}</div>
                                <div className="grid grid-cols-2 gap-2 mb-4">
                                    <div className="bg-accent/10 rounded p-2 text-center border border-accent/20">
                                        <div className="text-lg font-mono font-bold text-accent">{computedStats.p2Stats.avgScoredHT}</div>
                                        <div className="text-[7px] uppercase text-accent/70">Média Pró HT (Ind)</div>
                                    </div>
                                    <div className="bg-accent/10 rounded p-2 text-center border border-accent/20">
                                        <div className="text-lg font-mono font-bold text-accent">{computedStats.p2Stats.avgScored}</div>
                                        <div className="text-[7px] uppercase text-accent/70">Média Pró FT (Ind)</div>
                                    </div>
                                </div>
                                <PlayerConsistencyChart matches={p2Matches} playerName={player2} color="#10b981" />
                            </div>
                            <RecentGamesList matches={p2Matches} playerName={player2} color="accent" />
                        </div>
                    </div>

                    {/* 4. INTELLIGENCE LAB (NEW SECTION) */}
                    <div className="bg-gradient-to-r from-surfaceHighlight to-surface rounded-xl border border-white/10 p-6 shadow-lg">
                        <div className="flex items-center gap-2 mb-6 border-b border-white/5 pb-4">
                            <BrainCircuit className="text-primary" />
                            <h3 className="text-lg font-bold uppercase tracking-wider">Laboratório de Inteligência</h3>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* A: xG Breakdown */}
                            <div>
                                {computedStats.xG && (
                                    <div className="bg-black/20 p-4 rounded-lg border border-white/5 h-full">
                                        <h4 className="text-xs text-textMuted uppercase font-bold mb-4 flex items-center gap-2"><Target size={14}/> Expectativa de Gols (xG)</h4>
                                        
                                        <div className="flex justify-between items-end mb-2">
                                            <span className="text-primary font-bold text-2xl">{computedStats.xG.p1}</span>
                                            <div className="text-center">
                                                <span className="text-[10px] text-textMuted uppercase block">Total Esperado</span>
                                                <span className="text-3xl font-black text-white">{computedStats.xG.total}</span>
                                            </div>
                                            <span className="text-accent font-bold text-2xl">{computedStats.xG.p2}</span>
                                        </div>
                                        
                                        <div className="w-full h-3 bg-surfaceHighlight rounded-full flex overflow-hidden">
                                            <div style={{ width: `${(Number(computedStats.xG.p1) / Number(computedStats.xG.total)) * 100}%` }} className="bg-primary h-full"></div>
                                            <div className="flex-1 bg-accent h-full"></div>
                                        </div>
                                        <p className="text-[10px] text-textMuted mt-2 text-center">
                                            Baseado na média de gols feitos e sofridos recentes de cada jogador + histórico H2H.
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* B: Smart Projections List */}
                            <div>
                                <h4 className="text-xs text-textMuted uppercase font-bold mb-4 flex items-center gap-2"><Zap size={14}/> Oportunidades Identificadas</h4>
                                {computedStats.projections.length > 0 ? (
                                    <div className="space-y-3">
                                        {computedStats.projections.slice(0, 3).map((p, i) => (
                                            <div key={i} className="bg-surfaceHighlight/40 p-3 rounded-lg border-l-4 border-l-primary">
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="font-bold text-white">{p.market}</span>
                                                    <Badge value={p.probability} />
                                                </div>
                                                <div className="text-xs text-textMuted">
                                                    {p.reasoning && p.reasoning.map((r, idx) => (
                                                        <span key={idx} className="block">• {r}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-textMuted italic text-sm py-4">
                                        Nenhuma tendência forte encontrada para este confronto.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 5. History Evidence */}
                    {h2hData?.matches && (
                        <Card title="Histórico de Confrontos" icon={<Swords size={18} />}>
                             <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead className="text-textMuted bg-white/5 uppercase font-bold">
                                        <tr>
                                            <th className="p-3 w-[15%]">Data</th>
                                            <th className="p-3 text-right w-[35%]">Mandante</th>
                                            <th className="p-3 text-center w-[15%]">Placar</th>
                                            <th className="p-3 w-[35%]">Visitante</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {h2hData.matches.slice(0,10).map((m, i) => {
                                            const isP1 = m.home_player === player1;
                                            const p1S = isP1 ? m.score_home : m.score_away;
                                            const p2S = isP1 ? m.score_away : m.score_home;
                                            let color = 'text-white';
                                            if(p1S > p2S) color = 'text-primary';
                                            if(p2S > p1S) color = 'text-accent';

                                            return (
                                                <tr key={i} className="hover:bg-white/5 transition-colors">
                                                    <td className="p-3 text-textMuted">{formatDateSafe(m.data_realizacao)}</td>
                                                    <td className={`p-3 text-right ${m.home_player === player1 ? 'text-primary font-bold' : (m.home_player === player2 ? 'text-accent font-bold' : 'text-textMuted')}`}>{m.home_player}</td>
                                                    <td className="p-3 text-center">
                                                        <span className={`font-mono font-bold px-2 py-1 rounded bg-surfaceHighlight ${color}`}>
                                                            {m.score_home} - {m.score_away}
                                                        </span>
                                                        <span className="ml-2 text-[10px] text-textMuted">
                                                            ({m.halftime_score_home}-{m.halftime_score_away})
                                                        </span>
                                                    </td>
                                                    <td className={`p-3 ${m.away_player === player1 ? 'text-primary font-bold' : (m.away_player === player2 ? 'text-accent font-bold' : 'text-textMuted')}`}>{m.away_player}</td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                             </div>
                        </Card>
                    )}
                </div>
            )}
        </div>
    );
};
