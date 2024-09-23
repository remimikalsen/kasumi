import { env } from '$env/dynamic/public';

export const config = {
  defaultLang: env.PUBLIC_DEFAULT_LANG || 'no',
  availableLangs: env.PUBLIC_AVAILABLE_LANGS
    ? JSON.parse(env.PUBLIC_AVAILABLE_LANGS)
    : ['en', 'no']
};