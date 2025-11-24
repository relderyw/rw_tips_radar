import React, { useState, useEffect } from 'react';
import { LayoutDashboard, PlusCircle, List, Settings } from 'lucide-react';
import { Dashboard } from './Dashboard';
import { AddBetForm } from './AddBetForm';
import { Markets } from './Markets';
import { Bet } from './types';

type Tab = 'dashboard' | 'new-bet' | 'markets';

export const BettingManager: React.FC = () => {
  const [bets, setBets] = useState<Bet[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

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
    setActiveTab('dashboard'); // Switch back to dashboard after adding
  };

  const handleDeleteBet = (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta aposta?')) {
      setBets(bets.filter(b => b.id !== id));
    }
  };

  const handleUpdateBet = (updatedBet: Bet) => {
    setBets(bets.map(b => b.id === updatedBet.id ? updatedBet : b));
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
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-surface/50 p-1 rounded-xl border border-white/5 w-fit">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${
            activeTab === 'dashboard' 
              ? 'bg-primary/10 text-primary font-bold shadow-sm' 
              : 'text-textMuted hover:text-textMain hover:bg-white/5'
          }`}
        >
          <LayoutDashboard size={18} />
          Dashboard
        </button>
        <button
          onClick={() => setActiveTab('new-bet')}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${
            activeTab === 'new-bet' 
              ? 'bg-primary/10 text-primary font-bold shadow-sm' 
              : 'text-textMuted hover:text-textMain hover:bg-white/5'
          }`}
        >
          <PlusCircle size={18} />
          Nova Aposta
        </button>
        <button
          onClick={() => setActiveTab('markets')}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${
            activeTab === 'markets' 
              ? 'bg-primary/10 text-primary font-bold shadow-sm' 
              : 'text-textMuted hover:text-textMain hover:bg-white/5'
          }`}
        >
          <List size={18} />
          Mercados
        </button>
      </div>

      <div className="min-h-[60vh]">
        {activeTab === 'dashboard' && (
          <Dashboard 
            bets={bets} 
            onDelete={handleDeleteBet}
            onUpdate={handleUpdateBet}
          />
        )}

        {activeTab === 'new-bet' && (
          <AddBetForm 
            onAddBet={handleAddBet} 
            onCancel={() => setActiveTab('dashboard')} 
          />
        )}

        {activeTab === 'markets' && (
          <Markets />
        )}
      </div>
    </div>
  );
};
