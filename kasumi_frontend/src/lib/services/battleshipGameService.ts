// Types for the Battleship game
import { battleshipConfig } from '$lib/config/battleshipConfig.js';

// Export types derived from battleshipConfig
export type ShipType = keyof typeof battleshipConfig.shipTypes;
export type ShipPrefix = typeof battleshipConfig.shipTypes[ShipType]['prefix'];
export type CellState = 'empty' | 'ship' | 'hit' | 'miss';
export type Orientation = 'horizontal' | 'vertical';
export type Position = { x: number; y: number };

export interface Ship {
    type: ShipType;
    prefix: ShipPrefix;
    length: number;
    placed: boolean;
    position?: Position;
    orientation?: Orientation;
    id: string;
    hits?: number;
    sunk?: boolean;
}

export interface GameBoard {
    ships: Ship[];
    board: CellState[][];
    shipGrid: (Ship | null)[][];
}

export interface GameMove {
    position: Position;
    result: 'hit' | 'miss' | 'sunk';
    shipId?: string;
}

export interface GameState {
    gameId: string;
    playerBoard: GameBoard;
    opponentBoard: GameBoard;
    currentTurn: 'player' | 'opponent';
    status: 'setup' | 'active' | 'player_won' | 'opponent_won';
    moves: GameMove[];
    lastMoveTime?: number; // Track when the last move was made for timeout
}

// Utility function to generate ships based on battleshipConfig
export function generateShipsFromConfig(isPlaced: boolean = false): Ship[] {
    const ships: Ship[] = [];
    
    // Generate ships from battleshipConfig
    Object.entries(battleshipConfig.shipTypes).forEach(([type, details]) => {
        const shipType = type as ShipType;
        const { length, count, prefix } = details;
        
        // Create the specified number of each ship type
        for (let i = 1; i <= count; i++) {
            const ship: Ship = {
                type: shipType,
                prefix,
                length,
                placed: isPlaced,
                id: `${prefix}${i}`, // e.g., "B1", "F1", "C1"
                hits: 0,
                sunk: false
            };
            ships.push(ship);
        }
    });
    
    return ships;
}

// Interface for the game service - both CPU and human opponents will implement this
export interface IGameService {
    // Game initialization
    createGame(playerName: string): Promise<GameState>;
    joinGame(gameId: string, playerName: string): Promise<GameState>;
    
    // Ship placement
    placeShips(gameId: string, ships: Ship[], board?: CellState[][], shipGrid?: (Ship | null)[][]): Promise<GameState>;
    
    // Game moves
    makeMove(gameId: string, position: Position): Promise<GameMove>;
    
    // Game state
    getGameState(gameId: string): Promise<GameState>;
    
    // Handle bonus shot timeout
    timeoutBonusShot(gameId: string): Promise<GameState>;
}

// CPU implementation of the game service
export class CpuGameService implements IGameService {
    private games: Map<string, GameState> = new Map();
    
    // Helper to generate a random game ID
    private generateGameId(): string {
        return Math.random().toString(36).substring(2, 15);
    }
    
    // Generate random ship placement for the CPU using battleshipConfig
    private generateCpuShips(): Ship[] {
        return generateShipsFromConfig(true);
    }
    
    // Helper to create a CPU move after a delay
    private async makeCpuMove(gameState: GameState): Promise<void> {
        // Simulate CPU "thinking" with a delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Simple strategy: try random positions until a valid move is found
        const BOARD_SIZE = battleshipConfig.boardSize;
        let validMove = false;
        let x = 0;
        let y = 0;
        
        while (!validMove) {
            x = Math.floor(Math.random() * BOARD_SIZE);
            y = Math.floor(Math.random() * BOARD_SIZE);
            
            // Check if this cell hasn't been targeted yet
            const cell = gameState.playerBoard.board[y][x];
            if (cell === 'empty' || cell === 'ship') {
                validMove = true;
            }
        }
        
        // Process the CPU's move
        const position = { x, y };
        const cell = gameState.playerBoard.board[y][x];
        let result: 'hit' | 'miss' | 'sunk' = 'miss';
        let shipId: string | undefined = undefined;
        
        if (cell === 'ship') {
            // It's a hit
            gameState.playerBoard.board[y][x] = 'hit';
            
            // Find which ship was hit
            const ship = gameState.playerBoard.shipGrid[y][x];
            if (ship) {
                shipId = ship.id;
                ship.hits = (ship.hits || 0) + 1;
                
                // Check if the ship is sunk
                if (ship.hits === ship.length) {
                    ship.sunk = true;
                    result = 'sunk';
                } else {
                    result = 'hit';
                }
            }
        } else {
            // It's a miss
            gameState.playerBoard.board[y][x] = 'miss';
        }
        
        // Record the move
        const move: GameMove = { position, result, shipId };
        console.log('CPU move result:', move);
        gameState.moves.push(move);
        
        // Update timestamp for when the move was made
        gameState.lastMoveTime = Date.now();
        
        // Only change turn if it's a miss and bonus shots are enabled
        // Let the component (BattleshipGame.svelte) handle the turn logic instead
        if (!battleshipConfig.bonusShotWhenHit || result === 'miss') {
            gameState.currentTurn = 'player';
        }
        
        // Check for game end
        if (gameState.playerBoard.ships.every(ship => ship.sunk)) {
            gameState.status = 'opponent_won';
            gameState.currentTurn = 'player'; // Set to player so game over is detected
        }
    }
    
    // Implementation of IGameService
    async createGame(playerName: string): Promise<GameState> {
        const gameId = this.generateGameId();
        const BOARD_SIZE = battleshipConfig.boardSize;
        
        const gameState: GameState = {
            gameId,
            playerBoard: {
                ships: [],
                board: Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill('empty')),
                shipGrid: Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null))
            },
            opponentBoard: {
                ships: [],
                board: Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill('empty')),
                shipGrid: Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null))
            },
            currentTurn: 'player',
            status: 'setup',
            moves: [],
            lastMoveTime: Date.now()
        };
        
        this.games.set(gameId, gameState);
        return gameState;
    }
    
    async joinGame(gameId: string, playerName: string): Promise<GameState> {
        // For CPU, this is equivalent to createGame
        return this.createGame(playerName);
    }
    
    async placeShips(gameId: string, ships: Ship[], board?: CellState[][], shipGrid?: (Ship | null)[][]): Promise<GameState> {
        const gameState = this.games.get(gameId);
        if (!gameState) {
            throw new Error('Game not found');
        }
        
        // Save player's ships
        gameState.playerBoard.ships = ships;
        
        // If board and shipGrid are provided, save those too
        if (board && shipGrid) {
            gameState.playerBoard.board = board;
            gameState.playerBoard.shipGrid = shipGrid;
        }

        // Generate CPU ships if not already placed
        if (gameState.opponentBoard.ships.length === 0) {
            const cpuShips = this.generateCpuShips();
            const { board, shipGrid } = this.placeShipsRandomly(cpuShips);
            
            gameState.opponentBoard.ships = cpuShips;
            gameState.opponentBoard.board = board;
            gameState.opponentBoard.shipGrid = shipGrid;
        }
        
        // Start the game
        gameState.status = 'active';
        gameState.lastMoveTime = Date.now();
        
        // Return the updated game state
        return gameState;
    }
    
    private placeShipsRandomly(ships: Ship[]): { board: CellState[][], shipGrid: (Ship | null)[][] } {
        const BOARD_SIZE = battleshipConfig.boardSize;
        let board: CellState[][] = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill('empty'));
        let shipGrid: (Ship | null)[][] = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
        
        // Try to place each ship
        for (const ship of ships) {
            let placed = false;
            let attempts = 0;
            const maxAttempts = 100; // Prevent infinite loops
            
            while (!placed && attempts < maxAttempts) {
                attempts++;
                
                // Random orientation
                const orientation = Math.random() < 0.5 ? 'horizontal' : 'vertical';
                
                // Random position based on orientation
                const maxX = orientation === 'horizontal' ? BOARD_SIZE - ship.length : BOARD_SIZE - 1;
                const maxY = orientation === 'vertical' ? BOARD_SIZE - ship.length : BOARD_SIZE - 1;
                
                const x = Math.floor(Math.random() * (maxX + 1));
                const y = Math.floor(Math.random() * (maxY + 1));
                
                if (this.canPlaceShip(ship, x, y, orientation, board)) {
                    this.placeShip(ship, x, y, orientation, board, shipGrid);
                    placed = true;
                }
            }
            
            if (!placed) {
                console.error(`Failed to place ${String(ship.type)} ${ship.id} after ${maxAttempts} attempts`);
            }
        }
        
        return { board, shipGrid };
    }
    
    private canPlaceShip(ship: Ship, x: number, y: number, orientation: 'horizontal' | 'vertical', board: CellState[][]): boolean {
        const BOARD_SIZE = battleshipConfig.boardSize;
        const length = ship.length;
        
        // Check if ship fits on the board
        for (let i = 0; i < length; i++) {
            const newX = orientation === 'horizontal' ? x + i : x;
            const newY = orientation === 'vertical' ? y + i : y;
            
            if (newX >= BOARD_SIZE || newY >= BOARD_SIZE) return false;
            
            // Check for other ships (including a 1-cell buffer around the ship)
            for (let bufferY = Math.max(0, newY - 1); bufferY <= Math.min(BOARD_SIZE - 1, newY + 1); bufferY++) {
                for (let bufferX = Math.max(0, newX - 1); bufferX <= Math.min(BOARD_SIZE - 1, newX + 1); bufferX++) {
                    if (board[bufferY][bufferX] === 'ship') {
                        return false;
                    }
                }
            }
        }
        
        return true;
    }
    
    private placeShip(ship: Ship, x: number, y: number, orientation: 'horizontal' | 'vertical', board: CellState[][], shipGrid: (Ship | null)[][]) {
        const length = ship.length;
        
        for (let i = 0; i < length; i++) {
            const newX = orientation === 'horizontal' ? x + i : x;
            const newY = orientation === 'vertical' ? y + i : y;
            
            board[newY][newX] = 'ship';
            shipGrid[newY][newX] = ship;
        }
        
        ship.placed = true;
        ship.position = { x, y };
        ship.orientation = orientation;
    }
    
    async makeMove(gameId: string, position: Position): Promise<GameMove> {
        const gameState = this.games.get(gameId);
        if (!gameState) {
            throw new Error('Game not found');
        }
        playerBoardComponent        
        if (gameState.status !== 'active') {
            throw new Error('Game is not active');
        }
        
        if (gameState.currentTurn !== 'player') {
            throw new Error('Not player\'s turn');
        }
        
        const { x, y } = position;
        
        // Check if this cell has already been targeted
        const cell = gameState.opponentBoard.board[y][x];
        if (cell === 'hit' || cell === 'miss') {
            throw new Error('Cell already targeted');
        }
        
        // Process the move
        let result: 'hit' | 'miss' | 'sunk' = 'miss';
        let shipId: string | undefined = undefined;
        
        if (gameState.opponentBoard.shipGrid[y][x]) {
            // It's a hit
            gameState.opponentBoard.board[y][x] = 'hit';
            
            // Find which ship was hit
            const ship = gameState.opponentBoard.shipGrid[y][x];
            if (ship) {
                shipId = ship.id;
                ship.hits = (ship.hits || 0) + 1;
                
                // Check if the ship is sunk
                if (ship.hits === ship.length) {
                    ship.sunk = true;
                    result = 'sunk';
                } else {
                    result = 'hit';
                }
            }
        } else {
            // It's a miss
            gameState.opponentBoard.board[y][x] = 'miss';
        }
        
        // Record the move
        const move: GameMove = { position, result, shipId };
        gameState.moves.push(move);
        gameState.lastMoveTime = Date.now();
        
        console.log('Move result:', result);
        
        // Check for game end
        if (gameState.opponentBoard.ships.every(ship => ship.sunk)) {
            gameState.status = 'player_won';
        } else {
            // Update turn based on the result and bonus shot setting
            if (!battleshipConfig.bonusShotWhenHit || result === 'miss') {
                // If bonus shots are disabled or it was a miss, give turn to opponent
                gameState.currentTurn = 'opponent';
                
                // CPU makes a move (async, doesn't block this response)
                this.makeCpuMove(gameState);
            }
            // If it was a hit and bonus shots are enabled, keep turn as player
        }
        
        return move;
    }
    
    async timeoutBonusShot(gameId: string): Promise<GameState> {
        const gameState = this.games.get(gameId);
        if (!gameState) {
            throw new Error('Game not found');
        }
        
        // Only process timeout if the game is active
        if (gameState.status === 'active') {
            // Check if it's player's turn and they had a bonus shot
            if (gameState.currentTurn === 'player' && 
                gameState.moves.length > 0 && 
                (gameState.moves[gameState.moves.length - 1].result === 'hit' || 
                 gameState.moves[gameState.moves.length - 1].result === 'sunk')) {
                
                // Player timed out on bonus shot, switch to CPU
                console.log('Player bonus shot timed out');
                gameState.currentTurn = 'opponent';
                gameState.lastMoveTime = Date.now();
                
                // CPU makes a move (but we don't wait for it here - the component will handle this)
                this.makeCpuMove(gameState);
            }
            // Similarly handle CPU timeout if needed
            else if (gameState.currentTurn === 'opponent' && 
                    gameState.moves.length > 0 && 
                    (gameState.moves[gameState.moves.length - 1].result === 'hit' || 
                     gameState.moves[gameState.moves.length - 1].result === 'sunk')) {
                
                // CPU timed out on bonus shot, switch to player
                console.log('CPU bonus shot timed out');
                gameState.currentTurn = 'player';
                gameState.lastMoveTime = Date.now();
            }
        }
        
        return gameState;
    }
    
    async getGameState(gameId: string): Promise<GameState> {
        const gameState = this.games.get(gameId);
        if (!gameState) {
            throw new Error('Game not found');
        }
        
        // Check if we need to trigger a turn change due to timeout
        if (gameState.status === 'active' && 
            gameState.lastMoveTime && 
            battleshipConfig.bonusShotWhenHit && 
            Date.now() - gameState.lastMoveTime > battleshipConfig.bonusShotTimeout) {
            
            // Check if a timeout should occur (for either player or CPU)
            if (gameState.currentTurn === 'player' && 
                gameState.moves.length > 0 && 
                (gameState.moves[gameState.moves.length - 1].result === 'hit' || 
                 gameState.moves[gameState.moves.length - 1].result === 'sunk')) {
                
                // Player timed out on bonus shot, switch to CPU
                console.log('Player bonus shot timed out');
                gameState.currentTurn = 'opponent';
                gameState.lastMoveTime = Date.now();
                
                // CPU makes a move
                this.makeCpuMove(gameState);
            } 
            else if (gameState.currentTurn === 'opponent') {
                // CPU timed out on bonus shot, switch to player
                console.log('CPU bonus shot timed out');
                gameState.currentTurn = 'player';
                gameState.lastMoveTime = Date.now();
            }
        }
        
        return gameState;
    }
}

// Exported instance of the game service
export const cpuGameService = new CpuGameService(); 