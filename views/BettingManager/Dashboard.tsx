import React from 'react';
import { TrendingUp, DollarSign, Target, BarChart3 } from 'lucide-react';
import { Bet } from './types';

interface DashboardProps {
  bets: Bet[];
}

export const Dashboard: React.FC<DashboardProps> = ({ bets }) => {
  const totalBets = bets.length;
  const totalStake = bets.reduce((acc, bet) => acc + bet.stake, 0);
  const totalProfit = bets.reduce((acc, bet) => acc + bet.profit, 0);
  
  const settledBets = bets.filter(b => b.result === 'Win' || b.result === 'Loss');
  const wins = settledBets.filter(b => b.result === 'Win').length;
  const winRate = settledBets.length > 0 ? (wins / settledBets.length) * 100 : 0;
  
  const roi = totalStake > 0 ? (totalProfit / totalStake) * 100 : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <div className="bg-surface p-4 rounded-xl border border-white/5 flex items-center gap-4">
        <div className="p-3 bg-primary/10 rounded-lg text-primary">
          <BarChart3 size={24} />
        </div>
        <div>
          <p className="text-textMuted text-sm">Total de Apostas</p>
          <p className="text-2xl font-bold text-textMain">{totalBets}</p>
        </div>
      </div>

      <div className="bg-surface p-4 rounded-xl border border-white/5 flex items-center gap-4">
        <div className={`p-3 rounded-lg ${totalProfit >= 0 ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
          <DollarSign size={24} />
        </div>
        <div>
          <p className="text-textMuted text-sm">Lucro Total</p>
          <p className={`text-2xl font-bold ${totalProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {totalProfit >= 0 ? '+' : ''}{totalProfit.toFixed(2)} R$
          </p>
        </div>
      </div>

      <div className="bg-surface p-4 rounded-xl border border-white/5 flex items-center gap-4">
        <div className="p-3 bg-accent/10 rounded-lg text-accent">
          <TrendingUp size={24} />
        </div>
        <div>
          <p className="text-textMuted text-sm">ROI</p>
          <p className={`text-2xl font-bold ${roi >= 0 ? 'text-accent' : 'text-red-500'}`}>
            {roi.toFixed(2)}%
          </p>
        </div>
      </div>

      <div className="bg-surface p-4 rounded-xl border border-white/5 flex items-center gap-4">
        <div className="p-3 bg-purple-500/10 rounded-lg text-purple-500">
          <Target size={24} />
        </div>
        <div>
          <p className="text-textMuted text-sm">Win Rate</p>
          <p className="text-2xl font-bold text-purple-500">{winRate.toFixed(1)}%</p>
        </div>
      </div>
    </div>
  );
};
