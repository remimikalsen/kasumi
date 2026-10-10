import { json } from '@sveltejs/kit';

// Load env variables safely
export const getEnv = async () => {
    try {
        const privateEnv = await import('$app/env/private');
        const publicEnv = await import('$app/env/public');

        return {
            privateEnv: { INTERNAL_API_URL: privateEnv.INTERNAL_API_URL, PRIVATE_API_KEY: privateEnv.PRIVATE_API_KEY },
            publicEnv: { PUBLIC_API_KEY: publicEnv.PUBLIC_API_KEY }
        };
    } catch(error) {
        console.warn('Failed to load environment variables:', error instanceof Error ? error.message : String(error));
        return { 
            privateEnv: {}, 
            publicEnv: {} 
        };
    }
};

// Validate API request authorization
export const validateApiRequest = async (request) => {
    const { publicEnv } = await getEnv();
    
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { valid: false, error: 'Unauthorized', status: 401 };
    }

    const token = authHeader.substring(('Bearer ').length).trim();

    if (token !== publicEnv.PUBLIC_API_KEY) {
        return { valid: false, error: 'Unauthorized', status: 401 };
    }
    
    return { valid: true };
};

// Create a standardized handler for API endpoints
export const createApiHandler = (routeName, handler) => {
    return async (requestEvent) => {
        try {
            // Validate the request
            const validationResult = await validateApiRequest(requestEvent.request);
            if (!validationResult.valid) {
                return json({ error: validationResult.error }, { status: validationResult.status });
            }
            
            // Call the handler
            return await handler(requestEvent);
        } catch (error) {
            console.error(`Error in ${routeName} API:`, error instanceof Error ? error.message : String(error));
            return json({ 
                error: error instanceof Error ? error.message : 'Unknown error' 
            }, { status: 500 });
        }
    };
};

// Create a proxy handler to relay requests to the internal API
export const createProxyHandler = (internalPath) => {
    return createApiHandler(internalPath, async ({ request }) => {
        const { privateEnv } = await getEnv();
        const url = `${privateEnv.INTERNAL_API_URL}${internalPath}`;
        
        // Get request method and body
        const method = request.method;
        let body = null;
        
        if (method !== 'GET' && method !== 'HEAD') {
            body = await request.json();
        }
        
        // Get query parameters
        const queryParams = new URL(request.url).searchParams.toString();
        const fullUrl = queryParams ? `${url}?${queryParams}` : url;
        
        // Make the request to the internal API
        const fetchOptions = {
            method,
            headers: {
                'Content-Type': 'application/json'
            }
        };
        
        if (body) {
            fetchOptions.body = JSON.stringify(body);
        }
        
        const response = await fetch(fullUrl, fetchOptions);
        
        if (!response.ok) {
            throw new Error(`Internal API request failed: ${response.status} ${response.statusText}`);
        }
        
        // Try to parse response as JSON
        try {
            const result = await response.json();
            return json(result);
        } catch (jsonError) {
            // If the response isn't valid JSON, return a simple success message
            return json({ status: 'success' });
        }
    });
}; 
