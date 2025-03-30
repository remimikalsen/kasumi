# Battleship Game Implementation Plan

## Overview
A mobile-friendly Battleship game implementation for the Kasumi website, supporting both two-player and player vs CPU modes.

## Game Structure

### Frontend Components

Re-use or create new components in `/kasumi_frontend/src/lib/components`

1. **Game Setup**
   - Username input component
   - Game mode selection (CPU/Token/Discovery)
   - Game token input/display
   - Local network player discovery interface

2. **Game Board**
   - 10x10 grid component
   - Ship placement interface
   - Interactive shooting interface
   - Visual feedback for hits/misses
   - Ship status display

3. **Game State**
   - Turn indicator
   - Player status
   - Game progress 
   - High score display (re-use how it's done in space-adventure)

### Backend API Routes
All api-calls within the app are done through `/kasumi_frontend/src/api`, but these only proxy
the calls to the real back-end located in `/kasumi_backend/src`. 

The back-end is based on a node-js server that exposes api-endpoints and stores data in a sqlite database.

1. **Game Management**
   - `/api/battleship/create` - Create new game
   - `/api/battleship/join` - Join existing game
   - `/api/battleship/state` - Get game state
   - `/api/battleship/move` - Submit move
   - `/api/battleship/score` - Update/Get high scores

2. **Network Discovery**
   - `/api/battleship/discover` - Find local players
   - `/api/battleship/register` - Register for discovery

## Technical Implementation

### Frontend Technologies
- SvelteKit for the framework
- CSS Grid/Flexbox for responsive layout
- Web Audio API for sound effects
- Local Storage for game state persistence
- WebSocket for real-time updates

### Backend Technologies
- Node.js/Express for API routes. See `/kasumi_backend/src`.
- WebSocket for real-time communication
- Redis for game state management. Needs suggestion on how to integrate it into current architecture.
- SQLite for high score storage

### Game Logic
1. **Ship Placement**
   - Random placement for CPU
   - Drag-and-drop for player
   - Validation for ship positions
   - Ship types:
     - Battleship (5 squares)
     - Frigate (3 squares)
     - 2x Corvette (2 squares)
     - 4x Uboat (1 square)

2. **Game Flow**
   - Turn-based system
   - Random first turn selection
   - Move validation
   - Win condition checking
   - High score tracking

3. **Network Modes**
   - Token-based: Generate/join with game token
   - Discovery: Local network player detection
   - CPU: Built-in AI opponent

4. **Sound settings**
   - Turn on/off sound effects
   - Turn on/off background sound

### Sound Effects
- Laser shot sound `/kasumi_frontent/src/static/spaceadventure/laser.mp3`
- Ship hit explosion sound `/kasumi_frontent/src/static/spaceadventure/explode.mp3`
- Ship missed explosion sound `/kasumi_frontent/src/static/spaceadventure/hit.mp3`
- Game start/end sounds `/kasumi_frontent/src/static/spaceadventure/pause.mp3`
- Turn change notification `/kasumi_frontent/src/static/spaceadventure/pause.mp3`
- Background sound `/kasumi_frontent/src/static/spaceadventure/game-tune-1.mp3`

## Mobile Considerations
- Responsive grid layout
- Touch-friendly controls
- Portrait mode optimization
- Offline capability for CPU mode
- Minimal data usage

## Security
- Input validation
- Rate limiting
- Game state verification
- Anti-cheat measures

## Future Enhancements
- Different board sizes
- Custom ship configurations
- Power-ups
- Tournament mode
- Achievement system

## Development Phases
1. Basic game board and ship placement
2. CPU opponent implementation
3. Two-player token system
4. Local network discovery
5. Sound effects and polish
6. High score system
7. Mobile optimization
8. Testing and bug fixes

## Testing Strategy
- Unit tests for game logic
- Integration tests for API
- Mobile device testing
- Network condition testing
- Security testing 