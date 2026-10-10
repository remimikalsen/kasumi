import { PUBLIC_API_KEY } from '$app/env/public';

export const load = () => {
    return {
        // Expose public API key to client
        PUBLIC_API_KEY: PUBLIC_API_KEY || ''
    };
}; 
