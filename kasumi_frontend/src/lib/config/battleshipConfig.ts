import { env } from '$env/dynamic/public';

export type GameIdLetter = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I';

export const battleshipConfig = {
  // Debug mode to show the CPU's ships during gameplay
  debugOpponentBoard: env.PUBLIC_BATTLESHIP_DEBUG_OPPONENT_BOARD?.toLowerCase() === 'true',
  
  // CPU configuration
  cpuName: 'C3PO', // The name used for the CPU player
  cpuDifficulty: env.PUBLIC_BATTLESHIP_CPU_DIFFICULTY || 'easy', // Default to easy
  
  // Bonus shot configuration
  bonusShotWhenHit: env.PUBLIC_BATTLESHIP_BONUS_SHOT_WHEN_HIT?.toLowerCase() === 'true' || true, // Default to true
  bonusShotTimeout: parseInt(env.PUBLIC_BATTLESHIP_BONUS_SHOT_TIMEOUT || '5000', 10), // Default to 5 seconds
  
  // Other game settings
  boardSize: 8,
  shipTypes: {
    battleship: { length: 5, count: 1, prefix: 'B' },
    frigate: { length: 3, count: 1, prefix: 'F' },
    corvette: { length: 2, count: 2, prefix: 'C' },
    uboat: { length: 1, count: 3, prefix: 'U' }
  },

  shipTypeTranslations: {
    battleship: {
      en: 'Battleship',
      no: 'Slagskip',
      pt: 'Couraçado'
    },
    frigate: {
      en: 'Frigate', 
      no: 'Fregatt',
      pt: 'Fragata'
    },
    corvette: {
      en: 'Corvette',
      no: 'Korvett',
      pt: 'Corveta'
    },
    uboat: {
      en: 'U-Boat',
      no: 'U-båt',
      pt: 'Submarino'
    }
  },

  // Game ID emoji mapping
  gameIdEmojis: {
    'A': '⚓', // Anchor
    'B': '🚢', // Ship
    'C': '🌊', // Wave
    'D': '🏝️', // Island
    'E': '🌅', // Sunrise
    'F': '🐬', // Dolphin
    'G': '⚡', // Lightning
    'H': '🌪️', // Tornado
    'I': '🦈'  // Shark
  } as Record<GameIdLetter, string>
}; 