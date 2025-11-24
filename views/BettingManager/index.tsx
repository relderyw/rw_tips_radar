import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { Dashboard } from './Dashboard';
import { BetList } from './BetList';
import { AddBetForm } from './AddBetForm';
import { Bet } from './types';

export const BettingManager: React.FC = () => {
  const [bets, setBets] = useState<Bet[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    const savedBets = localStorage.getItem('rw_betting_manager_bets');
    if (savedBets) {
      try {
        setBets(JSON.parse(savedBets));
      } catch (e) {
        console.error('Failed to parse bets', e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('rw_betting_manager_bets', JSON.stringify(bets));
  }, [bets]);

  const handleAddBet = (bet: Bet) => {
    setBets([bet, ...bets]);
    setShowAddForm(false);
  };

  const handleDeleteBet = (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta aposta?')) {
      setBets(bets.filter(b => b.id !== id));
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">
            Gerenciador de Apostas
          </h1>
          <p className="text-textMuted mt-1">Gerencie suas entradas e acompanhe seus lucros</p>
        </div>
        
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="px-4 py-2 bg-primary hover:bg-primary/90 text-background font-bold rounded-lg transition-colors flex items-center gap-2 shadow-lg shadow-primary/20"
          >
            <Plus size={20} />
            Nova Aposta
          </button>
        )}
      </div>

      <Dashboard bets={bets} />

      {showAddForm && (
        <AddBetForm 
          onAddBet={handleAddBet} 
          onCancel={() => setShowAddForm(false)} 
        />
      )}

      <div className="bg-surface rounded-xl border border-white/5 overflow-hidden">
        <div className="p-4 border-b border-white/5 flex justify-between items-center">
          <h2 className="font-bold text-lg text-textMain">Histórico de Apostas</h2>
        </div>
        <BetList bets={bets} onDelete={handleDeleteBet} />
      </div>
    </div>
  );
};
