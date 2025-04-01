import { env } from '$env/dynamic/public';

export const battleshipConfig = {
  // Debug mode to show the CPU's ships during gameplay
  debugCpuBoard: env.PUBLIC_BATTLESHIP_DEBUG_CPU?.toLowerCase() === 'true',
  
  // Bonus shot configuration
  bonusShotWhenHit: env.PUBLIC_BATTLESHIP_BONUS_SHOT_WHEN_HIT?.toLowerCase() === 'true' || true, // Default to true
  bonusShotTimeout: parseInt(env.PUBLIC_BATTLESHIP_BONUS_SHOT_TIMEOUT || '5000', 10), // Default to 5 seconds
  
  // Other game settings
  boardSize: 10,
  shipTypes: {
    battleship: { length: 5, count: 1, prefix: 'B' },
    frigate: { length: 3, count: 1, prefix: 'F' },
    corvette: { length: 2, count: 2, prefix: 'C' },
    uboat: { length: 1, count: 4, prefix: 'U' }
  }
}; 