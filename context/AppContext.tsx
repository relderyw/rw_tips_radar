import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { fetchGames } from '../services/api';
import { processRawGames } from '../utils/stats';
import { ProcessedGame } from '../types';

interface AppContextType {
  games: ProcessedGame[];
  loading: boolean;
  refreshData: () => Promise<void>;
  leagues: string[];
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [games, setGames] = useState<ProcessedGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [leagues, setLeagues] = useState<string[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const rawGames = await fetchGames();
      const processed = processRawGames(rawGames);
      setGames(processed);
      
      const uniqueLeagues = Array.from(new Set(processed.map(g => g.league))).sort();
      setLeagues(uniqueLeagues);
    } catch (error) {
      console.error("Failed to load data", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <AppContext.Provider value={{ games, loading, refreshData: loadData, leagues }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
