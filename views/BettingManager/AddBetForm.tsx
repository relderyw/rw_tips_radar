import React, { useState, useEffect } from 'react';
import { Search, Filter, Plus, Save, X, Calendar } from 'lucide-react';
import { fetchMatches } from './api';
import { Match, Bet, BetResult, Market } from './types';

interface AddBetFormProps {
  onAddBet: (bet: Bet) => void;
  onCancel: () => void;
}

export const AddBetForm: React.FC<AddBetFormProps> = ({ onAddBet, onCancel }) => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedLeagueFilter, setSelectedLeagueFilter] = useState('');
  const [selectedHomePlayerFilter, setSelectedHomePlayerFilter] = useState('');
  const [selectedAwayPlayerFilter, setSelectedAwayPlayerFilter] = useState('');
  const [markets, setMarkets] = useState<Market[]>([]);

  // Form State
  const [isManual, setIsManual] = useState(false);
  const [league, setLeague] = useState('');
  const [homePlayer, setHomePlayer] = useState('');
  const [awayPlayer, setAwayPlayer] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 16)); // YYYY-MM-DDTHH:mm
  const [matchId, setMatchId] = useState<string | undefined>(undefined);
  
  const [market, setMarket] = useState('');
  const [odds, setOdds] = useState<string>('');
  const [stake, setStake] = useState<string>('');
  const [result, setResult] = useState<BetResult>('Pending');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    loadMatches();
    loadMarkets();
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

  const loadMarkets = () => {
    const savedMarkets = localStorage.getItem('rw_betting_manager_markets');
    if (savedMarkets) {
      try {
        setMarkets(JSON.parse(savedMarkets));
      } catch (e) {
        console.error('Failed to parse markets', e);
      }
    }
  };

  const handleSelectMatch = (match: Match) => {
    setLeague(match.league_name);
    setHomePlayer(match.home_player);
    setAwayPlayer(match.away_player);
    setDate(new Date(match.data_realizacao).toISOString().slice(0, 16));
    setMatchId(match.id);
    setIsManual(true); // Switch to form view with pre-filled data
  };

  // Extract unique values for filters
  const leagues = Array.from(new Set(matches.map(m => m.league_name))).sort();

  const filteredMatchesForPlayers = selectedLeagueFilter 
    ? matches.filter(m => m.league_name === selectedLeagueFilter)
    : matches;

  const homePlayers = Array.from(new Set(filteredMatchesForPlayers.map(m => m.home_player))).sort();
  const awayPlayers = Array.from(new Set(filteredMatchesForPlayers.map(m => m.away_player))).sort();

  const filteredMatches = matches.filter(m => {
    const matchLeague = !selectedLeagueFilter || m.league_name === selectedLeagueFilter;
    const matchHome = !selectedHomePlayerFilter || m.home_player === selectedHomePlayerFilter;
    const matchAway = !selectedAwayPlayerFilter || m.away_player === selectedAwayPlayerFilter;
    return matchLeague && matchHome && matchAway;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const numOdds = parseFloat(odds);
    const numStake = parseFloat(stake);
    
    let profit = 0;
    if (result === 'Win') profit = (numStake * numOdds) - numStake;
    else if (result === 'Loss') profit = -numStake;
    else if (result === 'HalfWin') profit = ((numStake / 2) * numOdds) - (numStake / 2);
    else if (result === 'HalfLoss') profit = -(numStake / 2);
    else if (result === 'Void') profit = 0;

    const newBet: Bet = {
      id: crypto.randomUUID(),
      matchId,
      date: new Date(date).toISOString(),
      league,
      homePlayer,
      awayPlayer,
      market,
      odds: numOdds,
      stake: numStake,
      result,
      profit,
      notes
    };

    onAddBet(newBet);
  };

  // Calculate potential profit for preview
  const calculatePotentialProfit = () => {
    const numOdds = parseFloat(odds) || 0;
    const numStake = parseFloat(stake) || 0;
    if (result === 'Win') return (numStake * numOdds) - numStake;
    if (result === 'Loss') return -numStake;
    if (result === 'HalfWin') return ((numStake / 2) * numOdds) - (numStake / 2);
    if (result === 'HalfLoss') return -(numStake / 2);
    return 0;
  };

  const potentialProfit = calculatePotentialProfit();

  return (
    <div className="bg-surface p-6 rounded-xl border border-white/5 animate-in fade-in slide-in-from-top-4">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold text-textMain">Nova Aposta</h3>
        <button onClick={onCancel} className="text-textMuted hover:text-white">
          <X size={20} />
        </button>
      </div>

      {!isManual ? (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-textMuted text-sm">Selecione uma partida ou crie manualmente:</p>
            <button 
              onClick={() => setIsManual(true)}
              className="px-4 py-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg text-sm font-bold transition-colors"
            >
              Criar Manualmente
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-textMuted mb-1">Filtrar Liga</label>
              <select
                value={selectedLeagueFilter}
                onChange={(e) => setSelectedLeagueFilter(e.target.value)}
                className="w-full bg-background border border-white/10 rounded-lg px-4 py-2 text-textMain focus:outline-none focus:border-primary"
              >
                <option value="">Todas as Ligas</option>
                {leagues.map(l => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-textMuted mb-1">Filtrar Jogador Casa</label>
              <select
                value={selectedHomePlayerFilter}
                onChange={(e) => setSelectedHomePlayerFilter(e.target.value)}
                className="w-full bg-background border border-white/10 rounded-lg px-4 py-2 text-textMain focus:outline-none focus:border-primary"
              >
                <option value="">Todos</option>
                {homePlayers.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-textMuted mb-1">Filtrar Jogador Fora</label>
              <select
                value={selectedAwayPlayerFilter}
                onChange={(e) => setSelectedAwayPlayerFilter(e.target.value)}
                className="w-full bg-background border border-white/10 rounded-lg px-4 py-2 text-textMain focus:outline-none focus:border-primary"
              >
                <option value="">Todos</option>
                {awayPlayers.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
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
                  onClick={() => handleSelectMatch(match)}
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
          <div className="flex justify-between items-center mb-4">
            <h4 className="font-bold text-textMain">Detalhes da Partida</h4>
            <button 
              type="button" 
              onClick={() => {
                setIsManual(false);
                setMatchId(undefined);
              }}
              className="text-xs text-primary hover:text-primary/80 underline"
            >
              Voltar para Seleção
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-textMuted mb-1">Liga</label>
              <input
                required
                type="text"
                value={league}
                onChange={(e) => setLeague(e.target.value)}
                className="w-full bg-background border border-white/10 rounded-lg px-4 py-2 text-textMain focus:outline-none focus:border-primary"
                placeholder="Ex: Battle 8 min"
              />
            </div>
            <div>
              <label className="block text-sm text-textMuted mb-1">Data</label>
              <input
                required
                type="datetime-local"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-background border border-white/10 rounded-lg px-4 py-2 text-textMain focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm text-textMuted mb-1">Jogador Casa</label>
              <input
                required
                type="text"
                value={homePlayer}
                onChange={(e) => setHomePlayer(e.target.value)}
                className="w-full bg-background border border-white/10 rounded-lg px-4 py-2 text-textMain focus:outline-none focus:border-primary"
                placeholder="Nome do Jogador 1"
              />
            </div>
            <div>
              <label className="block text-sm text-textMuted mb-1">Jogador Fora</label>
              <input
                required
                type="text"
                value={awayPlayer}
                onChange={(e) => setAwayPlayer(e.target.value)}
                className="w-full bg-background border border-white/10 rounded-lg px-4 py-2 text-textMain focus:outline-none focus:border-primary"
                placeholder="Nome do Jogador 2"
              />
            </div>
          </div>

          <div className="border-t border-white/5 my-4"></div>

          <h4 className="font-bold text-textMain mb-4">Detalhes da Aposta</h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-textMuted mb-1">Mercado</label>
              <select
                required
                value={market}
                onChange={(e) => setMarket(e.target.value)}
                className="w-full bg-background border border-white/10 rounded-lg px-4 py-2 text-textMain focus:outline-none focus:border-primary"
              >
                <option value="">Selecione um Mercado</option>
                {markets.map(m => (
                  <option key={m.id} value={m.name}>{m.name}</option>
                ))}
              </select>
              {markets.length === 0 && (
                <p className="text-xs text-yellow-500 mt-1">Cadastre mercados na aba "Mercados"</p>
              )}
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
                <option value="HalfWin">Meio Green</option>
                <option value="HalfLoss">Meio Red</option>
                <option value="Void">Reembolso</option>
              </select>
            </div>
          </div>

          <div className={`p-4 rounded-lg border border-l-4 flex justify-between items-center ${
            potentialProfit >= 0 
              ? 'bg-green-500/5 border-green-500/20 border-l-green-500' 
              : 'bg-red-500/5 border-red-500/20 border-l-red-500'
          }`}>
            <span className="text-sm font-medium text-textMuted">Resultado Final Estimado:</span>
            <span className={`text-xl font-bold ${potentialProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {potentialProfit >= 0 ? '+' : ''}{potentialProfit.toFixed(2)} R$
            </span>
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
