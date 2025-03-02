import { defineConfig, envField } from 'astro/config'
import starlight from '@astrojs/starlight'
import tailwindcss from '@tailwindcss/vite'

// https://astro.build/config
export default defineConfig({
	integrations: [
		starlight({
			title: 'Starlight template',
			description: 'Documentation website with Starlight',
			editLink: {
				baseUrl: 'https://github.com/matiboux/starlight-template/edit/main/app/app/',
			},
			locales: {
				root: {
					label: 'English',
					lang: 'en',
				},
				en: {
					label: 'Français',
					lang: 'fr',
				},
			},
			social: {
				github: 'https://github.com/matiboux/starlight-template',
			},
			customCss: [
				'./src/styles/global.css',
			],
			lastUpdated: true,
			pagination: false,
		}),
	],
	vite: {
		plugins: [
			tailwindcss(),
		],
	},
	env: {
		schema: {
			GITHUB_REPOSITORY_URL: envField.string({ context: 'client', access: 'public', optional: true }),
			GITHUB_SHA: envField.string({ context: 'client', access: 'public', optional: true }),
		},
		validateSecrets: true,
	},
})
