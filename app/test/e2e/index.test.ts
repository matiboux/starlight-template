import { test, expect } from '@playwright/test'

test('renders the home page', async ({ page }) =>
{
	await page.goto('/')
	await expect(page).toHaveTitle('Welcome | Starlight Template')
	await expect(
		page.getByText('Welcome to my documentation website', { exact: true }).first(),
	).toBeVisible()
});

test('renders the French home page', async ({ page }) =>
{
	await page.goto('/fr/')
	await expect(page).toHaveTitle('Bienvenue | Starlight Template')
	await expect(
		page.getByText('Bienvenue sur mon site web de documentation', { exact: true }).first(),
	).toBeVisible()
});

test('shows the 404 page for unknown routes', async ({ page }) =>
{
	const response = await page.goto('/does-not-exist')
	expect(response?.status()).toBe(404)
});
