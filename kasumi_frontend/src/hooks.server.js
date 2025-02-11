import { env } from '$env/dynamic/public';

export const handle = async ({ event, resolve }) => {
    // Read from process.env (runtime) rather than import.meta.env (build-time).
    // Adjust the variable name to match how you have it set in Docker, etc.
    const plausibleScript = env.PUBLIC_ANALYTICS_SCRIPT || '';
  
    const response = await resolve(event, {
      transformPageChunk: ({ html, done }) => {
        if (done) {
          return html.replace('%analytics_script%', plausibleScript);
        }
        return html;
      }
    });
  
    return response;
  };
  