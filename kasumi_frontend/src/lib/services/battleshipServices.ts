import { env } from '$env/dynamic/public'; 

// Types based on the API implementation
export interface BattleshipConfig {
  boardSize: number;
  bonusShotWhenHit: boolean;
  bonusShotTimeout: number;
  shipTypes: {
    [key: string]: {
      length: number;
      count: number;
      prefix: string;
    };
  };
  debugOpponentBoard: boolean;
  cpuDifficulty?: 'easy' | 'hard';
}

export interface Ship {
  id: string;
  type: string;
  prefix: string;
  length: number;
  placed: boolean;
  hits: number;
  sunk: boolean;
  position?: { x: number; y: number };
  orientation?: 'horizontal' | 'vertical';
}

export interface PlayerBoard {
  ships: Ship[];
  board: string[][];
  shipGrid: (string | null)[][];
  ready: boolean;
}

export interface GameState {
  gameId: string;
  mode: 'cpu' | 'multiplayer';
  status: 'waiting_for_opponent' | 'setup' | 'active' | 'player_won' | 'opponent_won' | 'retreated';
  currentTurn: string | null;
  players: string[];
  playerBoards: { [key: string]: PlayerBoard };
  moves: {
    playerId: string;
    position: { x: number; y: number };
    result: 'hit' | 'miss' | 'sunk';
    shipId: string | null;
    timestamp: number;
  }[];
  lastMoveTime: number;
  bonusShotActive: boolean;
  winner: string | null;
  config: BattleshipConfig;
  winStreaks?: { [player: string]: number };
}

export interface LeaderboardEntry {
  initials: string;
  win_streak: number;
}

// API base URL - changed from localhost:3000 to relative URL
const API_BASE_URL = '/api/battleship';

// Get the public API key from app data if available
const getApiHeaders = () => {
    let apiKey = env.PUBLIC_API_KEY
    return {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
    };
};

// API service
export const battleshipApi = {
    async createGame(initials: string, mode: 'cpu' | 'multiplayer', config?: Partial<BattleshipConfig>): Promise<{ gameId: string; status: string }> {
        const response = await fetch(`${API_BASE_URL}/create_game`, {
            method: 'POST',
            headers: getApiHeaders(),
            body: JSON.stringify({ initials, mode, config })
        });
        return response.json();
    },

    async retreat(gameId: string, initials: string): Promise<{ status: string }> {
        const response = await fetch(`${API_BASE_URL}/retreat`, {
            method: 'POST',
            headers: getApiHeaders(),
            body: JSON.stringify({ gameId, initials })
        });
        return response.json();
    },

    async reMatch(gameId: string, initials: string): Promise<{ status: string; gameState?: GameState }> {
        const response = await fetch(`${API_BASE_URL}/re_match`, {
            method: 'POST',
            headers: getApiHeaders(),
            body: JSON.stringify({ gameId, initials })
        });
        return response.json();
    },

    async leaveGame(gameId: string, initials: string): Promise<{ status: string }> {
        const response = await fetch(`${API_BASE_URL}/leave_game`, {
            method: 'POST',
            headers: getApiHeaders(),
            body: JSON.stringify({ gameId, initials })
        });
        return response.json();
    },
    
    async joinGame(gameId: string, initials: string): Promise<{ status: string }> {
        const response = await fetch(`${API_BASE_URL}/join_game`, {
            method: 'POST',
            headers: getApiHeaders(),
            body: JSON.stringify({ gameId, initials })
        });
        return response.json();
    },

    async placeFleet(gameId: string, initials: string, shipGrid: (string | null)[][], ships: Ship[]): Promise<{ status: string; message: string }> {
        const response = await fetch(`${API_BASE_URL}/place_fleet`, {
            method: 'POST',
            headers: getApiHeaders(),
            body: JSON.stringify({ gameId, initials, shipGrid, ships })
        });
        return response.json();
    },

    /**
     * Fires a shot at the opponent's board at the specified position
     * 
     * @param gameId - The ID of the current game
     * @param initials - The player's initials making the shot
     * @param position - The x,y coordinates to fire at on the opponent's board
     * @returns {
     *   result: 'hit' | 'miss' | 'sunk' - The result of the shot
     *   shipId: string | null - The ID of the ship that was hit (if any) 
     *   status: string - The status of the API request ('success' or 'error')
     *   message?: string - Error message if status is 'error' (e.g. "Not your turn", "Cell already targeted")
     * }
     * 
     * This function sends a POST request to fire a shot during gameplay.
     * If the shot hits a ship, it returns 'hit' and the ship's ID.
     * If the shot misses, it returns 'miss' with no shipId.
     * If the shot sinks a ship, it returns 'sunk' with the ship's ID.
     * The backend validates that it's the player's turn and the shot is valid.
     * If validation fails, it returns an error status with an explanatory message.
     */
    async fire(gameId: string, initials: string, position: { x: number; y: number }): Promise<{ result: 'hit' | 'miss' | 'sunk'; shipId: string | null; status: string; message?: string }> {
        const response = await fetch(`${API_BASE_URL}/fire`, {
            method: 'POST',
            headers: getApiHeaders(),
            body: JSON.stringify({ gameId, initials, position })
        });
        return response.json();
    },

    async getGameState(gameId: string, initials: string, lastUpdate?: number): Promise<{ gameState: GameState; status: string }> {
        const params = new URLSearchParams({ gameId, initials });
        if (lastUpdate) params.append('lastUpdate', lastUpdate.toString());
        
        const response = await fetch(`${API_BASE_URL}/game_state?${params}`, {
            headers: getApiHeaders()
        });
        return response.json();
    },

    async timeoutBonusShot(gameId: string, initials: string): Promise<{ gameState: GameState; status: string }> {
        const response = await fetch(`${API_BASE_URL}/timeout_bonus_shot`, {
            method: 'POST',
            headers: getApiHeaders(),
            body: JSON.stringify({ gameId, initials })
        });
        return response.json();
    },

    async submitScore(gameId: string, initials: string): Promise<void> {
        try {
            const response = await fetch(`${API_BASE_URL}/submit_score`, {
                method: 'POST',
                headers: getApiHeaders(),
                body: JSON.stringify({ gameId, initials })
            });
            
            // Check if response is OK before trying to parse JSON
            if (!response.ok) {
                throw new Error(`Server returned ${response.status}: ${response.statusText}`);
            }
            
            // Try to parse JSON, but don't fail if the response is empty or not JSON
            const text = await response.text();
            if (text) {
                return JSON.parse(text);
            }
        } catch (error) {
            console.error('Error submitting score:', error);
            throw error;
        }
    },

    async getLeaderboard(): Promise<LeaderboardEntry[]> {
        try {
            const response = await fetch(`${API_BASE_URL}/get_leaderboard`, {
                headers: getApiHeaders()
            });
            
            if (!response.ok) {
                throw new Error(`Server returned ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error fetching leaderboard:', error);
            return [];
        }
    }
}; 