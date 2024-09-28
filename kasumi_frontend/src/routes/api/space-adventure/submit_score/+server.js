import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

export const POST = async ({ request }) => {
    let url = env.INTERNAL_API_URL + '/spaceadventure/submit_score'

    try {
        const { initials, points } = await request.json();
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ initials, points })
        });

        if (!response.ok) {
            throw new Error('Failed to store space adventure score');
        }

        /* const result = await response.json();*/

        return json({ message: "OK" }, { status: 200 });
    } catch (error) {
        return json({ error: error.message }, { status: 500 });
    }
};

