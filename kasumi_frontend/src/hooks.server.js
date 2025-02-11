import { env } from '$env/dynamic/public';

export const handle = async ({ event, resolve }) => {
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
  