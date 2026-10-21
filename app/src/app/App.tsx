import { useEffect, useState } from 'react'
import { LocaleContext, type Locale } from '../i18n/LocaleContext'
import { HomePage } from '../pages/home/HomePage'
import { ProjectPage } from '../pages/projects/ProjectPage'
import { ProjectsPage } from '../pages/projects/ProjectsPage'
import { LoginPage } from '../pages/auth/LoginPage'
import { AdminPage } from '../pages/auth/AdminPage'
import { SiteLayout } from '../layouts/SiteLayout'
import { AuthLayout } from '../layouts/AuthLayout'
import { getSeo, type SeoPage } from '../seo'
import {
  loadPublicProjectCatalog,
  loadAllPublicProjectCatalog,
  loadPublicProjectPage,
  type PrerenderData,
  type PublicProjectCatalogData,
  type PublicProjectPageData,
} from '../data/projectApi'

type AppRoute = { locale: Locale; page: SeoPage; projectSlug?: string }
type RequestState = { key: string; status: 'loading' | 'error' | 'not-found' }

function updateLink(selector: string, href: string | null) {
  let link = document.querySelector<HTMLLinkElement>(selector)
  if (!href) {
    link?.remove()
    return
  }
  if (!link) {
    link = document.createElement('link')
    if (selector.includes('canonical')) {
      link.rel = 'canonical'
    } else {
      link.rel = 'alternate'
      link.hreflang = selector.includes('hreflang="pl"') ? 'pl' : selector.includes('hreflang="en"') ? 'en' : 'x-default'
    }
    document.head.append(link)
  }
  link.href = href
}

function updateMeta(selector: string, content: string | null) {
  const meta = document.querySelector<HTMLMetaElement>(selector)
  if (!content) {
    meta?.removeAttribute('content')
    return
  }
  meta?.setAttribute('content', content)
}

function applySeoMetadata(pageSeo: ReturnType<typeof getSeo>, robots: string) {
  document.title = pageSeo.title
  updateLink('link[rel="canonical"]', pageSeo.canonical)
  updateLink('link[rel="alternate"][hreflang="pl"]', pageSeo.alternatePl)
  updateLink('link[rel="alternate"][hreflang="en"]', pageSeo.alternateEn)
  updateLink('link[rel="alternate"][hreflang="x-default"]', pageSeo.xDefault)
  updateMeta('meta[name="description"]', pageSeo.description)
  updateMeta('meta[property="og:title"]', pageSeo.title)
  updateMeta('meta[property="og:description"]', pageSeo.description)
  updateMeta('meta[property="og:url"]', pageSeo.canonical)
  updateMeta('meta[property="og:locale"]', pageSeo.ogLocale)
  updateMeta('meta[name="twitter:title"]', pageSeo.title)
  updateMeta('meta[name="twitter:description"]', pageSeo.description)
  updateMeta('meta[name="robots"]', robots)
}

function routeFromPath(pathname: string): AppRoute | null {
  const match = pathname.match(/^\/(pl|en)(?:\/projects(?:\/([^/]+))?|\/login|\/admin)?\/?$/)
  if (!match) return null
  const projectSlug = match[2]
  return {
    locale: match[1] as Locale,
    page: projectSlug
      ? 'project'
      : pathname.includes('/projects') ? 'projects' : pathname.includes('/login') ? 'login'
        : pathname.includes('/admin') ? 'admin' : 'home',
    ...(projectSlug ? { projectSlug } : {}),
  }
}

function matchesCatalog(data: PrerenderData | undefined, locale: Locale, page: SeoPage): data is PublicProjectCatalogData {
  return data?.kind === 'catalog' && data.locale === locale && (data.scope ?? 'featured') === (page === 'projects' ? 'all' : 'featured')
}

function matchesProject(data: PrerenderData | undefined, locale: Locale, slug: string | undefined): data is PublicProjectPageData {
  return data?.kind === 'project' && data.locale === locale && data.slug === slug
}

export default function App({
  initialLocale = 'pl',
  initialPage = 'home',
  initialProjectSlug,
  initialData,
}: { initialLocale?: Locale; initialPage?: SeoPage; initialProjectSlug?: string; initialData?: PrerenderData }) {
  const [route, setRoute] = useState<AppRoute>(() => typeof window === 'undefined'
    ? { locale: initialLocale, page: initialPage, ...(initialProjectSlug ? { projectSlug: initialProjectSlug } : {}) }
    : routeFromPath(window.location.pathname) ?? { locale: initialLocale, page: initialPage })
  const [pageData, setPageData] = useState<PrerenderData | undefined>(initialData)
  const [requestState, setRequestState] = useState<RequestState | undefined>()
  const requestKey = route.page === 'project'
    ? `${route.locale}:project:${route.projectSlug}`
    : `${route.locale}:catalog:${route.page}`

  useEffect(() => {
    const syncRoute = () => {
      const nextRoute = routeFromPath(window.location.pathname)
      if (!nextRoute) {
        window.history.replaceState(null, '', '/pl/')
        setRoute({ locale: 'pl', page: 'home' })
        document.documentElement.lang = 'pl'
        return
      }
      setRoute(nextRoute)
      document.documentElement.lang = nextRoute.locale
    }
    syncRoute()
    window.addEventListener('popstate', syncRoute)
    return () => window.removeEventListener('popstate', syncRoute)
  }, [])

  const currentProjectPage = route.page === 'project' && matchesProject(pageData, route.locale, route.projectSlug)
    ? pageData
    : undefined
  const currentCatalog = (route.page === 'home' || route.page === 'projects') && matchesCatalog(pageData, route.locale, route.page)
    ? pageData
    : undefined
  const currentRequest = requestState?.key === requestKey ? requestState.status : undefined

  useEffect(() => {
    if ((route.page === 'home' || route.page === 'projects') && matchesCatalog(pageData, route.locale, route.page)) return
    if (route.page === 'project' && matchesProject(pageData, route.locale, route.projectSlug)) return
    if (route.page !== 'home' && route.page !== 'projects' && route.page !== 'project') return

    const controller = new AbortController()
    setRequestState({ key: requestKey, status: 'loading' })
    const apiBase = import.meta.env.VITE_API_BASE_URL || '/api'
    const request = route.page === 'home'
      ? loadPublicProjectCatalog(route.locale, apiBase, fetch, controller.signal)
      : route.page === 'projects' ? loadAllPublicProjectCatalog(route.locale, apiBase, fetch, controller.signal)
        : loadPublicProjectPage(route.locale, route.projectSlug!, apiBase, fetch, controller.signal)
    request.then((data) => {
      if (controller.signal.aborted) return
      if (data === null) {
        setRequestState({ key: requestKey, status: 'not-found' })
        return
      }
      setPageData(data)
      setRequestState(undefined)
    }).catch(() => {
      if (!controller.signal.aborted) setRequestState({ key: requestKey, status: 'error' })
    })
    return () => controller.abort()
  }, [route.locale, route.page, route.projectSlug, requestKey, pageData?.kind, pageData?.locale, pageData?.kind === 'project' ? pageData.slug : undefined])

  useEffect(() => {
    if (route.page === 'project' && currentProjectPage) {
      applySeoMetadata(
        getSeo(route.locale, 'project', currentProjectPage.project, route.projectSlug, currentProjectPage.availableLocales),
        'index, follow, max-image-preview:large',
      )
    } else if (route.page === 'project' && currentRequest === 'not-found') {
      document.title = route.locale === 'pl' ? 'Nie znaleziono projektu | CIMACH' : 'Project not found | CIMACH'
      updateLink('link[rel="canonical"]', null)
      updateLink('link[rel="alternate"][hreflang="pl"]', null)
      updateLink('link[rel="alternate"][hreflang="en"]', null)
      updateLink('link[rel="alternate"][hreflang="x-default"]', null)
      updateMeta('meta[name="description"]', null)
      updateMeta('meta[property="og:title"]', document.title)
      updateMeta('meta[property="og:description"]', null)
      updateMeta('meta[property="og:url"]', null)
      updateMeta('meta[property="og:locale"]', route.locale === 'pl' ? 'pl_PL' : 'en_US')
      updateMeta('meta[name="twitter:title"]', document.title)
      updateMeta('meta[name="twitter:description"]', null)
      updateMeta('meta[name="robots"]', 'noindex, nofollow')
    } else if (route.page !== 'project') {
      const pageSeo = getSeo(route.locale, route.page)
      const robots = route.page === 'login' || route.page === 'admin'
        ? 'noindex, nofollow'
        : 'index, follow, max-image-preview:large'
      applySeoMetadata(pageSeo, robots)
    }
  }, [route.locale, route.page, route.projectSlug, currentProjectPage, currentRequest])

  const projectLoading = route.page === 'project' && !currentProjectPage && currentRequest !== 'error' && currentRequest !== 'not-found'
  const projectError = route.page === 'project' && currentRequest === 'error'
  const projectNotFound = route.page === 'project' && currentRequest === 'not-found'

  return (
    <LocaleContext.Provider value={route.locale}>
      {route.page === 'login' || route.page === 'admin'
        ? <AuthLayout>{route.page === 'admin' ? <AdminPage /> : <LoginPage />}</AuthLayout>
        : <SiteLayout
            activePage={route.page}
            projectSlug={route.projectSlug}
            projectLocales={currentProjectPage?.availableLocales}
          >
            {route.page === 'project'
              ? <ProjectPage project={currentProjectPage?.project ?? null} loading={projectLoading} error={projectError} notFound={projectNotFound} />
              : route.page === 'projects'
                ? <ProjectsPage projects={currentCatalog?.projects ?? []} loading={!currentCatalog && currentRequest !== 'error'} error={currentRequest === 'error'} />
                : <HomePage projects={currentCatalog?.projects ?? []} loading={route.page === 'home' && !currentCatalog && currentRequest !== 'error'} error={route.page === 'home' && currentRequest === 'error'} />}
          </SiteLayout>}
    </LocaleContext.Provider>
  )
}
