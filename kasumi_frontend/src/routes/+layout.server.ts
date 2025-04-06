import { env } from '$env/dynamic/public';

export const load = () => {
    return {
        // Expose public API key to client
        PUBLIC_API_KEY: env.PUBLIC_API_KEY || ''
    };
}; 