import { json } from '@sveltejs/kit';
import { INTERNAL_API_URL } from '$app/env/private';
import { PUBLIC_API_KEY } from '$app/env/public';

export const POST = async ({ request }) => {
    // Validate the Authorization header
    const authHeader = request.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(('Bearer ').length).trim();

    if (token !== PUBLIC_API_KEY) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Proceed with relaying the score to the internal server
    const url = `${INTERNAL_API_URL}/dogrun/submit_score`;

    try {
        const { initials, bones } = await request.json();

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ initials, bones })
        });

        if (!response.ok) {
            throw new Error('Failed to store dogrun score');
        }

        // Optionally, you can handle the response from the internal server
        // const result = await response.json();

        return json({ message: 'OK' }, { status: 200 });
    } catch (error) {
        return json({ error: error.message }, { status: 500 });
    }
};
