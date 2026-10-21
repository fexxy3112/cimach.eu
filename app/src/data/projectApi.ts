import type { Locale } from '../i18n/LocaleContext'

export type PublicProject = {
  status?: 'draft' | 'published'
  number: string
  name: string
  category: string
  description: string
  technologies: string[]
  href: string
  caseStudySlug?: string
  mainImage: string | null
  mainImageAlt?: string | null
  seoTitle: string | null
  seoDescription: string | null
}

export type PublicProjectDetail = PublicProject & {
  gallery: Array<{ src: string; alt: string }>
}

export type PublicProjectCatalogData = {
  kind: 'catalog'
  scope?: 'featured' | 'all'
  locale: Locale
  projects: PublicProject[]
}

export type PublicProjectPageData = {
  preview?: boolean
  kind: 'project'
  locale: Locale
  slug: string
  project: PublicProjectDetail
  availableLocales: Locale[]
}

export type PrerenderData = PublicProjectCatalogData | PublicProjectPageData

type ProjectListResponse = { projects: PublicProject[] }
type ProjectDetailResponse = { project: PublicProjectDetail }

export async function loadAdminProjectPreview(locale: Locale, slug: string, apiBase: string, fetcher: typeof fetch = fetch, signal?: AbortSignal): Promise<PublicProjectPageData | null> {
  const url = apiUrl(apiBase, `/admin/projects/by-slug/${encodeURIComponent(slug)}/preview?locale=${locale}`)
  const response = await fetcher(url, { credentials: 'include', cache: 'no-store', signal })
  if (response.status === 404) return null
  if (response.status === 401 || response.status === 403) throw new Error('preview_unauthorized')
  const data = await readJson<PublicProjectPageData>(response, url)
  if (!data.preview || data.locale !== locale || data.slug !== slug || data.project.caseStudySlug !== slug) return null
  return data
}

async function readJson<T>(response: Response, url: string): Promise<T> {
  if (!response.ok) throw new Error(`Project API request failed (${response.status}): ${url}`)
  return response.json() as Promise<T>
}

function apiUrl(apiBase: string, path: string) {
  return `${apiBase.replace(/\/+$/, '')}${path}`
}

export async function loadPublicProjectCatalog(
  locale: Locale,
  apiBase: string,
  fetcher: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<PublicProjectCatalogData> {
  const url = apiUrl(apiBase, `/projects?locale=${locale}`)
  const response = await fetcher(url, { signal })
  const { projects } = await readJson<ProjectListResponse>(response, url)
  return { kind: 'catalog', scope: 'featured', locale, projects }
}

export async function loadAllPublicProjectCatalog(
  locale: Locale,
  apiBase: string,
  fetcher: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<PublicProjectCatalogData> {
  const url = apiUrl(apiBase, `/projects?locale=${locale}&scope=all`)
  const response = await fetcher(url, { signal })
  const { projects } = await readJson<ProjectListResponse>(response, url)
  return { kind: 'catalog', scope: 'all', locale, projects }
}

export async function loadPublicProjectPage(
  locale: Locale,
  slug: string,
  apiBase: string,
  fetcher: typeof fetch = fetch,
  signal?: AbortSignal,
  knownLocales?: Locale[],
): Promise<PublicProjectPageData | null> {
  const base = apiBase.replace(/\/+$/, '')
  const query = `?locale=${locale}`
  const detailUrl = apiUrl(base, `/projects/${encodeURIComponent(slug)}${query}`)
  const response = await fetcher(detailUrl, { signal })
  if (response.status === 404) return null
  const { project } = await readJson<ProjectDetailResponse>(response, detailUrl)
  if (project.caseStudySlug !== slug) return null
  const availableLocales = knownLocales ? [...knownLocales] : [locale]

  if (!knownLocales) {
    const otherLocale: Locale = locale === 'pl' ? 'en' : 'pl'
    try {
      const catalog = await loadAllPublicProjectCatalog(otherLocale, base, fetcher, signal)
      if (catalog.projects.some((candidate) => candidate.caseStudySlug === slug)) availableLocales.push(otherLocale)
    } catch {
      // A missing alternate translation must not hide an otherwise valid project page.
    }
  }

  if (!availableLocales.includes(locale)) availableLocales.push(locale)
  return { kind: 'project', locale, slug, project, availableLocales }
}
