import { createProxyHandler } from '#lib/server/api.js';

export const GET = createProxyHandler('/battleship/get_leaderboard'); 
