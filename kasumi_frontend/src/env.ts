import { defineEnvVars } from '@sveltejs/kit/env';

// @migration-task Review usage of dynamic environment variables. They fall back to the empty string if not present, which may not be what you want.
export const variables = defineEnvVars({
	ANALYTICS_SCRIPT: { schema: (input) => input ?? '' },
	PUBLIC_API_KEY: { public: true, schema: (input) => input ?? '' },
	PUBLIC_VARIANT: { public: true, schema: (input) => input ?? '' },
	PUBLIC_URL: { public: true, schema: (input) => input ?? '' },
	INTERNAL_API_URL: { schema: (input) => input ?? '' },
	PRIVATE_API_KEY: { schema: (input) => input ?? '' },
	PUBLIC_DEFAULT_LANG: { public: true, schema: (input) => input ?? '' },
	PUBLIC_AVAILABLE_LANGS: { public: true, schema: (input) => input ?? '' },
	PUBLIC_BATTLESHIP_DEBUG_OPPONENT_BOARD: { public: true, schema: (input) => input ?? '' },
	PUBLIC_BATTLESHIP_CPU_DIFFICULTY: { public: true, schema: (input) => input ?? '' },
	PUBLIC_BATTLESHIP_BONUS_SHOT_WHEN_HIT: { public: true, schema: (input) => input ?? '' },
	PUBLIC_BATTLESHIP_BONUS_SHOT_TIMEOUT: { public: true, schema: (input) => input ?? '' }
});
