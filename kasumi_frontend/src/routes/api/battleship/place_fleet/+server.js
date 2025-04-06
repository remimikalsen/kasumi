import { createProxyHandler } from '$lib/server/api';

export const POST = createProxyHandler('/battleship/place_fleet'); 