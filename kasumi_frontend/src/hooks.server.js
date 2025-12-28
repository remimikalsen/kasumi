import { env } from '$env/dynamic/private';

export const handle = async ({ event, resolve }) => {
    const plausibleScript = env.ANALYTICS_SCRIPT || '';
  
    const response = await resolve(event, {
      transformPageChunk: ({ html, done }) => {
        if (done) {
          return html.replace('%analytics_script%', plausibleScript);
        }
        return html;
      }
    });

    // Security headers
    const securityHeaders = {
      // Prevent clickjacking attacks
      'X-Frame-Options': 'DENY',
      
      // Prevent MIME type sniffing
      'X-Content-Type-Options': 'nosniff',
      
      // Enable XSS protection (legacy but still useful)
      'X-XSS-Protection': '1; mode=block',
      
      // Control referrer information
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      
      // Permissions Policy - restrict access to browser features
      // Allow autoplay for background music functionality
      'Permissions-Policy': 'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=(), autoplay=(self)',
      
      // Content Security Policy
      // Allow self for all resources, Plausible for analytics, and necessary inline styles
      // Note: If you add WebSockets in the future, add them to connect-src, e.g.:
      // ws://your-websocket-server.com wss://your-websocket-server.com
      'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self' https://plausible.io",
        "style-src 'self' 'unsafe-inline'", // unsafe-inline needed for inline styles in app.html
        "img-src 'self' data:",
        "font-src 'self' data:",
        "connect-src 'self'", // For API calls and fetch requests (HTTP polling used by battleship game)
        "media-src 'self' blob:", // For audio files and blob URLs (Web Audio API may use blobs)
        "audio-src 'self' blob:", // For Web Audio API and blob URLs
        "worker-src 'self' blob:", // For service workers if used
        "frame-ancestors 'none'", // Prevent embedding
        "base-uri 'self'",
        "form-action 'self'",
        "upgrade-insecure-requests" // Upgrade HTTP to HTTPS
      ].join('; '),
      
      // Strict Transport Security (only if using HTTPS)
      // Uncomment and adjust max-age if deploying with HTTPS
      // 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload'
    };

    // Apply security headers to the response
    Object.entries(securityHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
  
    return response;
  };
  