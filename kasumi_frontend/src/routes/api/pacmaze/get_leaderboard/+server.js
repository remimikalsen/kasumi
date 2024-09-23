import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

export const GET = async () => {
    let url = env.INTERNAL_API_URL + '/pacmaze/get_leaderboard'

    try {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error('Failed to fetch pacmaze leaderboard');
        }

        const leaderboard = await response.json();

        return json(leaderboard);
    } catch (error) {
        return json({ error: error.message }, { status: 500 });
    }

};

