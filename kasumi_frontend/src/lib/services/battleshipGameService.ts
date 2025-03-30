// Types for the Battleship game
export type ShipType = 'battleship' | 'frigate' | 'corvette' | 'uboat';
export type CellState = 'empty' | 'ship' | 'hit' | 'miss';
export type Orientation = 'horizontal' | 'vertical';
export type Position = { x: number; y: number };

export interface Ship {
    type: ShipType;
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
}

// Interface for the game service - both CPU and human opponents will implement this
export interface IGameService {
    // Game initialization
    createGame(playerName: string): Promise<GameState>;
    joinGame(gameId: string, playerName: string): Promise<GameState>;
    
    // Ship placement
    placeShips(gameId: string, ships: Ship[]): Promise<GameState>;
    
    // Game moves
    makeMove(gameId: string, position: Position): Promise<GameMove>;
    
    // Game state
    getGameState(gameId: string): Promise<GameState>;
}

// CPU implementation of the game service
export class CpuGameService implements IGameService {
    private games: Map<string, GameState> = new Map();
    
    // Helper to generate a random game ID
    private generateGameId(): string {
        return Math.random().toString(36).substring(2, 15);
    }
    
    // Generate random ship placement for the CPU
    private generateCpuShips(): Ship[] {
        const ships: Ship[] = [
            { type: 'battleship', length: 5, placed: true, id: 'B1', hits: 0, sunk: false },
            { type: 'frigate', length: 3, placed: true, id: 'F1', hits: 0, sunk: false },
            { type: 'corvette', length: 2, placed: true, id: 'C1', hits: 0, sunk: false },
            { type: 'corvette', length: 2, placed: true, id: 'C2', hits: 0, sunk: false },
            { type: 'uboat', length: 1, placed: true, id: 'U1', hits: 0, sunk: false },
            { type: 'uboat', length: 1, placed: true, id: 'U2', hits: 0, sunk: false },
            { type: 'uboat', length: 1, placed: true, id: 'U3', hits: 0, sunk: false },
            { type: 'uboat', length: 1, placed: true, id: 'U4', hits: 0, sunk: false }
        ];
        return ships;
    }
    
    // Helper to create a CPU move after a delay
    private async makeCpuMove(gameState: GameState): Promise<void> {
        // Simulate CPU "thinking" with a delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Simple strategy: try random positions until a valid move is found
        const BOARD_SIZE = 10;
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
        gameState.moves.push(move);
        
        // Update turn
        gameState.currentTurn = 'player';
        
        // Check for game end
        if (gameState.playerBoard.ships.every(ship => ship.sunk)) {
            gameState.status = 'opponent_won';
        }
    }
    
    // Implementation of IGameService
    async createGame(playerName: string): Promise<GameState> {
        const gameId = this.generateGameId();
        
        const gameState: GameState = {
            gameId,
            playerBoard: {
                ships: [],
                board: Array(10).fill(null).map(() => Array(10).fill('empty')),
                shipGrid: Array(10).fill(null).map(() => Array(10).fill(null))
            },
            opponentBoard: {
                ships: [],
                board: Array(10).fill(null).map(() => Array(10).fill('empty')),
                shipGrid: Array(10).fill(null).map(() => Array(10).fill(null))
            },
            currentTurn: 'player',
            status: 'setup',
            moves: []
        };
        
        this.games.set(gameId, gameState);
        return gameState;
    }
    
    async joinGame(gameId: string, playerName: string): Promise<GameState> {
        // For CPU, this is equivalent to createGame
        return this.createGame(playerName);
    }
    
    async placeShips(gameId: string, ships: Ship[]): Promise<GameState> {
        const gameState = this.games.get(gameId);
        if (!gameState) {
            throw new Error('Game not found');
        }
        
        // Save player's ships
        gameState.playerBoard.ships = ships;

        // Generate CPU ships if not already placed
        if (gameState.opponentBoard.ships.length === 0) {
            const cpuShips = this.generateCpuShips();
            const { board, shipGrid } = this.placeShipsRandomly(cpuShips);
            
            gameState.opponentBoard.ships = cpuShips;
            gameState.opponentBoard.board = board;
            gameState.opponentBoard.shipGrid = shipGrid;
            
            // Log the CPU ship positions for debugging
            console.log("CPU ships placed at:");
            for (const ship of cpuShips) {
                console.log(`${ship.id}: position (${ship.position?.x},${ship.position?.y}), orientation: ${ship.orientation}, length: ${ship.length}`);
            }
        }
        
        // Start the game
        gameState.status = 'active';
        
        // Return the updated game state
        return gameState;
    }
    
    private placeShipsRandomly(ships: Ship[]): { board: CellState[][], shipGrid: (Ship | null)[][] } {
        const BOARD_SIZE = 10;
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
                console.error(`Failed to place ${ship.type} ${ship.id} after ${maxAttempts} attempts`);
            }
        }
        
        return { board, shipGrid };
    }
    
    private canPlaceShip(ship: Ship, x: number, y: number, orientation: 'horizontal' | 'vertical', board: CellState[][]): boolean {
        const BOARD_SIZE = 10;
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
        
        // Debug state of the game board
        console.log("Current game board state:");
        for (let y = 0; y < 10; y++) {
            let row = '';
            for (let x = 0; x < 10; x++) {
                const cell = gameState.opponentBoard.board[y][x];
                const ship = gameState.opponentBoard.shipGrid[y][x];
                const shipId = ship ? ship.id : ' ';
                row += `${cell[0]}(${shipId}) `;
            }
            console.log(row);
        }
        
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
        
        // Log debug info to help diagnose issues
        console.log('Player firing at:', x, y);
        console.log('Cell state:', cell);
        console.log('Ship at position:', gameState.opponentBoard.shipGrid[y][x]);
        
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
                
                console.log('Ship hit:', ship.type, ship.id);
                console.log('Ship hits:', ship.hits, 'of', ship.length);
                
                // Check if the ship is sunk
                if (ship.hits === ship.length) {
                    ship.sunk = true;
                    result = 'sunk';
                    console.log('Ship sunk!');
                } else {
                    result = 'hit';
                    console.log('Ship hit but not sunk');
                }
            }
        } else {
            // It's a miss
            gameState.opponentBoard.board[y][x] = 'miss';
            console.log('Shot missed');
        }
        
        // Record the move
        const move: GameMove = { position, result, shipId };
        gameState.moves.push(move);
        
        console.log('Move result:', result);
        
        // Check for game end
        if (gameState.opponentBoard.ships.every(ship => ship.sunk)) {
            gameState.status = 'player_won';
            console.log('Player won!');
        } else {
            // Update turn and let CPU make its move
            gameState.currentTurn = 'opponent';
            
            // CPU makes a move (async, doesn't block this response)
            this.makeCpuMove(gameState);
        }
        
        return move;
    }
    
    async getGameState(gameId: string): Promise<GameState> {
        const gameState = this.games.get(gameId);
        if (!gameState) {
            throw new Error('Game not found');
        }
        
        return gameState;
    }
}

// Exported instance of the game service
export const cpuGameService = new CpuGameService(); 