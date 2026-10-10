import { createProxyHandler } from '#lib/server/api.js';

export const GET = createProxyHandler('/battleship/game_state'); 
