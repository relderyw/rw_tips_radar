
import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { calculatePlayerMetrics } from '../utils/stats';
import { PlayerMetrics as IPlayerMetrics } from '../types';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { Search, Filter, Crosshair, ShieldAlert, Meh, Skull } from 'lucide-react';

export const PlayerMetrics: React.FC = () => {
  const { games, leagues } = useApp();
  const [selectedLeague, setSelectedLeague] = useState<string>('');
  const [windowSize, setWindowSize] = useState(10);
  const [search, setSearch] = useState('');
  const [trendFilter, setTrendFilter] = useState<'all' | 'sniper' | 'troll' | 'neutral'>('all');
  const [sortConfig, setSortConfig] = useState<{ key: keyof IPlayerMetrics; direction: 'asc' | 'desc' }>({ key: 'ftOver25Pct', direction: 'desc' });

  const metricsData = useMemo(() => {
    const playersMap = new Map<string, IPlayerMetrics>();
    const distinctPlayers = new Set<string>();
    
    games.forEach(g => {
        if (selectedLeague && g.league !== selectedLeague) return;
        distinctPlayers.add(g.homePlayer);
        distinctPlayers.add(g.awayPlayer);
    });

    distinctPlayers.forEach(player => {
        const filteredGames = selectedLeague ? games.filter(g => g.league === selectedLeague) : games;
        const m = calculatePlayerMetrics(filteredGames, player, windowSize);
        
        if (m && m.games >= (windowSize > 5 ? 5 : 3)) {
            if (search === '' || player.toLowerCase().includes(search.toLowerCase())) {
                playersMap.set(player, m);
            }
        }
    });

    return Array.from(playersMap.values());
  }, [games, selectedLeague, windowSize, search]);

  const filteredAndSortedData = useMemo(() => {
    let data = metricsData;

    // Trend Filter
    if (trendFilter !== 'all') {
        if (trendFilter === 'sniper') data = data.filter(m => m.verdict === 'sniper');
        else if (trendFilter === 'troll') data = data.filter(m => m.verdict === 'troll' || m.verdict === 'wall');
        else if (trendFilter === 'neutral') data = data.filter(m => m.verdict === 'neutral');
    }

    // Sorting
    return data.sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [metricsData, sortConfig, trendFilter]);

  const handleSort = (key: keyof IPlayerMetrics) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const SortIcon = ({ column }: { column: keyof IPlayerMetrics }) => {
      if (sortConfig.key !== column) return <span className="opacity-20 ml-1 text-[10px]">⇅</span>;
      return <span className="text-accent ml-1 text-[10px]">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>;
  };

  const renderVerdictBadge = (verdict: string) => {
      switch (verdict) {
          case 'sniper': return <span className="inline-flex items-center px-2 py-1 rounded bg-green-500/10 text-green-400 text-[10px] font-bold border border-green-500/20"><Crosshair size={12} className="mr-1"/> SNIPER</span>;
          case 'troll': return <span className="inline-flex items-center px-2 py-1 rounded bg-red-500/10 text-red-400 text-[10px] font-bold border border-red-500/20"><Skull size={12} className="mr-1"/> TROLL</span>;
          case 'wall': return <span className="inline-flex items-center px-2 py-1 rounded bg-blue-500/10 text-blue-400 text-[10px] font-bold border border-blue-500/20"><ShieldAlert size={12} className="mr-1"/> UNDER</span>;
          default: return <span className="inline-flex items-center px-2 py-1 rounded bg-white/5 text-textMuted text-[10px] font-bold border border-white/10"><Meh size={12} className="mr-1"/> NEUTRO</span>;
      }
  };

  return (
    <div className="space-y-6 animate-fade-in">
        <Card className="p-4 bg-surface/50 border-white/5">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                <div className="md:col-span-1">
                     <label className="block text-[10px] text-textMuted uppercase font-bold mb-1">Liga</label>
                    <select 
                        value={selectedLeague} 
                        onChange={(e) => setSelectedLeague(e.target.value)}
                        className="w-full bg-surfaceHighlight text-white text-sm border border-white/10 rounded-lg px-3 py-2 outline-none focus:border-accent"
                    >
                        <option value="">Todas as Ligas</option>
                        {leagues.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                </div>
                <div className="md:col-span-1">
                    <label className="block text-[10px] text-textMuted uppercase font-bold mb-1">Amostragem</label>
                    <select 
                        value={windowSize} 
                        onChange={(e) => setWindowSize(Number(e.target.value))}
                        className="w-full bg-surfaceHighlight text-white text-sm border border-white/10 rounded-lg px-3 py-2 outline-none focus:border-accent"
                    >
                        <option value={5}>Últimos 5</option>
                        <option value={10}>Últimos 10</option>
                        <option value={20}>Últimos 20</option>
                    </select>
                </div>
                <div className="md:col-span-1">
                    <label className="block text-[10px] text-textMuted uppercase font-bold mb-1">Tendência</label>
                    <select 
                        value={trendFilter} 
                        onChange={(e) => setTrendFilter(e.target.value as any)}
                        className="w-full bg-surfaceHighlight text-white text-sm border border-white/10 rounded-lg px-3 py-2 outline-none focus:border-accent"
                    >
                        <option value="all">Todos</option>
                        <option value="sniper">🔥 Over (Sniper)</option>
                        <option value="troll">🤡 Under/Troll</option>
                        <option value="neutral">😐 Neutros</option>
                    </select>
                </div>
                <div className="md:col-span-2">
                    <label className="block text-[10px] text-textMuted uppercase font-bold mb-1">Buscar Jogador</label>
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 text-textMuted w-4 h-4" />
                        <input 
                            type="text" 
                            placeholder="Nome do jogador..." 
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full bg-surfaceHighlight text-white text-sm border border-white/10 rounded-lg pl-9 pr-3 py-2 outline-none focus:border-accent"
                        />
                    </div>
                </div>
            </div>
        </Card>

        <Card className="overflow-hidden p-0 border-white/5 bg-surface/30">
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                    <thead className="text-[10px] text-textMuted uppercase bg-surfaceHighlight/50 sticky top-0 z-10 font-bold">
                        <tr>
                            <th className="px-4 py-3 cursor-pointer hover:text-white" onClick={() => handleSort('player')}>Jogador <SortIcon column="player"/></th>
                            <th className="px-4 py-3 text-center">Veredito</th>
                            <th className="px-4 py-3 text-center text-xs">Jogos</th>
                            
                            {/* HT Stats */}
                            <th className="px-4 py-3 text-center cursor-pointer hover:text-white bg-blue-500/5 border-l border-white/5" onClick={() => handleSort('htOver05Pct')}>HT 0.5 <SortIcon column="htOver05Pct"/></th>
                            <th className="px-4 py-3 text-center cursor-pointer hover:text-white bg-blue-500/5" onClick={() => handleSort('htOver15Pct')}>HT 1.5 <SortIcon column="htOver15Pct"/></th>
                            <th className="px-4 py-3 text-center cursor-pointer hover:text-white bg-blue-500/5" onClick={() => handleSort('avgGoalsHT')}>Avg HT <SortIcon column="avgGoalsHT"/></th>
                            
                            {/* FT Stats */}
                            <th className="px-4 py-3 text-center cursor-pointer hover:text-white bg-emerald-500/5 border-l border-white/5" onClick={() => handleSort('ftOver05Pct')}>FT 0.5 <SortIcon column="ftOver05Pct"/></th>
                            <th className="px-4 py-3 text-center cursor-pointer hover:text-white bg-emerald-500/5" onClick={() => handleSort('ftOver25Pct')}>FT 2.5 <SortIcon column="ftOver25Pct"/></th>
                            <th className="px-4 py-3 text-center cursor-pointer hover:text-white bg-emerald-500/5" onClick={() => handleSort('ftBttsPct')}>BTTS <SortIcon column="ftBttsPct"/></th>
                            <th className="px-4 py-3 text-center cursor-pointer hover:text-white bg-emerald-500/5" onClick={() => handleSort('avgGoalsFT')}>Avg FT <SortIcon column="avgGoalsFT"/></th>
                            
                            {/* Win Rate */}
                            <th className="px-4 py-3 text-center cursor-pointer hover:text-white bg-yellow-500/5 border-l border-white/5" onClick={() => handleSort('winPct')}>WIN % <SortIcon column="winPct"/></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {filteredAndSortedData.slice(0, 100).map((m, idx) => (
                            <tr key={`${m.player}-${idx}`} className="hover:bg-white/5 transition-colors group">
                                <td className="px-4 py-3 font-bold text-white group-hover:text-accent transition-colors">
                                    {m.player}
                                    <div className="text-[10px] text-textMuted font-normal">{m.league}</div>
                                </td>
                                <td className="px-4 py-3 text-center">{renderVerdictBadge(m.verdict)}</td>
                                <td className="px-4 py-3 text-center text-textMuted">{m.games}</td>
                                
                                {/* HT */}
                                <td className="px-4 py-3 text-center bg-blue-500/5 border-l border-white/5"><Badge value={m.htOver05Pct} /></td>
                                <td className="px-4 py-3 text-center bg-blue-500/5"><Badge value={m.htOver15Pct} /></td>
                                <td className="px-4 py-3 text-center bg-blue-500/5 font-mono text-blue-400 font-bold">{m.avgGoalsHT}</td>
                                
                                {/* FT */}
                                <td className="px-4 py-3 text-center bg-emerald-500/5 border-l border-white/5"><Badge value={m.ftOver05Pct} /></td>
                                <td className="px-4 py-3 text-center bg-emerald-500/5"><Badge value={m.ftOver25Pct} /></td>
                                <td className="px-4 py-3 text-center bg-emerald-500/5"><Badge value={m.ftBttsPct} /></td>
                                <td className="px-4 py-3 text-center bg-emerald-500/5 font-mono text-emerald-400 font-bold">{m.avgGoalsFT}</td>
                                
                                {/* Win */}
                                <td className="px-4 py-3 text-center bg-yellow-500/5 border-l border-white/5"><Badge value={m.winPct} /></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {filteredAndSortedData.length === 0 && (
                    <div className="p-10 text-center flex flex-col items-center justify-center text-textMuted bg-surface/20">
                        <Filter size={40} className="mb-2 opacity-20" />
                        Nenhum jogador encontrado com os filtros atuais.
                    </div>
                )}
            </div>
        </Card>
    </div>
  );
};