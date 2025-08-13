import fs from 'node:fs'
import path from 'node:path'

import { getCollection, getEntry } from 'astro:content'
import { getRelativeLocaleUrl } from 'astro:i18n'
import type { SidebarEntry } from '@astrojs/starlight/utils/routing/types'
import type { StarlightUserConfig } from '@astrojs/starlight/types'
import type { DataEntryMap } from 'astro:content'

const SIDEBAR_CONFIG_ROOT = path.resolve('./src/content/docs')

type Context = {
	sidebarConfigSlug: string,
	slugPath: string,
	userUrl: URL,
	userLocale: string
}

type SidebarConfigItem = NonNullable<StarlightUserConfig['sidebar']>[number]
type SidebarConfigItemBadge = Extract<SidebarConfigItem, { badge?: unknown }>['badge']

type SidebarEntryBadge = SidebarEntry['badge']

async function loadConfig(filePath: string): Promise<NonNullable<StarlightUserConfig['sidebar']> | null>
{
	if (fs.existsSync(filePath))
	{
		const config = await import(/* @vite-ignore */ filePath)
		return config.default
	}

	return null
}

function formatBadge(badge: SidebarConfigItemBadge): SidebarEntryBadge
{
	if (badge === undefined)
	{
		return undefined
	}

	if (typeof badge === 'string')
	{
		return {
			variant: 'default',
			text: badge,
			class: undefined,
		}
	}

	return {
		variant: badge.variant ?? 'default',
		text: badge.text as string, // FIXME
		class: badge.class,
	}
}

async function formatCollectionEntry(
	item: Extract<SidebarConfigItem, string | { slug?: unknown }> | null,
	collectionEntry: DataEntryMap['docs'][string] | string,
	context: Context
): Promise<Extract<SidebarEntry, { type: 'link' }>>
{
	const slug = typeof collectionEntry === 'string' ? collectionEntry : collectionEntry.id.replace(/^\/?index$/, '')
	const slugLastSegment = slug.split('/').pop() || 'index'
	const label = typeof collectionEntry === 'string' ? collectionEntry : collectionEntry.data.title || slugLastSegment
	const href = getRelativeLocaleUrl(context.userLocale, slug)

	const normalizePath = (p: string) => p === '/' ? '/' : p.replace(/\/+$/, '')
	const isCurrent = normalizePath(context.userUrl.pathname) === normalizePath(href)

	// TODO: Handle `translations` property
	return item && typeof item !== 'string'
		? {
			type: 'link',
			label: item.translations?.[context.userLocale] || item.label || label,
			href: href,
			isCurrent: isCurrent,
			badge: formatBadge(item.badge),
			attrs: item.attrs ?? {},
		}
		: {
			type: 'link',
			label: label,
			href: href,
			isCurrent: isCurrent,
			badge: undefined,
			attrs: {},
		}
}

async function formatAutoGroupEntry(
	collectionEntries: Record<string, DataEntryMap['docs'][string]>,
	collectionGroups: Record<string, Set<string>>,
	collectionGroupKey: string,
	context: Context
): Promise<SidebarEntry>
{
	if (!collectionGroups[collectionGroupKey])
	{
		throw new Error(`Collection group not found for key '${collectionGroupKey}'`)
	}

	const collectionEntry = collectionEntries[collectionGroupKey]

	let linkEntry = undefined
	if (collectionGroups[collectionGroupKey].has(collectionGroupKey))
	{
		// Generate a link entry for the group key
		linkEntry = await formatCollectionEntry(null, collectionEntry || collectionGroupKey, context)
	}

	if (collectionGroups[collectionGroupKey].size > 1)
	{
		// Return a group entry
		return {
			type: 'group',
			label: linkEntry?.label || collectionGroupKey.split('/').pop() || 'index',
			collapsed: true, // TODO: Make this configurable
			badge: undefined,
			entries: (await Promise.all(Array.from(collectionGroups[collectionGroupKey]).map(
				slug => slug === collectionGroupKey
					? Promise.resolve(linkEntry!)
					: formatAutoGroupEntry(collectionEntries, collectionGroups, slug, context)
			))),
		}
	}

	if (linkEntry)
	{
		return linkEntry
	}

	return {
		type: 'group',
		label: collectionGroupKey.split('/').pop() || 'index',
		collapsed: true, // TODO: Make this configurable
		badge: undefined,
		entries: await Promise.all(Array.from(collectionGroups[collectionGroupKey]).map(
			slug => formatAutoGroupEntry(collectionEntries, collectionGroups, slug, context)
		)),
	}
}

async function formatSidebarItem(item: SidebarConfigItem, context: Context): Promise<SidebarEntry>
{
	if (typeof item === 'string' || 'slug' in item)
	{
		// String item: <SidebarLinkItemSchema>
		// or Internal link item: <InternalSidebarLinkItemSchema>

		let slug = typeof item === 'string' ? item : item.slug
		let collectionEntry: DataEntryMap['docs'][string] | undefined = undefined

		if (slug !== '::back')
		{
			// Load collection entry by slug
			collectionEntry = await getEntry('docs', slug)
		}
		else
		{
			slug = context.sidebarConfigSlug
			while (!collectionEntry && slug !== 'index')
			{
				// Remove trailing slug segment
				// If slug is empty, fallback to 'index' for home page
				slug = slug.replace(/\/?[^/]+$/, '') || 'index'

				// Try to load the collection entry for this slug
				collectionEntry = await getEntry('docs', slug)
			}
		}


		if (collectionEntry)
		{
			return formatCollectionEntry(item, collectionEntry, context)
		}

		throw new Error(`Collection entry not found for slug '${slug}'`)
	}

	if ('link' in item)
	{
		// External link item
		// <SidebarLinkItemSchema>
		// TODO: Handle `translations` property
		return {
			type: 'link',
			label: item.translations?.[context.userLocale] || item.label,
			href: item.link,
			isCurrent: false,
			badge: formatBadge(item.badge),
			attrs: item.attrs ?? {},
		}
	}

	if ('autogenerate' in item)
	{
		// Autogenerating group item
		// <AutoSidebarGroupSchema>

		// List collection entries in the directory
		const collectionEntries = Object.fromEntries(
			(await getCollection(
				'docs',
				// Filter entries by directory (FIXME: maybe use && !entry.data.sidebar?.hidden)
				entry => entry.id.startsWith(item.autogenerate.directory)
			)).map(entry => [entry.id, entry])
		)

		const nbPrefixSegments = item.autogenerate.directory.split('/').length + 1

		const collectionGroups: Record<string, Set<string>> = {}
		for (const collectionEntry of Object.values(collectionEntries))
		{
			const collectionEntryId = collectionEntry.id
			const slugSegments = collectionEntry.id.split('/').filter(Boolean)

			collectionGroups[collectionEntryId] = collectionGroups[collectionEntryId] || new Set()
			collectionGroups[collectionEntryId].add(collectionEntryId)

			for (let i = nbPrefixSegments; i <= slugSegments.length; ++i)
			{
				// Create nested groups for each segment
				const groupKey = slugSegments.slice(0, i - 1).join('/')
				const value = slugSegments.slice(0, i).join('/')
				collectionGroups[groupKey] = collectionGroups[groupKey] || new Set()
				collectionGroups[groupKey].add(value)
			}
		}

		return formatAutoGroupEntry(
			collectionEntries,
			collectionGroups,
			item.autogenerate.directory,
			context
		)
	}

	if ('items' in item)
	{
		// Manual group item
		// <ManualSidebarGroupSchema>
		return {
			type: 'group',
			label: item.translations?.[context.userLocale] || item.label,
			collapsed: item.collapsed ?? false,
			badge: formatBadge(item.badge),
			entries: await Promise.all(item.items.map(item => formatSidebarItem(item, context))), // Recursively format items
		}
	}

	throw new Error(`Unsupported sidebar config item: ${JSON.stringify(item)}`)
}

export async function getSidebarConfig(
	slugPath: string,
	userUrl: URL,
	userLocale: string,
): Promise<SidebarEntry[]>
{
	// Remove leading language prefix if present
	if (userLocale && slugPath.startsWith(`${userLocale}/`))
	{
		slugPath = slugPath.slice(userLocale.length + 1)
	}

	// Remove trailing index segment if present
	slugPath = slugPath.replace(/\/?index$/, '')

	// slugPath may be empty for the root path (home page)
	const slugSegments = slugPath.split('/').filter(Boolean)

	let sidebarConfig = undefined
	let sidebarConfigSlug = undefined
	for (let i = slugSegments.length; i >= 0; --i)
	{
		const slugSegment = slugSegments.slice(0, i).join('/')
		const file = path.join(SIDEBAR_CONFIG_ROOT, slugSegment, 'sidebar.config.mjs')
		const config = await loadConfig(file)
		if (config)
		{
			sidebarConfig = config
			sidebarConfigSlug = slugSegment
			break
		}
	}

	if (!sidebarConfig)
	{
		throw new Error(`Sidebar config not found for path '${slugPath}'`)
	}

	return Promise.all(
		sidebarConfig.map(
			item => formatSidebarItem(
				item,
				{
					sidebarConfigSlug: sidebarConfigSlug!,
					slugPath,
					userUrl,
					userLocale
				}
			)
		)
	)
}
