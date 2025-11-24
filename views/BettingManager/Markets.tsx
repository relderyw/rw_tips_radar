import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Save } from 'lucide-react';
import { Market } from './types';

export const Markets: React.FC = () => {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [newMarketName, setNewMarketName] = useState('');

  useEffect(() => {
    const savedMarkets = localStorage.getItem('rw_betting_manager_markets');
    if (savedMarkets) {
      try {
        setMarkets(JSON.parse(savedMarkets));
      } catch (e) {
        console.error('Failed to parse markets', e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('rw_betting_manager_markets', JSON.stringify(markets));
  }, [markets]);

  const handleAddMarket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMarketName.trim()) return;

    const newMarket: Market = {
      id: crypto.randomUUID(),
      name: newMarketName.trim()
    };

    setMarkets([...markets, newMarket].sort((a, b) => a.name.localeCompare(b.name)));
    setNewMarketName('');
  };

  const handleDeleteMarket = (id: string) => {
    if (window.confirm('Tem certeza que deseja remover este mercado?')) {
      setMarkets(markets.filter(m => m.id !== id));
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <div className="bg-surface p-6 rounded-xl border border-white/5">
        <h3 className="text-xl font-bold text-textMain mb-4">Gerenciar Mercados</h3>
        
        <form onSubmit={handleAddMarket} className="flex gap-4 mb-6">
          <input
            type="text"
            placeholder="Nome do novo mercado (ex: Over 2.5)"
            value={newMarketName}
            onChange={(e) => setNewMarketName(e.target.value)}
            className="flex-1 bg-background border border-white/10 rounded-lg px-4 py-2 text-textMain focus:outline-none focus:border-primary"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-primary hover:bg-primary/90 text-background font-bold rounded-lg transition-colors flex items-center gap-2"
          >
            <Plus size={20} />
            Adicionar
          </button>
        </form>

        <div className="space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
          {markets.length === 0 ? (
            <div className="text-center p-4 text-textMuted border border-dashed border-white/10 rounded-lg">
              Nenhum mercado cadastrado.
            </div>
          ) : (
            markets.map(market => (
              <div 
                key={market.id}
                className="flex justify-between items-center p-3 bg-background/50 rounded-lg border border-white/5 hover:border-primary/30 transition-colors"
              >
                <span className="text-textMain font-medium">{market.name}</span>
                <button
                  onClick={() => handleDeleteMarket(market.id)}
                  className="text-textMuted hover:text-red-500 hover:bg-red-500/10 p-2 rounded-lg transition-colors"
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
