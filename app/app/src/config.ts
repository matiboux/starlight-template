import type { AstroConfig } from 'astro'

type LocaleKeys = Record<string, Record<string, string>>
type I18nConfig = AstroConfig['i18n'] & { localeKeys?: LocaleKeys }

export const i18n: I18nConfig = {
	locales: [
		{
			codes: ['en', 'en_US'],
			path: 'en',
		},
		{
			codes: ['fr', 'fr_FR'],
			path: 'fr',
		},
		{
			codes: ['de', 'de_DE'],
			path: 'de',
		},
		{
			codes: ['es', 'es_ES'],
			path: 'es',
		},
	],
	defaultLocale: 'en',
	fallback: {
		fr: 'en',
		de: 'en',
		es: 'en',
	},
	// localeKeys: {},
	routing: {
		prefixDefaultLocale: false,
		redirectToDefaultLocale: true,
		fallbackType: 'rewrite',
	},
}
