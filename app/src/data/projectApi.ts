import type { Locale } from '../i18n/LocaleContext'

export type PublicProject = {
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
  locale: Locale
  projects: PublicProject[]
}

export type PublicProjectPageData = {
  kind: 'project'
  locale: Locale
  slug: string
  project: PublicProjectDetail
  availableLocales: Locale[]
}

export type PrerenderData = PublicProjectCatalogData | PublicProjectPageData

type ProjectListResponse = { projects: PublicProject[] }
type ProjectDetailResponse = { project: PublicProjectDetail }

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
  return { kind: 'catalog', locale, projects }
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
  return { kind: 'catalog', locale, projects }
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
