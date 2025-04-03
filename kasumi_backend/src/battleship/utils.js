/**
 * Default battleship game configuration (used if client doesn't provide one)
 */
const defaultBattleshipConfig = {
  boardSize: 10,
  bonusShotWhenHit: true,
  bonusShotTimeout: 5000, // 5 seconds
  shipTypes: {
    carrier: { length: 5, count: 1, prefix: "C" },
    battleship: { length: 4, count: 1, prefix: "B" },
    cruiser: { length: 3, count: 1, prefix: "R" },
    submarine: { length: 3, count: 1, prefix: "S" },
    destroyer: { length: 2, count: 3, prefix: "D" }
  },
  debugCpuBoard: false,
  cpuName: 'CPU',
  cpuDifficulty: 'easy' // New option: 'easy' (random) or 'hard' (smart targeting)
};

/**
 * Generate a random game ID
 * @returns {string} A 6-character uppercase game ID
 */
function generateGameId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

/**
 * Create an empty board for a player
 * @param {Object} shipTypes - Configuration of ship types with their details
 * @param {number} boardSize - Size of the board
 * @returns {Object} Empty board object with ships array, board grid, and shipGrid
 */
function createEmptyBoard(shipTypes, boardSize) {
  return {
    ships: Object.entries(shipTypes).flatMap(([type, details]) => {
      const { length, count, prefix } = details;
      return Array(count).fill().map((_, i) => ({
        id: `${prefix}${i + 1}`,
        type,
        prefix, 
        length,
        placed: false,
        hits: 0,
        sunk: false,
        position: null  // Add position property initialized as null
      }));
    }),
    board: Array(boardSize).fill(null).map(() => Array(boardSize).fill('empty')),
    shipGrid: Array(boardSize).fill(null).map(() => Array(boardSize).fill(null)),
    ready: false
  };
}

/**
 * Validate a battleship configuration
 * @param {Object} config - Client-provided configuration
 * @returns {Object} Validated configuration or default if invalid
 */
function validateBattleshipConfig(config) {
  if (!config) return defaultBattleshipConfig;
  
  const validatedConfig = { ...defaultBattleshipConfig };
  
  // Validate boardSize (must be between 5 and 20)
  if (config.boardSize && typeof config.boardSize === 'number' && 
      config.boardSize >= 5 && config.boardSize <= 20) {
    validatedConfig.boardSize = config.boardSize;
  }
  
  // Validate bonusShotWhenHit
  if (typeof config.bonusShotWhenHit === 'boolean') {
    validatedConfig.bonusShotWhenHit = config.bonusShotWhenHit;
  }
  
  // Validate bonusShotTimeout (must be between 1000 and 60000)
  if (config.bonusShotTimeout && typeof config.bonusShotTimeout === 'number' && 
      config.bonusShotTimeout >= 1000 && config.bonusShotTimeout <= 60000) {
    validatedConfig.bonusShotTimeout = config.bonusShotTimeout;
  }
  
  // Validate shipTypes
  if (config.shipTypes && typeof config.shipTypes === 'object') {
    const shipTypes = {};
    let valid = false;
    
    // Check each ship type
    for (const [type, details] of Object.entries(config.shipTypes)) {
      if (details && typeof details === 'object' && 
          typeof details.length === 'number' && details.length > 0 && 
          typeof details.count === 'number' && details.count > 0 && 
          typeof details.prefix === 'string' && details.prefix.length === 1) {
        shipTypes[type] = {
          length: details.length,
          count: details.count,
          prefix: details.prefix
        };
        valid = true;
      }
    }

    // Validate debugCpuBoard
    if (config.debugCpuBoard && typeof config.debugCpuBoard === 'boolean') {
      validatedConfig.debugCpuBoard = config.debugCpuBoard;
    }

    // Validate cpuName
    if (config.cpuName && typeof config.cpuName === 'string' && config.cpuName.length <= 10 && /^[A-Za-z0-9\s\.-]{3,10}$/.test(config.cpuName)) {
      validatedConfig.cpuName = config.cpuName;
    }
    
    // Validate cpuDifficulty
    if (config.cpuDifficulty && typeof config.cpuDifficulty === 'string' && 
        (config.cpuDifficulty === 'easy' || config.cpuDifficulty === 'hard')) {
      validatedConfig.cpuDifficulty = config.cpuDifficulty;
    }

    // Only replace default ship types if at least one valid ship was defined
    if (valid) {
      validatedConfig.shipTypes = shipTypes;
    }

  }
  
  return validatedConfig;
}

/**
 * CPU logic - place ships randomly on the board
 */
function placeCpuShips(gameState) {
  if (!gameState.playerBoards[gameState.config.cpuName]) return;
  
  const cpuBoard = gameState.playerBoards[gameState.config.cpuName];
  const ships = gameState.playerBoards[gameState.config.cpuName].ships;

  const config = gameState.config; 
  const board_size = config.boardSize;
  
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
      const maxX = orientation === 'horizontal' ? board_size - ship.length : board_size - 1;
      const maxY = orientation === 'vertical' ? board_size - ship.length : board_size - 1;
      
      const x = Math.floor(Math.random() * (maxX + 1));
      const y = Math.floor(Math.random() * (maxY + 1));
      
      if (canPlaceShip(ship, x, y, orientation, cpuBoard.board, board_size)) {
        // Place the ship
        ship.placed = true;
        ship.position = { x, y };
        ship.orientation = orientation;
        
        for (let i = 0; i < ship.length; i++) {
          const newX = orientation === 'horizontal' ? x + i : x;
          const newY = orientation === 'vertical' ? y + i : y;
          
          cpuBoard.board[newY][newX] = 'ship';
          cpuBoard.shipGrid[newY][newX] = ship.id;
        }
        
        placed = true;
      }
    }
    
    if (!placed) {
      console.error(`Failed to place ${ship.type} ${ship.id} after ${maxAttempts} attempts`);
    }
  }
  
  cpuBoard.ships = ships;
  cpuBoard.ready = true;
}

/**
 * Check if a ship can be placed at a position
 */
function canPlaceShip(ship, x, y, orientation, board, boardSize) {
  for (let i = 0; i < ship.length; i++) {
    const newX = orientation === 'horizontal' ? x + i : x;
    const newY = orientation === 'vertical' ? y + i : y;
    
    // Check boundaries
    if (newX >= boardSize || newY >= boardSize) {
      return false;
    }
    
    // Check for other ships (including buffer zone)
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const checkX = newX + dx;
        const checkY = newY + dy;
        
        if (
          checkX >= 0 && checkX < boardSize &&
          checkY >= 0 && checkY < boardSize &&
          board[checkY][checkX] === 'ship'
        ) {
          return false;
        }
      }
    }
  }
  
  return true;
}

module.exports = {
  defaultBattleshipConfig,
  generateGameId,
  createEmptyBoard,
  validateBattleshipConfig
};
