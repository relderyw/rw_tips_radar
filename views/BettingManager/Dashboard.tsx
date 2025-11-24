import React, { useState, useEffect } from 'react';
import { TrendingUp, DollarSign, Target, BarChart3, Save, Trash2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Bet, BetResult } from './types';

interface DashboardProps {
  bets: Bet[];
  onDelete: (id: string) => void;
  onUpdate: (bet: Bet) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ bets, onDelete, onUpdate }) => {
  const [unitValue, setUnitValue] = useState<number>(0);
  const [tempUnitValue, setTempUnitValue] = useState<string>('');
  const [chartPeriod, setChartPeriod] = useState<number>(7);

  useEffect(() => {
    const savedUnit = localStorage.getItem('rw_betting_manager_unit_value');
    if (savedUnit) {
      const val = parseFloat(savedUnit);
      setUnitValue(val);
      setTempUnitValue(val.toString());
    }
  }, []);

  const handleSaveUnit = () => {
    const val = parseFloat(tempUnitValue);
    if (!isNaN(val) && val > 0) {
      setUnitValue(val);
      localStorage.setItem('rw_betting_manager_unit_value', val.toString());
    }
  };

  const totalBets = bets.length;
  const totalStake = bets.reduce((acc, bet) => acc + bet.stake, 0);
  const totalProfit = bets.reduce((acc, bet) => acc + bet.profit, 0);
  
  const settledBets = bets.filter(b => b.result !== 'Pending');
  const wins = settledBets.filter(b => b.result === 'Win' || b.result === 'HalfWin').length;
  const losses = settledBets.filter(b => b.result === 'Loss' || b.result === 'HalfLoss').length;
  const voids = settledBets.filter(b => b.result === 'Void').length;
  const pending = bets.filter(b => b.result === 'Pending').length;
  
  const winRate = settledBets.length > 0 ? (wins / settledBets.length) * 100 : 0;
  const roi = totalStake > 0 ? (totalProfit / totalStake) * 100 : 0;

  const unitsWon = unitValue > 0 ? (totalProfit / unitValue) : 0;

  // Chart Data Preparation
  const getChartData = () => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - (chartPeriod - 1));
    startDate.setHours(0, 0, 0, 0);

    const data = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dateStr = currentDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      const dayStart = new Date(currentDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(currentDate);
      dayEnd.setHours(23, 59, 59, 999);

      const dayBets = bets.filter(b => {
        const betDate = new Date(b.date);
        return betDate >= dayStart && betDate <= dayEnd;
      });

      const dayProfit = dayBets.reduce((acc, b) => acc + b.profit, 0);
      
      data.push({
        name: dateStr,
        profit: dayProfit,
        accumulated: (data.length > 0 ? data[data.length - 1].accumulated : 0) + dayProfit
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }
    return data;
  };

  const chartData = getChartData();

  const handleQuickUpdate = (bet: Bet, result: BetResult) => {
    let profit = 0;
    if (result === 'Win') profit = (bet.stake * bet.odds) - bet.stake;
    else if (result === 'Loss') profit = -bet.stake;
    else if (result === 'HalfWin') profit = ((bet.stake / 2) * bet.odds) - (bet.stake / 2); // Simplified
    else if (result === 'HalfLoss') profit = -(bet.stake / 2);
    else if (result === 'Void') profit = 0;

    onUpdate({ ...bet, result, profit });
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      {/* Unit Value Config */}
      <div className="bg-surface p-4 rounded-xl border border-white/5 flex items-center gap-4">
        <label className="text-sm text-textMuted whitespace-nowrap">Valor da Unidade:</label>
        <div className="flex gap-2">
          <input
            type="number"
            value={tempUnitValue}
            onChange={(e) => setTempUnitValue(e.target.value)}
            placeholder="0.00"
            className="bg-background border border-white/10 rounded-lg px-3 py-1 text-textMain w-32 focus:outline-none focus:border-primary"
          />
          <button 
            onClick={handleSaveUnit}
            className="px-3 py-1 bg-primary/20 text-primary hover:bg-primary/30 rounded-lg text-sm font-bold transition-colors"
          >
            Salvar
          </button>
        </div>
        <div className="ml-auto text-sm text-textMuted">
          Atual: <span className="text-primary font-bold">R$ {unitValue.toFixed(2)}</span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface p-4 rounded-xl border border-white/5 flex items-center gap-4 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="p-3 bg-primary/10 rounded-lg text-primary z-10">
            <BarChart3 size={24} />
          </div>
          <div className="z-10">
            <p className="text-textMuted text-xs uppercase tracking-wider">Total Apostas</p>
            <p className="text-2xl font-bold text-textMain">{totalBets}</p>
            <p className="text-xs text-textMuted mt-1">
              <span className="text-green-500">{wins}W</span> - <span className="text-red-500">{losses}L</span> - <span className="text-yellow-500">{voids}V</span>
            </p>
          </div>
        </div>

        <div className={`bg-surface p-4 rounded-xl border border-white/5 flex items-center gap-4 relative overflow-hidden group ${totalProfit >= 0 ? 'border-l-4 border-l-green-500' : 'border-l-4 border-l-red-500'}`}>
          <div className={`p-3 rounded-lg z-10 ${totalProfit >= 0 ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
            <DollarSign size={24} />
          </div>
          <div className="z-10">
            <p className="text-textMuted text-xs uppercase tracking-wider">Lucro Total</p>
            <p className={`text-2xl font-bold ${totalProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {totalProfit >= 0 ? '+' : ''}{totalProfit.toFixed(2)} R$
            </p>
            <p className="text-xs text-textMuted mt-1">
              {unitsWon >= 0 ? '+' : ''}{unitsWon.toFixed(2)} Unidades
            </p>
          </div>
        </div>

        <div className="bg-surface p-4 rounded-xl border border-white/5 flex items-center gap-4 relative overflow-hidden group">
          <div className="p-3 bg-accent/10 rounded-lg text-accent z-10">
            <TrendingUp size={24} />
          </div>
          <div className="z-10">
            <p className="text-textMuted text-xs uppercase tracking-wider">ROI</p>
            <p className={`text-2xl font-bold ${roi >= 0 ? 'text-accent' : 'text-red-500'}`}>
              {roi.toFixed(2)}%
            </p>
          </div>
        </div>

        <div className="bg-surface p-4 rounded-xl border border-white/5 flex items-center gap-4 relative overflow-hidden group">
          <div className="p-3 bg-purple-500/10 rounded-lg text-purple-500 z-10">
            <Target size={24} />
          </div>
          <div className="z-10">
            <p className="text-textMuted text-xs uppercase tracking-wider">Win Rate</p>
            <p className="text-2xl font-bold text-purple-500">{winRate.toFixed(1)}%</p>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-surface p-6 rounded-xl border border-white/5">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold text-textMain">Desempenho ({chartPeriod} dias)</h3>
          <div className="flex gap-2">
            {[7, 15, 30, 60].map(days => (
              <button
                key={days}
                onClick={() => setChartPeriod(days)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  chartPeriod === days 
                    ? 'bg-primary/20 text-primary' 
                    : 'bg-white/5 text-textMuted hover:bg-white/10'
                }`}
              >
                {days}D
              </button>
            ))}
          </div>
        </div>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00ff64" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#00ff64" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis 
                dataKey="name" 
                stroke="#64748b" 
                fontSize={12} 
                tickLine={false} 
                axisLine={false}
              />
              <YAxis 
                stroke="#64748b" 
                fontSize={12} 
                tickLine={false} 
                axisLine={false}
                tickFormatter={(value) => `R$${value}`}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px' }}
                itemStyle={{ color: '#fff' }}
                formatter={(value: number) => [`R$ ${value.toFixed(2)}`, 'Lucro Acumulado']}
              />
              <Area 
                type="monotone" 
                dataKey="accumulated" 
                stroke="#00ff64" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorProfit)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* History List */}
      <div className="bg-surface rounded-xl border border-white/5 overflow-hidden">
        <div className="p-4 border-b border-white/5 flex justify-between items-center bg-surface/50">
          <h2 className="font-bold text-lg text-textMain">Histórico de Apostas</h2>
        </div>
        
        <div className="divide-y divide-white/5">
          {bets.length === 0 ? (
            <div className="p-8 text-center text-textMuted">Nenhuma aposta registrada.</div>
          ) : (
            bets.map(bet => (
              <div key={bet.id} className="p-4 hover:bg-white/5 transition-colors flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-white/10 text-textMuted">{bet.league}</span>
                    <span className="text-xs text-textMuted">{new Date(bet.date).toLocaleString()}</span>
                  </div>
                  <div className="font-medium text-textMain mb-1">
                    {bet.homePlayer} vs {bet.awayPlayer}
                  </div>
                  <div className="text-sm text-textMuted flex gap-4">
                    <span>{bet.market}</span>
                    <span>Stake: <span className="text-textMain">R$ {bet.stake.toFixed(2)}</span></span>
                    <span>Odds: <span className="text-accent">{bet.odds.toFixed(2)}</span></span>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <div className={`font-bold text-lg ${
                    bet.profit > 0 ? 'text-green-500' : 
                    bet.profit < 0 ? 'text-red-500' : 
                    'text-textMuted'
                  }`}>
                    {bet.profit > 0 ? '+' : ''}{bet.profit.toFixed(2)} R$
                  </div>
                  
                  {bet.result === 'Pending' ? (
                    <div className="flex gap-1">
                      <button onClick={() => handleQuickUpdate(bet, 'Win')} className="px-2 py-1 bg-green-500/20 text-green-500 hover:bg-green-500/30 rounded text-xs font-bold">Green</button>
                      <button onClick={() => handleQuickUpdate(bet, 'Loss')} className="px-2 py-1 bg-red-500/20 text-red-500 hover:bg-red-500/30 rounded text-xs font-bold">Red</button>
                      <button onClick={() => handleQuickUpdate(bet, 'Void')} className="px-2 py-1 bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30 rounded text-xs font-bold">Void</button>
                    </div>
                  ) : (
                    <div className={`px-2 py-1 rounded text-xs font-bold ${
                      bet.result === 'Win' ? 'bg-green-500/20 text-green-500' :
                      bet.result === 'Loss' ? 'bg-red-500/20 text-red-500' :
                      bet.result === 'Void' ? 'bg-yellow-500/20 text-yellow-500' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                      {bet.result}
                    </div>
                  )}
                </div>

                <button 
                  onClick={() => onDelete(bet.id)}
                  className="p-2 text-textMuted hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors self-start md:self-center"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
