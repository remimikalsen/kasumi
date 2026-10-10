import { PUBLIC_DEFAULT_LANG, PUBLIC_AVAILABLE_LANGS } from '$app/env/public';

export const config = {
  defaultLang: PUBLIC_DEFAULT_LANG || 'no',
  availableLangs: PUBLIC_AVAILABLE_LANGS ? JSON.parse(PUBLIC_AVAILABLE_LANGS) : ['en', 'no']
};
