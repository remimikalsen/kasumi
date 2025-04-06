import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { env as public_env } from '$env/dynamic/public';

export const POST = async ({ request }) => {
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

        // Get the score data from the request
        const scoreData = await request.json();
        const { initials, win_streak } = scoreData;

        if (!initials || typeof win_streak !== 'number') {
            return json({ error: 'Invalid score data' }, { status: 400 });
        }

        // Submit the score to the backend
        const url = `${env.INTERNAL_API_URL}/battleship/submit_score`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ initials, win_streak })
        });

        if (!response.ok) {
            throw new Error(`Failed to submit battleship score: ${response.status} ${response.statusText}`);
        }

        // Try to parse response as JSON, fallback to simple success message
        try {
            const result = await response.json();
            return json(result);
        } catch (jsonError) {
            // If the response isn't valid JSON, return a simple success message
            return json({ status: 'success', message: 'Score submitted successfully' });
        }
    } catch (error) {
        console.error('Error in submit_score API:', error);
        return json({ error: error.message || 'Unknown error' }, { status: 500 });
    }
}; 