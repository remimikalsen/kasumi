import { createProxyHandler } from '$lib/server/api';

export const GET = createProxyHandler('/battleship/get_leaderboard'); 