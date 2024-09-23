import { writable } from 'svelte/store';

// Create a writable store to keep track of bones collected
export const bonesCollected = writable(0);
export const bonus = writable(0);
export const lives = writable(0);
export const bonesCollectedLevel = writable(0);
export const currentLevel = writable(1);  // Initialize the current level
