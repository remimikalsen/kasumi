import { createProxyHandler } from '$lib/server/api';

export const POST = createProxyHandler('/battleship/create_game'); 