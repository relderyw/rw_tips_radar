import { MatchResponse } from './types';

const API_URL = 'https://rwtips-r943.onrender.com/api/historico/partidas';

export const fetchMatches = async (page: number = 1): Promise<MatchResponse> => {
  try {
    const response = await fetch(`${API_URL}?page=${page}`);
    if (!response.ok) {
      throw new Error('Failed to fetch matches');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching matches:', error);
    throw error;
  }
};
