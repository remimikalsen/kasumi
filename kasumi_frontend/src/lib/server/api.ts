import { json, type RequestEvent } from '@sveltejs/kit';

interface ValidationResult {
    valid: boolean;
    error?: string;
    status?: number;
}

interface EnvObjects {
    privateEnv: Record<string, string>;
    publicEnv: Record<string, string>;
}

// Load env variables safely
export const getEnv = async (): Promise<EnvObjects> => {
    try {
        const { env } = await import('$env/dynamic/private');
        const { env: publicEnv } = await import('$env/dynamic/public');
        return { 
            privateEnv: env, 
            publicEnv 
        };
    } catch (error) {
        console.warn('Failed to load environment variables:', error instanceof Error ? error.message : String(error));
        return { 
            privateEnv: {}, 
            publicEnv: {} 
        };
    }
};

// Validate API request authorization
export const validateApiRequest = async (request: Request): Promise<ValidationResult> => {
    const { publicEnv } = await getEnv();
    
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { valid: false, error: 'Unauthorized', status: 401 };
    }
    
    const token = authHeader.substring('Bearer '.length).trim();
    
    if (token !== publicEnv.PUBLIC_API_KEY) {
        return { valid: false, error: 'Unauthorized', status: 401 };
    }
    
    return { valid: true };
};

// Create a standardized handler for API endpoints
export const createApiHandler = (routeName: string, handler: (event: RequestEvent) => Promise<Response>) => {
    return async (requestEvent: RequestEvent): Promise<Response> => {
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
export const createProxyHandler = (internalPath: string) => {
    return createApiHandler(internalPath, async ({ request }: RequestEvent): Promise<Response> => {
        const { privateEnv } = await getEnv();
        const url = `${privateEnv.INTERNAL_API_URL}${internalPath}`;
        
        // Get request method and body
        const method = request.method;
        let body: unknown = null;
        
        if (method !== 'GET' && method !== 'HEAD') {
            body = await request.json();
        }
        
        // Get query parameters
        const queryParams = new URL(request.url).searchParams.toString();
        const fullUrl = queryParams ? `${url}?${queryParams}` : url;
        
        // Make the request to the internal API
        const fetchOptions: RequestInit = {
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