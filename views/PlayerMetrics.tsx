import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { calculatePlayerMetrics } from '../utils/stats';
import { PlayerMetrics as IPlayerMetrics } from '../types';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { Search, Trophy } from 'lucide-react';

export const PlayerMetrics: React.FC = () => {
  const { games, leagues } = useApp();
  const [selectedLeague, setSelectedLeague] = useState<string>('');
  const [windowSize, setWindowSize] = useState(10);
  const [search, setSearch] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof IPlayerMetrics; direction: 'asc' | 'desc' }>({ key: 'winPct', direction: 'desc' });

  const metricsData = useMemo(() => {
    const playersMap = new Map<string, IPlayerMetrics>();
    const distinctPlayers = new Set<string>();
    
    // Collect all players relevant to current filter context
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

  const sortedData = useMemo(() => {
    return [...metricsData].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [metricsData, sortConfig]);

  const handleSort = (key: keyof IPlayerMetrics) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const SortIcon = ({ column }: { column: keyof IPlayerMetrics }) => {
      if (sortConfig.key !== column) return <span className="opacity-20 ml-1">⇅</span>;
      return <span className="text-accent ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <div className="space-y-6">
        <Card>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-1">
                     <label className="block text-xs text-textMuted mb-1">Liga</label>
                    <select 
                        value={selectedLeague} 
                        onChange={(e) => setSelectedLeague(e.target.value)}
                        className="w-full bg-surfaceHighlight text-textMain border border-white/10 rounded-lg px-3 py-2 outline-none focus:border-accent"
                    >
                        <option value="">Todas as Ligas</option>
                        {leagues.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                </div>
                <div className="md:col-span-1">
                    <label className="block text-xs text-textMuted mb-1">Amostragem</label>
                    <select 
                        value={windowSize} 
                        onChange={(e) => setWindowSize(Number(e.target.value))}
                        className="w-full bg-surfaceHighlight text-textMain border border-white/10 rounded-lg px-3 py-2 outline-none focus:border-accent"
                    >
                        <option value={5}>Últimos 5</option>
                        <option value={10}>Últimos 10</option>
                        <option value={20}>Últimos 20</option>
                    </select>
                </div>
                <div className="md:col-span-2">
                    <label className="block text-xs text-textMuted mb-1">Buscar Jogador</label>
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 text-textMuted w-4 h-4" />
                        <input 
                            type="text" 
                            placeholder="Nome do jogador..." 
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full bg-surfaceHighlight text-textMain border border-white/10 rounded-lg pl-9 pr-3 py-2 outline-none focus:border-accent"
                        />
                    </div>
                </div>
            </div>
        </Card>

        <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-textMuted uppercase bg-surfaceHighlight/50 sticky top-0 z-10">
                        <tr>
                            <th className="px-4 py-3 cursor-pointer hover:text-white" onClick={() => handleSort('player')}>Jogador <SortIcon column="player"/></th>
                            <th className="px-4 py-3">Liga</th>
                            <th className="px-4 py-3 text-center text-xs">Jogos</th>
                            
                            {/* HT Stats */}
                            <th className="px-4 py-3 text-center cursor-pointer hover:text-white bg-blue-500/5" onClick={() => handleSort('htOver05Pct')}>HT 0.5 <SortIcon column="htOver05Pct"/></th>
                            <th className="px-4 py-3 text-center cursor-pointer hover:text-white bg-blue-500/5" onClick={() => handleSort('htOver15Pct')}>HT 1.5 <SortIcon column="htOver15Pct"/></th>
                            <th className="px-4 py-3 text-center cursor-pointer hover:text-white bg-blue-500/5" onClick={() => handleSort('avgGoalsHT')}>Avg HT <SortIcon column="avgGoalsHT"/></th>
                            
                            {/* FT Stats */}
                            <th className="px-4 py-3 text-center cursor-pointer hover:text-white bg-emerald-500/5" onClick={() => handleSort('ftOver05Pct')}>FT 0.5 <SortIcon column="ftOver05Pct"/></th>
                            <th className="px-4 py-3 text-center cursor-pointer hover:text-white bg-emerald-500/5" onClick={() => handleSort('ftOver15Pct')}>FT 1.5 <SortIcon column="ftOver15Pct"/></th>
                            <th className="px-4 py-3 text-center cursor-pointer hover:text-white bg-emerald-500/5" onClick={() => handleSort('avgGoalsFT')}>Avg FT <SortIcon column="avgGoalsFT"/></th>
                            
                            {/* Win Rate */}
                            <th className="px-4 py-3 text-center cursor-pointer hover:text-white bg-yellow-500/5" onClick={() => handleSort('winPct')}>WIN % <SortIcon column="winPct"/></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {sortedData.slice(0, 100).map((m, idx) => (
                            <tr key={`${m.player}-${idx}`} className="hover:bg-white/5 transition-colors group">
                                <td className="px-4 py-3 font-medium text-textMain group-hover:text-accent transition-colors">{m.player}</td>
                                <td className="px-4 py-3 text-textMuted text-xs">{m.league}</td>
                                <td className="px-4 py-3 text-center text-textMuted">{m.games}</td>
                                
                                {/* HT */}
                                <td className="px-4 py-3 text-center bg-blue-500/5"><Badge value={m.htOver05Pct} /></td>
                                <td className="px-4 py-3 text-center bg-blue-500/5"><Badge value={m.htOver15Pct} /></td>
                                <td className="px-4 py-3 text-center bg-blue-500/5 font-mono text-blue-400 font-bold">{m.avgGoalsHT}</td>
                                
                                {/* FT */}
                                <td className="px-4 py-3 text-center bg-emerald-500/5"><Badge value={m.ftOver05Pct} /></td>
                                <td className="px-4 py-3 text-center bg-emerald-500/5"><Badge value={m.ftOver15Pct} /></td>
                                <td className="px-4 py-3 text-center bg-emerald-500/5 font-mono text-emerald-400 font-bold">{m.avgGoalsFT}</td>
                                
                                {/* Win */}
                                <td className="px-4 py-3 text-center bg-yellow-500/5"><Badge value={m.winPct} /></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {sortedData.length === 0 && (
                    <div className="p-8 text-center text-textMuted">
                        Nenhum jogador encontrado com os filtros atuais.
                    </div>
                )}
            </div>
        </Card>
    </div>
  );
};