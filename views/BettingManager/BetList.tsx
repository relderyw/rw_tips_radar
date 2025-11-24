import React from 'react';
import { Trash2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Bet } from './types';

interface BetListProps {
  bets: Bet[];
  onDelete: (id: string) => void;
}

export const BetList: React.FC<BetListProps> = ({ bets, onDelete }) => {
  if (bets.length === 0) {
    return (
      <div className="text-center py-12 text-textMuted bg-surface/30 rounded-xl border border-white/5">
        <p>Nenhuma aposta registrada ainda.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-white/10 text-textMuted text-sm">
            <th className="p-4 font-medium">Data</th>
            <th className="p-4 font-medium">Partida</th>
            <th className="p-4 font-medium">Seleção</th>
            <th className="p-4 font-medium">Odds</th>
            <th className="p-4 font-medium">Valor</th>
            <th className="p-4 font-medium">Resultado</th>
            <th className="p-4 font-medium text-right">Lucro</th>
            <th className="p-4 font-medium text-right">Ações</th>
          </tr>
        </thead>
        <tbody className="text-sm">
          {bets.map((bet) => (
            <tr key={bet.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
              <td className="p-4 text-textMuted">
                {new Date(bet.date).toLocaleDateString()} <br/>
                <span className="text-xs">{new Date(bet.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
              </td>
              <td className="p-4">
                <div className="font-medium text-textMain">{bet.homePlayer} vs {bet.awayPlayer}</div>
                <div className="text-xs text-textMuted">{bet.league}</div>
              </td>
              <td className="p-4 text-textMain">{bet.selection}</td>
              <td className="p-4 text-accent font-bold">{bet.odds.toFixed(2)}</td>
              <td className="p-4 text-textMain">R$ {bet.stake.toFixed(2)}</td>
              <td className="p-4">
                <span className={`px-2 py-1 rounded text-xs font-bold ${
                  bet.result === 'Win' ? 'bg-green-500/20 text-green-500' :
                  bet.result === 'Loss' ? 'bg-red-500/20 text-red-500' :
                  bet.result === 'Void' ? 'bg-yellow-500/20 text-yellow-500' :
                  'bg-gray-500/20 text-gray-400'
                }`}>
                  {bet.result === 'Win' ? 'Green' :
                   bet.result === 'Loss' ? 'Red' :
                   bet.result === 'Void' ? 'Anulada' : 'Pendente'}
                </span>
              </td>
              <td className={`p-4 text-right font-bold ${
                bet.profit > 0 ? 'text-green-500' :
                bet.profit < 0 ? 'text-red-500' :
                'text-textMuted'
              }`}>
                {bet.profit > 0 ? '+' : ''}{bet.profit.toFixed(2)}
              </td>
              <td className="p-4 text-right">
                <button 
                  onClick={() => onDelete(bet.id)}
                  className="p-2 text-textMuted hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
