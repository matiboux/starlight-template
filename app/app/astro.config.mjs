import { defineConfig } from 'astro/config'
import tailwindcss from '@tailwindcss/vite'

import { i18n } from '/src/config'

// https://astro.build/config
export default defineConfig({
	i18n: i18n,
	vite: {
		plugins: [
			tailwindcss(),
		],
	},
})
