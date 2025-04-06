import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { env as public_env } from '$env/dynamic/public';

export const GET = async ({ request }) => {
    try {
        // Validate the Authorization header
        const authHeader = request.headers.get('Authorization');

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.substring('Bearer '.length).trim();

        if (token !== public_env.PUBLIC_API_KEY) {
            return json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Proceed with fetching the leaderboard
        const url = `${env.INTERNAL_API_URL}/battleship/get_leaderboard`;

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Failed to fetch battleship leaderboard: ${response.status} ${response.statusText}`);
        }

        const leaderboard = await response.json();
        return json(leaderboard);
    } catch (error) {
        console.error('Error in get_leaderboard API:', error);
        // Return empty array instead of error if leaderboard can't be fetched
        return json([]);
    }
}; 