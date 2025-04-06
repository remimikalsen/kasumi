const express = require('express');
const db = require('../common/db');
const { generateGameId, createEmptyBoard, validateBattleshipConfig } = require('./utils');

const router = express.Router();

// In-memory store (replace with database in production)
const battleship_games = new Map(); 

// Create a table for the leaderboard
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS battleship_leaderboard (initials TEXT, win_streak INTEGER)`);
});

/**
 * Create a new game
 * 
 * @route POST /api/battleship/create_game
 */
router.post('/battleship/create_game', (req, res) => {
  const { initials, mode, config } = req.body;
  
  // Validate player initials
  if (!initials || typeof initials !== 'string' || initials.length !== 3 || !/^[A-Za-z]{3}$/.test(initials)) {
    return res.status(400).json({ status: 'error', message: 'Player initials must be exactly 3 letters' });
  }

  // Validate game mode
  if (!mode || (mode !== 'cpu' && mode !== 'multiplayer')) {
    return res.status(400).json({ status: 'error', message: 'Game mode must be either "cpu" or "multiplayer"' });
  }
  
  // Validate and use the client configuration or fall back to default
  const gameConfig = validateBattleshipConfig(config);

  
  // Prevent using CPU name as player initials
  if (initials === gameConfig.cpuName) {
    return res.status(400).json({ status: 'error', message: `Cannot use ${gameConfig.cpuName} as player initials` });
  }

  const gameId = generateGameId();
  
  const gameState = {
    gameId,
    mode: mode,
    // Status tracks game progression:
    // - 'waiting_for_opponent': Multiplayer game waiting for second player
    // - 'setup': Initial ship placement phase (CPU games start here)
    // - 'active': Game in progress after ships placed
    // - 'player_won'/'opponent_won': Game complete
    // - 'retreated': Game ended due to player retreating
    status: mode === 'multiplayer' ? 'waiting_for_opponent' : 'setup',
    currentTurn: null,
    players: [initials],
    playerBoards: {},
    moves: [],
    lastMoveTime: Date.now(),
    bonusShotActive: false,
    winner: null,
    config: gameConfig, // Store the validated configuration in game state
    // Add CPU memory for smart targeting
    cpuMemory: {
      currentHits: [],       // Tracks coordinates of hits on ships not yet sunk
      potentialTargets: []   // Prioritized cells to target next
    }
  };
  
  // Create empty board for the player with the configured board size
  gameState.playerBoards[initials] = createEmptyBoard(gameConfig.shipTypes, gameConfig.boardSize);
  
  // For CPU games, immediately add a CPU player
  if (mode === 'cpu') {
    gameState.players.push(gameConfig.cpuName);
    gameState.playerBoards[gameConfig.cpuName] = createEmptyBoard(gameConfig.shipTypes, gameConfig.boardSize);
    placeCpuShips(gameState);
  }
  
  // Store the game
  battleship_games.set(gameId, gameState);
  
  res.json({ 
    gameId, 
    status: 'success'
  });
});

/**
 * Join an existing game
 * 
 * @route POST /api/battleship/join_game
 */
router.post('/battleship/join_game', (req, res) => {
  const { gameId, initials } = req.body;
  
  if (!gameId || !initials) {
    return res.status(400).json({ 
      status: 'error', 
      message: 'Game ID and player initials required' 
    });
  }

  
  const gameState = battleship_games.get(gameId);

  if (!gameState) {
    return res.status(404).json({ 
      status: 'error', 
      message: 'Game not found' 
    });
  }
  
  if (gameState.mode !== 'multiplayer') {
    return res.status(400).json({ 
      status: 'error', 
      message: 'Cannot join a CPU game' 
    });
  }
  
  if (gameState.players.length >= 2) {
    return res.status(400).json({ 
      status: 'error', 
      message: 'Game is full' 
    });
  }
  
  // Prevent using CPU name as player initials
  if (initials === gameState.config.cpuName) {
    return res.status(400).json({ status: 'error', message: `Cannot use ${gameState.config.cpuName} as player initials` });
  }

  // Add the second player
  gameState.players.push(initials);
  gameState.playerBoards[initials] = createEmptyBoard(gameState.config.shipTypes, gameState.config.boardSize);
  gameState.status = 'setup';
  
  res.json({
    status: 'success'
  });
});

/*
 * Retreat from a game
 * 
 * @route POST /api/battleship/retreat
 */
router.post('/battleship/retreat', (req, res) => {
  const { gameId, initials } = req.body;

  if (!gameId || !initials) {
    return res.status(400).json({ 
      status: 'error',  
      message: 'Game ID and player initials required' 
    });
  }

  const gameState = battleship_games.get(gameId); 

  if (!gameState) {
    return res.status(404).json({ 
      status: 'error', 
      message: 'Game not found' 
    });
  } 

  if (!gameState.players.includes(initials)) {
    return res.status(400).json({ 
      status: 'error', 
      message: 'Player not in this game' 
    });
  } 

  if (gameState.status !== 'active') {
    return res.status(400).json({ 
      status: 'error', 
      message: 'Game is not active' 
    });
  }

  // Find the opponent
  const opponent = gameState.players.find(player => player !== initials);
  if (!opponent) {
    return res.status(500).json({  
      status: 'error', 
      message: 'No opponent found' 
    });
  }

  // Update game state to retreat 
  gameState.status = 'retreated';
  gameState.winner = opponent;

  // Initialize winStreaks object if it doesn't exist
  if (!gameState.winStreaks) {
    gameState.winStreaks = {};
    for (const player of gameState.players) {
      gameState.winStreaks[player] = 0;
    }
  }

  // Reset winstreak for player with initials, and increment winstreak for opponent
  gameState.winStreaks[initials] = 0;
  gameState.winStreaks[opponent] = (gameState.winStreaks[opponent] || 0) + 1;

  // Return success status
  res.json({
    status: 'success'
  }); 
});

/*
 * Re-match a game
 * 
 * @route POST /api/battleship/re_match
 */
router.post('/battleship/re_match', (req, res) => {
  const { gameId, initials } = req.body;

  if (!gameId) {
    return res.status(400).json({ 
      status: 'error', 
      message: 'Game ID required' 
    });
  }

  if (!initials) {
    return res.status(400).json({ 
      status: 'error', 
      message: 'Player initials required' 
    });
  }

  const gameState = battleship_games.get(gameId);

  if (!gameState) {
    return res.status(404).json({  
      status: 'error', 
      message: 'Game not found' 
    });
  }

  if (!gameState.players.includes(initials)) {
    return res.status(400).json({ 
      status: 'error', 
      message: 'Player not in this game' 
    });
  }

  // Return success if game is in setup phase
  if (gameState.status === 'setup') {
    return res.json({
      status: 'success'
    });
  }

  // Reset game state to the setup phase
  gameState.status = 'setup';
  gameState.currentTurn = null;
  gameState.moves = [];
  gameState.lastMoveTime = Date.now();
  gameState.bonusShotActive = false;
  gameState.winner = null;  
  
  // Reset all player boards
  for (const player of gameState.players) {
    gameState.playerBoards[player] = createEmptyBoard(gameState.config.shipTypes, gameState.config.boardSize);
    gameState.playerBoards[player].ready = false;
    
    // Initialize ships array for each player
    const ships = [];
    let shipId = 1;
    for (const [type, details] of Object.entries(gameState.config.shipTypes)) {
      for (let i = 0; i < details.count; i++) {
        ships.push({
          id: `${details.prefix}${shipId}`,
          type,
          prefix: details.prefix,
          length: details.length,
          placed: false,
          hits: 0,
          sunk: false
        });
        shipId++;
      }
    }
    gameState.playerBoards[player].ships = ships;
  }

  // For CPU games, place CPU ships immediately
  if (gameState.mode === 'cpu') {
    placeCpuShips(gameState);
  }

  // Return the updated game state
  res.json({
    status: 'success',
    gameState: sanitizeGameState(gameState, initials)
  });
});



/**
 * Place fleet on the board
 * 
 * @route POST /api/battleship/place_fleet
 */
router.post('/battleship/place_fleet', (req, res) => {
  const { gameId, initials, shipGrid, ships } = req.body;
  
  if (!gameId || !initials || !shipGrid || !ships) {
    return res.status(400).json({ 
      status: 'error', 
      message: 'Missing required fields' 
    });
  }
  
  const gameState = battleship_games.get(gameId);
  
  if (!gameState) {
    return res.status(404).json({ 
      status: 'error', 
      message: 'Game not found' 
    });
  }
  
  if (!gameState.players.includes(initials)) {
    return res.status(400).json({ 
      status: 'error', 
      message: 'Player not in this game' 
    });
  }

  if (gameState.status !== 'setup') {
    return res.status(400).json({ 
      status: 'error', 
      message: 'Game is not in setup phase' 
    });
  }
  
  // Validate ship grid dimensions match board size
  if (!Array.isArray(shipGrid) || 
      shipGrid.length !== gameState.config.boardSize ||
      !shipGrid.every(row => Array.isArray(row) && row.length === gameState.config.boardSize)) {
    return res.status(400).json({
      status: 'error',
      message: 'Ship grid dimensions do not match board size'
    });
  }

  // Validate ships array matches expected ships
  const expectedShips = gameState.playerBoards[initials].ships;
  if (!Array.isArray(ships) || ships.length !== expectedShips.length) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid number of ships'
    });
  }

  // Validate each ship has required properties
  for (const ship of ships) {
    if (!ship.id || !ship.position || typeof ship.position.x !== 'number' || typeof ship.position.y !== 'number') {
      return res.status(400).json({
        status: 'error',
        message: 'Each ship must have an id and position with x,y coordinates'
      });
    }
  }

  // Count total number of ship squares in the provided grid
  let shipSquareCount = 0;
  for (let row of shipGrid) {
    for (let cell of row) {
      if (cell) { // Any non-null/non-empty value indicates a ship
        shipSquareCount++;
      }
    }
  }
  // Calculate expected number of ship squares from config
  const expectedSquares = Object.values(gameState.config.shipTypes).reduce((total, ship) => {
    return total + (ship.length * ship.count);
  }, 0);

  // Validate ship square count matches configuration
  if (shipSquareCount !== expectedSquares) {
    return res.status(400).json({
      status: 'error',
      message: `Invalid number of ship squares. Expected ${expectedSquares} but got ${shipSquareCount}`
    });
  }

  // Update the empty player board with a ship grid
  // Overlay ships onto existing board, preserving any bonuses/features that may be included in the ship grid
  for (let y = 0; y < shipGrid.length; y++) {
    for (let x = 0; x < shipGrid[y].length; x++) {
      if (shipGrid[y][x]) { // If there's a ship at this position
        gameState.playerBoards[initials].board[y][x] = 'ship';
      }
    }
  }
  // Add the ship grid to the player board
  gameState.playerBoards[initials].shipGrid = shipGrid;

  // Update ships with provided positions
  gameState.playerBoards[initials].ships = ships;

  // Set the player board to ready
  gameState.playerBoards[initials].ready = true;
  
  // Check if all players are ready
  const allReady = gameState.players.every(player => 
    gameState.playerBoards[player] && gameState.playerBoards[player].ready
  );
  
  if (allReady) {
    gameState.status = 'active';
    gameState.currentTurn = gameState.players[Math.floor(Math.random() * gameState.players.length)];
    
    // If CPU is first to go, make its move immediately
    if (gameState.mode === 'cpu' && gameState.currentTurn === gameState.config.cpuName) {
      setTimeout(() => makeCpuMove(gameState), 1000);
    }
  }
  
  // Only return success status, no game state
  res.json({
    status: 'success',
    message: allReady ? 'Game is starting' : 'Waiting for other players'
  });
});

/**
 * Fire a shot at opponent
 * 
 * @route POST /api/battleship/fire
 */
router.post('/battleship/fire', (req, res) => {
  const { gameId, initials, position } = req.body;
  
  if (!gameId || !initials || !position) {
    return res.status(400).json({ 
      status: 'error', 
      message: 'Missing required fields' 
    });
  }
  
  const gameState = battleship_games.get(gameId);
  
  if (!gameState) {
    return res.status(404).json({ 
      status: 'error', 
      message: 'Game not found' 
    });
  }
  
  if (gameState.status !== 'active') {
    return res.status(400).json({ 
      status: 'error', 
      message: 'Game is not active' 
    });
  }
  
  if (gameState.currentTurn !== initials) {
    return res.status(400).json({ 
      status: 'error', 
      message: 'Not your turn' 
    });
  }
  
  // Find the opponent
  const opponent = gameState.players.find(player => player !== initials);
  if (!opponent) {
    return res.status(500).json({ 
      status: 'error', 
      message: 'No opponent found' 
    });
  }
  
  const { x, y } = position;
  const opponentBoard = gameState.playerBoards[opponent];
  
  // Check if this cell has already been targeted
  if (opponentBoard.board[y][x] === 'hit' || opponentBoard.board[y][x] === 'miss') {
    return res.status(400).json({ 
      status: 'error', 
      message: 'Cell already targeted' 
    });
  }
  
  // Process the shot
  let result = 'miss';
  let shipId = null;
  
  if (opponentBoard.board[y][x] === 'ship') {
    // It's a hit
    opponentBoard.board[y][x] = 'hit';
    
    // Find which ship was hit
    shipId = opponentBoard.shipGrid[y][x];
    if (shipId) {
      const ship = opponentBoard.ships.find(s => s.id === shipId);
      if (ship) {
        ship.hits = (ship.hits || 0) + 1;
        
        // Check if the ship is sunk
        if (ship.hits >= ship.length) {
          ship.sunk = true;
          result = 'sunk';
        } else {
          result = 'hit';
        }
      }
    }
  } else if (opponentBoard.board[y][x] === 'hit' && opponentBoard.shipGrid[y][x]) {
    // This is a hit on an already hit ship - check if it's the final shot to sink it
    shipId = opponentBoard.shipGrid[y][x];
    const ship = opponentBoard.ships.find(s => s.id === shipId);
    if (ship && !ship.sunk && ship.hits >= ship.length - 1) {
      ship.sunk = true;
      result = 'sunk';
    } else {
      return res.status(400).json({ 
        status: 'error', 
        message: 'Cell already targeted' 
      });
    }
  } else {
    // It's a miss
    opponentBoard.board[y][x] = 'miss';
  }
  
  // Record the move
  const move = {
    playerId: initials,
    position,
    result,
    shipId,
    timestamp: Date.now()
  };
  
  gameState.moves.push(move);
  gameState.lastMoveTime = Date.now();
  
  // Check if all opponent ships are sunk
  const allShipsSunk = opponentBoard.ships.every(ship => ship.sunk);
  
  if (allShipsSunk) {
    gameState.status = 'player_won';
    gameState.winner = initials;

    // Initialize winStreaks object if it doesn't exist
    if (!gameState.winStreaks) {
      gameState.winStreaks = {};
      for (const player of gameState.players) {
        gameState.winStreaks[player] = 0;
      }
    }
    
    // Increment winner's streak
    gameState.winStreaks[initials] = (gameState.winStreaks[initials] || 0) + 1;
    
    // Reset streaks for other players
    for (const player of gameState.players) {
      if (player !== gameState.winner) {
        gameState.winStreaks[player] = 0;
      }
    }   

  } else {
    // Update turn based on bonus shot rules
    const getBonusShot = gameState.config.bonusShotWhenHit && (result === 'hit' || result === 'sunk');
    
    if (!getBonusShot) {
      // Switch turns
      gameState.currentTurn = opponent;
      gameState.bonusShotActive = false;
      
      // If opponent is CPU, make a CPU move
      if (gameState.mode === 'cpu' && opponent === gameState.config.cpuName) {
        // Schedule CPU move asynchronously
        setTimeout(() => makeCpuMove(gameState), 2000);
      }
    } else {
      // Player gets a bonus shot
      gameState.bonusShotActive = true;
    }
  }
  
  // Only return the shot result, no game state
  res.json({
    result,
    shipId,
    status: 'success'
  });
});

/**
 * Get current game state
 * 
 * @route GET /api/battleship/game_state
 */
router.get('/battleship/game_state', (req, res) => {
  const { gameId, initials, lastUpdate } = req.query;
  
  if (!gameId) {
    return res.status(400).json({ 
      status: 'error', 
      message: 'Game ID required' 
    });
  }
  
  const gameState = battleship_games.get(gameId);
  
  if (!gameState) {
    return res.status(404).json({ 
      status: 'error', 
      message: 'Game not found' 
    });
  }

  // If client provided lastUpdate timestamp, check if there are new updates
  if (lastUpdate) {
    const lastUpdateTime = parseInt(lastUpdate);
    const hasNewUpdates = gameState.moves.some(move => move.timestamp > lastUpdateTime) ||
                         gameState.status !== 'active' ||
                         gameState.currentTurn === initials;
    
    if (!hasNewUpdates) {
      // No new updates, use long polling
      // Set a timeout to check again in 5 seconds
      setTimeout(() => {
        const updatedGameState = battleship_games.get(gameId);
        if (updatedGameState) {
          res.json({
            gameState: sanitizeGameState(updatedGameState, initials),
            status: 'success'
          });
        } else {
          res.status(404).json({ 
            status: 'error', 
            message: 'Game not found' 
          });
        }
      }, 5000);
      return;
    }
  }
  
  // Process any pending game state updates (bonus shot timeouts, etc.)
  if (gameState.status === 'active' && gameState.bonusShotActive) {
    const now = Date.now();
    const timeElapsed = now - gameState.lastMoveTime;
    
    if (timeElapsed > gameState.config.bonusShotTimeout) {
      // Timeout the bonus shot
      const currentPlayer = gameState.currentTurn;
      const opponent = gameState.players.find(player => player !== currentPlayer);
      
      if (opponent) {
        gameState.currentTurn = opponent;
        gameState.bonusShotActive = false;
        gameState.lastMoveTime = now;
        
        // If new turn is CPU, make CPU move
        if (gameState.mode === 'cpu' && opponent === gameState.config.cpuName) {
          setTimeout(() => makeCpuMove(gameState), 1000);
        }
      }
    }
  }
  
  // Return current game state
  res.json({
    gameState: sanitizeGameState(gameState, initials),
    status: 'success'
  });
});

/**
 * Force timeout of a bonus shot
 * 
 * @route POST /api/battleship/timeout_bonus_shot
 */
router.post('/battleship/timeout_bonus_shot', (req, res) => {
  const { gameId, initials } = req.body;
  
  if (!gameId || !initials) {
    return res.status(400).json({ 
      status: 'error', 
      message: 'Game ID and player initials required' 
    });
  }
  
  const gameState = battleship_games.get(gameId);
  
  if (!gameState) {
    return res.status(404).json({ 
      status: 'error', 
      message: 'Game not found' 
    });
  }
  
  if (gameState.status !== 'active' || !gameState.bonusShotActive) {
    return res.status(400).json({ 
      status: 'error', 
      message: 'No active bonus shot to timeout' 
    });
  }
  
  if (gameState.currentTurn !== initials) {
    return res.status(400).json({ 
      status: 'error', 
      message: 'Not your bonus shot to timeout' 
    });
  }
  
  // Find the opponent
  const opponent = gameState.players.find(player => player !== initials);
  
  if (opponent) {
    // Switch turns
    gameState.currentTurn = opponent;
    gameState.bonusShotActive = false;
    gameState.lastMoveTime = Date.now();
    
    // If new turn is CPU, make CPU move
    if (gameState.mode === 'cpu' && opponent === gameState.config.cpuName) {
      setTimeout(() => makeCpuMove(gameState), 1000);
    }
  }
  
  res.json({
    gameState: sanitizeGameState(gameState, initials),
    status: 'success'
  });
});

// Endpoint to submit a score
router.post('/battleship/submit_score', (req, res) => {
  const { gameId, initials } = req.body;
  
  // Validate required parameters
  if (!gameId || !initials) {
    return res.status(400).json({ 
      status: 'error', 
      message: 'Game ID and player initials required' 
    });
  }
  
  // Find the game
  const gameState = battleship_games.get(gameId);
  
  if (!gameState) {
    return res.status(404).json({ 
      status: 'error', 
      message: 'Game not found' 
    });
  }
  
  // Verify player is in this game
  if (!gameState.players.includes(initials)) {
    return res.status(400).json({ 
      status: 'error', 
      message: 'Player not in this game' 
    });
  }
  
  // Check if game has winStreaks and the player has a streak
  if (!gameState.winStreaks || !gameState.winStreaks[initials]) {
    return res.status(400).json({ 
      status: 'error', 
      message: 'No valid win streak found for this player' 
    });
  }
  
  const win_streak = gameState.winStreaks[initials];
  
  // Only save scores with a win streak > 0
  if (win_streak <= 0) {
    return res.status(400).json({ 
      status: 'error', 
      message: 'Win streak must be greater than 0' 
    });
  }
  
  // Insert the score into the leaderboard
  const stmt = db.prepare('INSERT INTO battleship_leaderboard (initials, win_streak) VALUES (?, ?)');
  
  stmt.run(initials, win_streak, function(err) {
    if (err) {
      res.status(500).json({
        status: 'error',
        message: 'Database error'
      });
    } else {
      res.status(200).json({
        status: 'success',
        message: 'Score submitted successfully',
        win_streak: win_streak
      });
    }
  });
  
  stmt.finalize();
});

// Endpoint to get the leaderboard
router.get('/battleship/get_leaderboard', (req, res) => {
  db.all(`
    SELECT initials, MAX(win_streak) as win_streak 
    FROM battleship_leaderboard 
    GROUP BY initials 
    ORDER BY win_streak DESC 
    LIMIT 10
  `, [], (err, rows) => {
    if (err) {
      res.status(500).send('Database error');
    } else {
      res.json(rows);
    }
  });
});

// Endpoint to clear initials with certain scores from leaderboard
router.post('/battleship/delete_score', (req, res) => {
  const { initials, win_streak } = req.body;
  
  // Corrected SQL syntax for DELETE query
  const stmt = db.prepare('DELETE FROM battleship_leaderboard WHERE initials = ? AND win_streak = ?');
  
  // Executing the statement with provided parameters
  stmt.run(initials, win_streak, function(err) {
    if (err) {
      res.status(500).send('Database error');
    } else {
      res.status(200).send({ deletedRows: this.changes });
    }
  });
});

/**
 * CPU logic - place ships randomly on the board
 */
function placeCpuShips(gameState) {
  if (!gameState.playerBoards[gameState.config.cpuName]) return;
  
  const cpuBoard = gameState.playerBoards[gameState.config.cpuName];
  const BOARD_SIZE = gameState.config.boardSize;
  const ships = cpuBoard.ships;
  
  // Place ships randomly
  for (const ship of ships) {
    let placed = false;
    let attempts = 0;
    const maxAttempts = 100;
    
    while (!placed && attempts < maxAttempts) {
      attempts++;
      
      // Random orientation
      const orientation = Math.random() < 0.5 ? 'horizontal' : 'vertical';
      
      // Random position based on orientation
      const maxX = orientation === 'horizontal' ? BOARD_SIZE - ship.length : BOARD_SIZE - 1;
      const maxY = orientation === 'vertical' ? BOARD_SIZE - ship.length : BOARD_SIZE - 1;
      
      const x = Math.floor(Math.random() * (maxX + 1));
      const y = Math.floor(Math.random() * (maxY + 1));
      
      if (canPlaceShip(ship, x, y, orientation, cpuBoard.board)) {
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
  }
  
  // Update the ships array in the game state
  gameState.playerBoards[gameState.config.cpuName].ships = ships;
  cpuBoard.ready = true;
}

/**
 * Check if a ship can be placed at a position
 */
function canPlaceShip(ship, x, y, orientation, board) {
  const BOARD_SIZE = board.length;
  
  for (let i = 0; i < ship.length; i++) {
    const newX = orientation === 'horizontal' ? x + i : x;
    const newY = orientation === 'vertical' ? y + i : y;
    
    // Check boundaries
    if (newX >= BOARD_SIZE || newY >= BOARD_SIZE) {
      return false;
    }
    
    // Check for other ships (including buffer zone)
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const checkX = newX + dx;
        const checkY = newY + dy;
        
        if (
          checkX >= 0 && checkX < BOARD_SIZE &&
          checkY >= 0 && checkY < BOARD_SIZE &&
          board[checkY][checkX] === 'ship'
        ) {
          return false;
        }
      }
    }
  }
  
  return true;
}

/**
 * Make a CPU move
 */
function makeCpuMove(gameState) {
  if (gameState.status !== 'active' || gameState.currentTurn !== gameState.config.cpuName) {
    return;
  }
  
  const opponent = gameState.players.find(player => player !== gameState.config.cpuName);
  if (!opponent) return;
  
  const playerBoard = gameState.playerBoards[opponent];
  const BOARD_SIZE = gameState.config.boardSize;
  
  // Find valid position to shoot based on difficulty setting
  let x, y;
  
  if (gameState.config.cpuDifficulty === 'hard') {
    // SMART TARGETING LOGIC for hard mode
    if (gameState.cpuMemory.potentialTargets.length > 0) {
      // Use a prioritized target
      const nextTarget = gameState.cpuMemory.potentialTargets.shift();
      x = nextTarget.x;
      y = nextTarget.y;
    } else if (gameState.cpuMemory.currentHits.length > 0) {
      // Generate new targets around existing hits
      generatePotentialTargets(gameState, playerBoard);
      
      if (gameState.cpuMemory.potentialTargets.length > 0) {
        // Use newly generated target
        const nextTarget = gameState.cpuMemory.potentialTargets.shift();
        x = nextTarget.x;
        y = nextTarget.y;
      } else {
        // Fallback to random if no valid targets (shouldn't happen)
        const randomTarget = getRandomTarget(playerBoard, BOARD_SIZE);
        x = randomTarget.x;
        y = randomTarget.y;
      }
    } else {
      // No current hits, use random targeting
      const randomTarget = getRandomTarget(playerBoard, BOARD_SIZE);
      x = randomTarget.x;
      y = randomTarget.y;
    }
  } else {
    // EASY MODE - just use random targeting
    const randomTarget = getRandomTarget(playerBoard, BOARD_SIZE);
    x = randomTarget.x;
    y = randomTarget.y;
  }
  
  // Process the shot
  let result = 'miss';
  let shipId = null;
  
  if (playerBoard.board[y][x] === 'ship') {
    // It's a hit
    playerBoard.board[y][x] = 'hit';
    
    // Find which ship was hit
    shipId = playerBoard.shipGrid[y][x];
    if (shipId) {
      const ship = playerBoard.ships.find(s => s.id === shipId);
      if (ship) {
        ship.hits = (ship.hits || 0) + 1;
        
        // Check if the ship is sunk
        if (ship.hits >= ship.length) {
          ship.sunk = true;
          result = 'sunk';
          // Mark all cells of the sunk ship as hit
          markShipAsSunk(playerBoard, ship);
        } else {
          result = 'hit';
        }
      }
    }
  } else {
    // It's a miss
    playerBoard.board[y][x] = 'miss';
  }
  
  // Record the move
  const move = {
    playerId: gameState.config.cpuName,
    position: { x, y },
    result,
    shipId,
    timestamp: Date.now()
  };
  
  gameState.moves.push(move);
  gameState.lastMoveTime = Date.now();
  
  // Update the targeting memory in hard mode
  if (gameState.config.cpuDifficulty === 'hard') {
    if (result === 'hit') {
      // Add to current hits
      gameState.cpuMemory.currentHits.push({ x, y, shipId });
      
      // If we have multiple hits on same ship, update potential targets
      const sameShipHits = gameState.cpuMemory.currentHits.filter(hit => hit.shipId === shipId);
      if (sameShipHits.length > 1) {
        // Clear existing targets and generate new ones based on ship orientation
        gameState.cpuMemory.potentialTargets = [];
        generateOrientedTargets(gameState, playerBoard, sameShipHits, shipId);
      }
    } else if (result === 'sunk') {
      // Remove all hits for this ship from tracking
      gameState.cpuMemory.currentHits = gameState.cpuMemory.currentHits.filter(hit => hit.shipId !== shipId);
      
      // Clear potential targets - we'll generate new ones if needed
      gameState.cpuMemory.potentialTargets = [];
    }
  }
  
  // Check if all player ships are sunk
  const allShipsSunk = playerBoard.ships.every(ship => ship.sunk);
  
  if (allShipsSunk) {
    gameState.status = 'opponent_won';
    gameState.winner = gameState.config.cpuName;
  } else {
    // Check if CPU gets another shot
    const getBonusShot = gameState.config.bonusShotWhenHit && (result === 'hit' || result === 'sunk');
    
    if (!getBonusShot) {
      // Switch turns
      gameState.currentTurn = opponent;
      gameState.bonusShotActive = false;
    } else {
      // CPU gets a bonus shot
      gameState.bonusShotActive = true;
      gameState.lastMoveTime = Date.now();
      
      // Make another move after delay
      setTimeout(() => makeCpuMove(gameState), 1500);
    }
  }
}

/**
 * Get a random valid target
 */
function getRandomTarget(playerBoard, BOARD_SIZE) {
  let validMove = false;
  let x, y;
  
  while (!validMove) {
    x = Math.floor(Math.random() * BOARD_SIZE);
    y = Math.floor(Math.random() * BOARD_SIZE);
    
    // Check if cell hasn't been targeted yet
    if (playerBoard.board[y][x] === 'empty' || playerBoard.board[y][x] === 'ship') {
      validMove = true;
    }
  }
  
  return { x, y };
}

/**
 * Generate potential targets around current hits
 */
function generatePotentialTargets(gameState, playerBoard) {
  const BOARD_SIZE = gameState.config.boardSize;
  
  // For each current hit, check adjacent cells
  for (const hit of gameState.cpuMemory.currentHits) {
    const directions = [
      {dx: 0, dy: -1}, // up
      {dx: 1, dy: 0},  // right
      {dx: 0, dy: 1},  // down
      {dx: -1, dy: 0}  // left
    ];
    
    for (const dir of directions) {
      const newX = hit.x + dir.dx;
      const newY = hit.y + dir.dy;
      
      // Check if valid cell and not already targeted
      if (newX >= 0 && newX < BOARD_SIZE && newY >= 0 && newY < BOARD_SIZE &&
          (playerBoard.board[newY][newX] === 'empty' || playerBoard.board[newY][newX] === 'ship')) {
        
        // Add to potential targets if not already there
        if (!gameState.cpuMemory.potentialTargets.some(target => target.x === newX && target.y === newY)) {
          gameState.cpuMemory.potentialTargets.push({ x: newX, y: newY });
        }
      }
    }
  }
}

/**
 * Generate targets based on ship orientation
 */
function generateOrientedTargets(gameState, playerBoard, hits, shipId) {
  const BOARD_SIZE = gameState.config.boardSize;
  
  // Sort hits by x and y to determine orientation
  const sortedByX = [...hits].sort((a, b) => a.x - b.x);
  const sortedByY = [...hits].sort((a, b) => a.y - b.y);
  
  // Check if horizontal (x values differ)
  if (sortedByX[0].x !== sortedByX[sortedByX.length - 1].x) {
    // Ship is horizontal - target cells to the left and right
    const minX = sortedByX[0].x;
    const maxX = sortedByX[sortedByX.length - 1].x;
    const y = sortedByX[0].y; // y is the same for all hits
    
    // Try left
    if (minX > 0 && (playerBoard.board[y][minX-1] === 'empty' || playerBoard.board[y][minX-1] === 'ship')) {
      gameState.cpuMemory.potentialTargets.push({ x: minX-1, y });
    }
    
    // Try right
    if (maxX < BOARD_SIZE-1 && (playerBoard.board[y][maxX+1] === 'empty' || playerBoard.board[y][maxX+1] === 'ship')) {
      gameState.cpuMemory.potentialTargets.push({ x: maxX+1, y });
    }
  } 
  // Check if vertical (y values differ)
  else if (sortedByY[0].y !== sortedByY[sortedByY.length - 1].y) {
    // Ship is vertical - target cells above and below
    const minY = sortedByY[0].y;
    const maxY = sortedByY[sortedByY.length - 1].y;
    const x = sortedByY[0].x; // x is the same for all hits
    
    // Try above
    if (minY > 0 && (playerBoard.board[minY-1][x] === 'empty' || playerBoard.board[minY-1][x] === 'ship')) {
      gameState.cpuMemory.potentialTargets.push({ x, y: minY-1 });
    }
    
    // Try below
    if (maxY < BOARD_SIZE-1 && (playerBoard.board[maxY+1][x] === 'empty' || playerBoard.board[maxY+1][x] === 'ship')) {
      gameState.cpuMemory.potentialTargets.push({ x, y: maxY+1 });
    }
  }
}

// Helper function to mark all cells of a sunk ship
function markShipAsSunk(board, ship) {
  if (!ship.position || !ship.orientation) return;
  
  const { x, y } = ship.position;
  const orientation = ship.orientation;
  
  for (let i = 0; i < ship.length; i++) {
    const posX = orientation === 'horizontal' ? x + i : x;
    const posY = orientation === 'vertical' ? y + i : y;
    
    if (posX < board.board[0].length && posY < board.board.length) {
      board.board[posY][posX] = 'hit';
    }
  }
}

/**
 * Sanitize game state to hide opponent's ship positions
 */
function sanitizeGameState(gameState, initials) {
  // Create a deep copy
  const sanitized = JSON.parse(JSON.stringify(gameState));
  
  // Hide opponents' ship positions
  for (const player of sanitized.players) {
    if (player !== initials && sanitized.playerBoards[player]) {
      const board = sanitized.playerBoards[player];
      
      // Replace ship cells with empty for the opponent's board
      // except where player has already fired and hit
      for (let y = 0; y < board.board.length; y++) {
        for (let x = 0; x < board.board[y].length; x++) {
          // Only hide unfired cells that contain ships
          if (board.board[y][x] === 'ship') {
            board.board[y][x] = 'empty';
          }
        }
      }      
    }
  }
  
  return sanitized;
}

module.exports = router;