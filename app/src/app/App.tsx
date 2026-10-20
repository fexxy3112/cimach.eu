import { useEffect, useState } from 'react'
import { LocaleContext, type Locale } from '../i18n/LocaleContext'
import { HomePage } from '../pages/home/HomePage'
import { StudioBodyArtPage } from '../pages/projects/StudioBodyArtPage'
import { LoginPage } from '../pages/auth/LoginPage'
import { AdminPage } from '../pages/auth/AdminPage'
import { SiteLayout } from '../layouts/SiteLayout'
import { AuthLayout } from '../layouts/AuthLayout'
import { getSeo, type SeoPage } from '../seo'

type AppRoute = { locale: Locale; page: SeoPage }

function routeFromPath(pathname: string): AppRoute | null {
  const match = pathname.match(/^\/(pl|en)(?:\/projects\/studio-bodyart|\/login|\/admin)?\/?$/)
  if (!match) return null
  return {
    locale: match[1] as Locale,
    page: pathname.includes('/projects/studio-bodyart')
      ? 'studioBodyArt'
      : pathname.includes('/login') ? 'login'
        : pathname.includes('/admin') ? 'admin' : 'home',
  }
}

export default function App({
  initialLocale = 'pl',
  initialPage = 'home',
}: { initialLocale?: Locale; initialPage?: SeoPage }) {
  const [route, setRoute] = useState<AppRoute>(() => typeof window === 'undefined'
    ? { locale: initialLocale, page: initialPage }
    : routeFromPath(window.location.pathname) ?? { locale: initialLocale, page: initialPage })

  useEffect(() => {
    const syncRoute = () => {
      const nextRoute = routeFromPath(window.location.pathname)
      if (!nextRoute) {
        window.history.replaceState(null, '', '/pl/')
        setRoute({ locale: 'pl', page: 'home' })
        document.documentElement.lang = 'pl'
        document.title = getSeo('pl').title
        return
      }

      setRoute(nextRoute)
      document.documentElement.lang = nextRoute.locale
      document.title = getSeo(nextRoute.locale, nextRoute.page).title
    }

    syncRoute()
    window.addEventListener('popstate', syncRoute)
    return () => window.removeEventListener('popstate', syncRoute)
  }, [])

  return (
    <LocaleContext.Provider value={route.locale}>
      {route.page === 'login' || route.page === 'admin'
        ? <AuthLayout>{route.page === 'admin' ? <AdminPage /> : <LoginPage />}</AuthLayout>
        : <SiteLayout activePage={route.page}>
            {route.page === 'studioBodyArt' ? <StudioBodyArtPage /> : <HomePage />}
          </SiteLayout>}
    </LocaleContext.Provider>
  )
}
