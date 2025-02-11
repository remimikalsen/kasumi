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
  
    return response;
  };
  