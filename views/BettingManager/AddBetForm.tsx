import React, { useState, useEffect } from 'react';
import { Search, Filter, Plus, Save, X } from 'lucide-react';
import { fetchMatches } from './api';
import { Match, Bet, BetResult } from './types';

interface AddBetFormProps {
  onAddBet: (bet: Bet) => void;
  onCancel: () => void;
}

export const AddBetForm: React.FC<AddBetFormProps> = ({ onAddBet, onCancel }) => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);

  // Form State
  const [selection, setSelection] = useState('');
  const [odds, setOdds] = useState<string>('');
  const [stake, setStake] = useState<string>('');
  const [result, setResult] = useState<BetResult>('Pending');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    loadMatches();
  }, []);

  const loadMatches = async () => {
    setLoading(true);
    try {
      const data = await fetchMatches(1); // Load first page for now
      setMatches(data.partidas);
    } catch (error) {
      console.error('Failed to load matches', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredMatches = matches.filter(m => 
    m.home_player.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.away_player.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.home_team.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.away_team.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMatch) return;

    const numOdds = parseFloat(odds);
    const numStake = parseFloat(stake);
    
    let profit = 0;
    if (result === 'Win') {
      profit = (numStake * numOdds) - numStake;
    } else if (result === 'Loss') {
      profit = -numStake;
    }

    const newBet: Bet = {
      id: crypto.randomUUID(),
      matchId: selectedMatch.id,
      date: new Date().toISOString(),
      league: selectedMatch.league_name,
      homePlayer: selectedMatch.home_player,
      awayPlayer: selectedMatch.away_player,
      selection,
      odds: numOdds,
      stake: numStake,
      result,
      profit,
      notes
    };

    onAddBet(newBet);
  };

  return (
    <div className="bg-surface p-6 rounded-xl border border-white/5 animate-in fade-in slide-in-from-top-4">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold text-textMain">Nova Aposta</h3>
        <button onClick={onCancel} className="text-textMuted hover:text-white">
          <X size={20} />
        </button>
      </div>

      {!selectedMatch ? (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-textMuted" size={18} />
            <input
              type="text"
              placeholder="Buscar partida (jogador, time)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-background border border-white/10 rounded-lg pl-10 pr-4 py-2 text-textMain focus:outline-none focus:border-primary"
            />
          </div>

          <div className="max-h-60 overflow-y-auto space-y-2 custom-scrollbar">
            {loading ? (
              <div className="text-center p-4 text-textMuted">Carregando partidas...</div>
            ) : filteredMatches.length === 0 ? (
              <div className="text-center p-4 text-textMuted">Nenhuma partida encontrada</div>
            ) : (
              filteredMatches.map(match => (
                <div 
                  key={match.id}
                  onClick={() => setSelectedMatch(match)}
                  className="p-3 bg-background/50 rounded-lg border border-white/5 hover:border-primary/50 cursor-pointer transition-colors flex justify-between items-center"
                >
                  <div className="flex flex-col">
                    <span className="text-xs text-textMuted">{match.league_name}</span>
                    <span className="font-medium text-textMain">
                      {match.home_player} ({match.home_team}) vs {match.away_player} ({match.away_team})
                    </span>
                    <span className="text-xs text-textMuted">
                      {new Date(match.data_realizacao).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-textMain">
                      {match.score_home} - {match.score_away}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg flex justify-between items-center mb-4">
            <div>
              <span className="block text-xs text-primary/80">Partida Selecionada</span>
              <span className="font-bold text-primary">
                {selectedMatch.home_player} vs {selectedMatch.away_player}
              </span>
            </div>
            <button 
              type="button" 
              onClick={() => setSelectedMatch(null)}
              className="text-xs text-textMuted hover:text-white underline"
            >
              Alterar
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-textMuted mb-1">Seleção</label>
              <input
                required
                type="text"
                placeholder="Ex: Casa Vence, Over 2.5"
                value={selection}
                onChange={(e) => setSelection(e.target.value)}
                className="w-full bg-background border border-white/10 rounded-lg px-4 py-2 text-textMain focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm text-textMuted mb-1">Odds</label>
              <input
                required
                type="number"
                step="0.01"
                placeholder="1.90"
                value={odds}
                onChange={(e) => setOdds(e.target.value)}
                className="w-full bg-background border border-white/10 rounded-lg px-4 py-2 text-textMain focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm text-textMuted mb-1">Valor (R$)</label>
              <input
                required
                type="number"
                step="0.01"
                placeholder="50.00"
                value={stake}
                onChange={(e) => setStake(e.target.value)}
                className="w-full bg-background border border-white/10 rounded-lg px-4 py-2 text-textMain focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm text-textMuted mb-1">Resultado</label>
              <select
                value={result}
                onChange={(e) => setResult(e.target.value as BetResult)}
                className="w-full bg-background border border-white/10 rounded-lg px-4 py-2 text-textMain focus:outline-none focus:border-primary"
              >
                <option value="Pending">Pendente</option>
                <option value="Win">Green (Vitória)</option>
                <option value="Loss">Red (Derrota)</option>
                <option value="Void">Anulada</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm text-textMuted mb-1">Notas (Opcional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-background border border-white/10 rounded-lg px-4 py-2 text-textMain focus:outline-none focus:border-primary h-20 resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded-lg text-textMuted hover:bg-white/5 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-primary hover:bg-primary/90 text-background font-bold rounded-lg transition-colors flex items-center gap-2"
            >
              <Save size={18} />
              Salvar Aposta
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
