import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

export const POST = async ({ request }) => {
    // Validate the Authorization header
    const authHeader = request.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring('Bearer '.length).trim();

    if (token !== env.PRIVATE_API_KEY) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Proceed with relaying the score to the internal server
    const url = `${env.INTERNAL_API_URL}/dogrun/delete_score`;

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
            throw new Error('Failed to delete DogRun score');
        }

        const result = await response.json(); // Await the JSON parsing

        return json({ message: 'OK', deletedRows: result.deletedRows }, { status: 200 }, { deletedRows: response.deletedRows});
    } catch (error) {
        return json({ error: error.message }, { status: 500 });
    }
};