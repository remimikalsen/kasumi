import { json } from '@sveltejs/kit';
import { PRIVATE_API_KEY, INTERNAL_API_URL } from '$app/env/private';

export const POST = async ({ request }) => {
    // Validate the Authorization header
    const authHeader = request.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(('Bearer ').length).trim();

    if (token !== PRIVATE_API_KEY) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Proceed with relaying the delete request to the internal server
    const url = `${INTERNAL_API_URL}/puddel/delete_score`;

    try {
        const { initials, time } = await request.json();

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ initials, time })
        });

        if (!response.ok) {
            throw new Error('Failed to delete puddel score');
        }

        const result = await response.json();

        return json({ message: 'OK', deletedRows: result.deletedRows }, { status: 200 });
    } catch (error) {
        return json({ error: error.message }, { status: 500 });
    }
};
