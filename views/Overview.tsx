
import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Card, StatCard } from '../components/ui/Card';
import { Activity, Clock, Flame, Shield, BarChart2, TrendingUp } from 'lucide-react';
import { getLeagueConfig, formatDateSafe } from '../utils/format';
import { Badge } from '../components/ui/Badge';

const GradientBar: React.FC<{ percentage: number, label: string, value: string | number }> = ({ percentage, label, value }) => {
    return (
        <div className="mb-4">
            <div className="flex justify-between items-end mb-1">
                <span className="text-sm font-medium text-textMuted">{label}</span>
                <span className="text-sm font-bold text-white">{value}</span>
            </div>
            <div className="w-full bg-white/5 rounded-full h-3">
                <div 
                    className="h-3 rounded-full bg-gradient-to-r from-primary via-purple-500 to-accent transition-all duration-500 ease-out" 
                    style={{ width: `${percentage}%` }}
                ></div>
            </div>
        </div>
    );
};

export const Overview: React.FC = () => {
  const { games, leagues } = useApp();
  const [windowSize, setWindowSize] = useState(10);
  const [selectedLeague, setSelectedLeague] = useState('all');

  const stats = useMemo(() => {
    // 1. Global Filter (For Top Cards & HT/FT Analysis)
    let filteredGames = games;
    if (selectedLeague !== 'all') {
        filteredGames = games.filter(g => g.league === selectedLeague);
    }
    const recentGames = filteredGames.slice(0, windowSize); 
    const totalGames = recentGames.length;
    
    // Market Globals
    const global = {
        ht: {
            over05: recentGames.filter(g => g.totalGoalsHT > 0.5).length,
            over15: recentGames.filter(g => g.totalGoalsHT > 1.5).length,
            over25: recentGames.filter(g => g.totalGoalsHT > 2.5).length,
            btts: recentGames.filter(g => g.isBTTS_HT).length,
            totalGoals: recentGames.reduce((acc, g) => acc + g.totalGoalsHT, 0)
        },
        ft: {
            over05: recentGames.filter(g => g.totalGoals > 0.5).length,
            over15: recentGames.filter(g => g.totalGoals > 1.5).length,
            over25: recentGames.filter(g => g.totalGoals > 2.5).length,
            btts: recentGames.filter(g => g.isBTTS).length,
            totalGoals: recentGames.reduce((acc, g) => acc + g.totalGoals, 0)
        }
    };

    // 2. League Breakdown (Calculated for ALL leagues regardless of selection to show the comparison table)
    const allLeaguesStats = leagues.map(leagueName => {
        const gamesForLeague = games.filter(g => g.league === leagueName).slice(0, windowSize);
        if (gamesForLeague.length === 0) return null;

        const total = gamesForLeague.length;
        const avgGoals = gamesForLeague.reduce((acc, g) => acc + g.totalGoals, 0) / total;
        
        return {
            name: leagueName,
            games: total,
            avgGoals: avgGoals,
            over25Pct: (gamesForLeague.filter(g => g.totalGoals > 2.5).length / total) * 100,
            bttsPct: (gamesForLeague.filter(g => g.isBTTS).length / total) * 100,
            htOver05Pct: (gamesForLeague.filter(g => g.totalGoalsHT > 0.5).length / total) * 100
        };
    }).filter(Boolean).sort((a, b) => b!.over25Pct - a!.over25Pct); // Default sort by Over 2.5

    // Hottest league for the highlight card
    const hottestLeague = allLeaguesStats.length > 0 ? allLeaguesStats[0] : null;

    return {
        totalGames,
        global,
        hottestLeague,
        recentGames,
        allLeaguesStats // Export this for the new table
    };
  }, [games, windowSize, leagues, selectedLeague]);

  const getPct = (count: number) => stats.totalGames > 0 ? Math.round((count / stats.totalGames) * 100) : 0;
  const getAvg = (total: number) => stats.totalGames > 0 ? (total / stats.totalGames).toFixed(2) : '0.00';

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
         <h2 className="text-2xl font-bold text-textMain flex items-center gap-2">
            <Activity className="text-accent" /> Visão Geral do Mercado
         </h2>
         
         <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
             {/* League Selector */}
             <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
                 <span className="text-xs text-textMuted hidden sm:inline">Filtro Global:</span>
                 <select 
                    value={selectedLeague}
                    onChange={(e) => setSelectedLeague(e.target.value)}
                    className="w-full sm:w-64 bg-surfaceHighlight text-textMain border border-white/10 rounded-lg px-4 py-2 outline-none focus:border-accent font-medium"
                 >
                    <option value="all">Todas as Ligas (Média Global)</option>
                    {leagues.map(l => (
                        <option key={l} value={l}>{l}</option>
                    ))}
                 </select>
             </div>

             {/* Games Count Selector */}
             <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
                 <span className="text-xs text-textMuted hidden sm:inline">Jogos:</span>
                 <select 
                    value={windowSize}
                    onChange={(e) => setWindowSize(Number(e.target.value))}
                    className="w-full sm:w-48 bg-surfaceHighlight text-textMain border border-white/10 rounded-lg px-4 py-2 outline-none focus:border-accent font-medium"
                 >
                    <option value={5}>Últimos 5 Jogos</option>
                    <option value={10}>Últimos 10 Jogos</option>
                    <option value={20}>Últimos 20 Jogos</option>
                    <option value={50}>Últimos 50 Jogos</option>
                 </select>
             </div>
         </div>
      </div>

      {/* Top Highlight Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard label="Jogos Analisados" value={stats.totalGames} color="primary" />
        
        <div className="bg-surfaceHighlight/40 border border-white/5 rounded-lg p-4 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-40 transition-opacity">
                <Flame size={48} className="text-orange-500" />
            </div>
            <p className="text-orange-400 text-xs uppercase tracking-wider font-bold mb-2 flex items-center gap-2">
                <Flame size={14} /> {selectedLeague === 'all' ? 'Liga Mais Over' : 'Stats da Liga'}
            </p>
            {stats.hottestLeague ? (
                <>
                    <div className="text-lg font-bold text-white truncate mb-2" style={{ color: getLeagueConfig(stats.hottestLeague.name).color }}>
                        {stats.hottestLeague.name}
                    </div>
                    <div className="flex gap-4 text-sm">
                        <div className="flex flex-col">
                            <span className="text-[10px] text-textMuted uppercase">Over 2.5</span>
                            <span className="text-accent font-bold text-lg">{Math.round(stats.hottestLeague.over25Pct)}%</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] text-textMuted uppercase">Média Gols</span>
                            <span className="text-blue-400 font-bold text-lg">{stats.hottestLeague.avgGoals.toFixed(2)}</span>
                        </div>
                    </div>
                </>
            ) : (
                <div className="text-textMuted italic text-sm mt-2">Dados insuficientes para análise</div>
            )}
        </div>

        <div className="bg-surfaceHighlight/40 p-4 rounded-lg border border-white/5">
            <p className="text-textMuted text-xs uppercase tracking-wider font-semibold mb-2">Média Global (FT)</p>
            <div className="text-3xl font-bold text-blue-400">{getAvg(stats.global.ft.totalGoals)} <span className="text-sm text-textMuted font-normal">gols/jogo</span></div>
        </div>
      </div>

      {/* HT & FT Analysis Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Half Time Section */}
          <Card title="Análise Half Time (HT)" icon={<Clock />} className="border-t-4 border-t-blue-500">
              <div className="space-y-5 mt-2">
                  <GradientBar 
                      label="Over 0.5 HT" 
                      percentage={getPct(stats.global.ht.over05)} 
                      value={`${getPct(stats.global.ht.over05)}%`} 
                  />
                  <GradientBar 
                      label="Over 1.5 HT" 
                      percentage={getPct(stats.global.ht.over15)} 
                      value={`${getPct(stats.global.ht.over15)}%`} 
                  />
                  <GradientBar 
                      label="Over 2.5 HT" 
                      percentage={getPct(stats.global.ht.over25)} 
                      value={`${getPct(stats.global.ht.over25)}%`} 
                  />
                  <GradientBar 
                      label="Ambos Marcam (BTTS) HT" 
                      percentage={getPct(stats.global.ht.btts)} 
                      value={`${getPct(stats.global.ht.btts)}%`} 
                  />
                  <div className="flex justify-between items-center pt-4 border-t border-white/5">
                      <span className="text-textMuted">Média de Gols HT</span>
                      <span className="text-2xl font-bold text-blue-400">{getAvg(stats.global.ht.totalGoals)}</span>
                  </div>
              </div>
          </Card>

          {/* Full Time Section */}
          <Card title="Análise Full Time (FT)" icon={<Shield />} className="border-t-4 border-t-accent">
              <div className="space-y-5 mt-2">
                  <GradientBar 
                      label="Over 0.5 FT" 
                      percentage={getPct(stats.global.ft.over05)} 
                      value={`${getPct(stats.global.ft.over05)}%`} 
                  />
                  <GradientBar 
                      label="Over 1.5 FT" 
                      percentage={getPct(stats.global.ft.over15)} 
                      value={`${getPct(stats.global.ft.over15)}%`} 
                  />
                  <GradientBar 
                      label="Over 2.5 FT" 
                      percentage={getPct(stats.global.ft.over25)} 
                      value={`${getPct(stats.global.ft.over25)}%`} 
                  />
                  <GradientBar 
                      label="Ambos Marcam (BTTS) FT" 
                      percentage={getPct(stats.global.ft.btts)} 
                      value={`${getPct(stats.global.ft.btts)}%`} 
                  />
                  <div className="flex justify-between items-center pt-4 border-t border-white/5">
                      <span className="text-textMuted">Média de Gols FT</span>
                      <span className="text-2xl font-bold text-accent">{getAvg(stats.global.ft.totalGoals)}</span>
                  </div>
              </div>
          </Card>
      </div>

      {/* NEW SECTION: League Comparison Table */}
      <Card title="Raio-X das Ligas" icon={<BarChart2 />} className="overflow-hidden">
          <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                  <thead className="text-xs text-textMuted uppercase bg-surfaceHighlight/30 sticky top-0">
                      <tr>
                          <th className="px-4 py-3">Liga</th>
                          <th className="px-4 py-3 text-center">Jogos</th>
                          <th className="px-4 py-3 text-center text-emerald-400 bg-emerald-500/5">Over 2.5</th>
                          <th className="px-4 py-3 text-center text-blue-400 bg-blue-500/5">BTTS</th>
                          <th className="px-4 py-3 text-center text-yellow-400 bg-yellow-500/5">HT 0.5</th>
                          <th className="px-4 py-3 text-center">Média Gols</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                      {stats.allLeaguesStats && stats.allLeaguesStats.map((league, idx) => (
                          <tr key={idx} className="hover:bg-white/5 transition-colors">
                              <td className="px-4 py-3 font-medium text-white">{league!.name}</td>
                              <td className="px-4 py-3 text-center text-textMuted">{league!.games}</td>
                              <td className="px-4 py-3 text-center bg-emerald-500/5">
                                  <Badge value={Math.round(league!.over25Pct)} />
                              </td>
                              <td className="px-4 py-3 text-center bg-blue-500/5">
                                  <Badge value={Math.round(league!.bttsPct)} />
                              </td>
                              <td className="px-4 py-3 text-center bg-yellow-500/5">
                                  <Badge value={Math.round(league!.htOver05Pct)} />
                              </td>
                              <td className="px-4 py-3 text-center font-mono font-bold text-textMain">
                                  {league!.avgGoals.toFixed(2)}
                              </td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
      </Card>

      {/* Recent Games List */}
      <Card title="Últimos Jogos Finalizados" icon={<Clock />}>
          <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                  <thead className="text-xs text-textMuted uppercase bg-surfaceHighlight/30">
                      <tr>
                          <th className="px-4 py-3 rounded-tl-lg w-[10%]">Hora</th>
                          <th className="px-4 py-3 w-[20%]">Liga</th>
                          <th className="px-4 py-3 text-right w-[25%]">Home</th>
                          <th className="px-4 py-3 text-center w-[15%]">Placar</th>
                          <th className="px-4 py-3 text-left w-[25%] rounded-tr-lg">Away</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                      {stats.recentGames.slice(0, 15).map((game) => {
                          const leagueConfig = getLeagueConfig(game.league);
                          
                          return (
                            <tr key={game.id} className="hover:bg-white/5 transition-colors">
                                <td className="px-4 py-3 text-textMuted text-xs whitespace-nowrap">
                                    {formatDateSafe(game.date)}
                                </td>
                                <td className="px-4 py-3">
                                    <span 
                                        className="text-[10px] font-bold px-2 py-1 rounded border border-white/10 whitespace-nowrap"
                                        style={{ 
                                            color: leagueConfig.color,
                                            borderColor: `${leagueConfig.color}30`,
                                            backgroundColor: `${leagueConfig.color}10`
                                        }}
                                    >
                                        {leagueConfig.name}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <div className="font-medium text-textMain truncate max-w-[150px] ml-auto">{game.homePlayer}</div>
                                    <div className="text-[10px] text-textMuted truncate max-w-[150px] ml-auto">{game.homeTeam}</div>
                                </td>
                                <td className="px-4 py-3 text-center">
                                    <div className="flex flex-col items-center justify-center gap-1">
                                        <div className="bg-surfaceHighlight px-3 py-1 rounded text-white font-bold tracking-widest border border-white/10 shadow-sm min-w-[60px]">
                                            {game.scoreHome} - {game.scoreAway}
                                        </div>
                                        <span className="text-[10px] text-textMuted">
                                            HT: {game.scoreHTHome}-{game.scoreHTAway}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-left">
                                    <div className="font-medium text-textMain truncate max-w-[150px]">{game.awayPlayer}</div>
                                    <div className="text-[10px] text-textMuted truncate max-w-[150px]">{game.awayTeam}</div>
                                </td>
                            </tr>
                          );
                      })}
                      {stats.recentGames.length === 0 && (
                          <tr>
                              <td colSpan={5} className="p-8 text-center text-textMuted">
                                  Nenhum jogo encontrado para os filtros selecionados.
                              </td>
                          </tr>
                      )}
                  </tbody>
              </table>
          </div>
      </Card>
    </div>
  );
};
