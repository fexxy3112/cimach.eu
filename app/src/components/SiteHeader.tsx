import { useEffect, useState } from 'react'
import { getPortfolio } from '../data/portfolio'
import { hasAdminSession } from '../auth/adminSession'
import { useLocale, type Locale } from '../i18n/LocaleContext'
import type { SeoPage } from '../seo'

const apiBase = import.meta.env.VITE_API_BASE_URL || '/api'

export function SiteHeader({ activePage, projectSlug, projectLocales }: {
  activePage: SeoPage
  projectSlug?: string
  projectLocales?: Locale[]
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const locale = useLocale()
  const portfolio = getPortfolio(locale)
  const homePath = `/${locale}/`
  const languagePath = (nextLocale: 'pl' | 'en') => activePage === 'project' && projectSlug && projectLocales?.includes(nextLocale)
    ? `/${nextLocale}/projects/${projectSlug}/`
    : `/${nextLocale}/`
  const copy = locale === 'pl'
    ? { nav: ['Projekty', 'O mnie', 'Fotografia', 'Kontakt'], admin: 'Panel zarządzania', navLabel: 'Nawigacja główna', theme: 'Zmień motyw', close: 'Zamknij menu', open: 'Otwórz menu', switchLanguage: 'Zmień język' }
    : { nav: ['Work', 'About', 'Photography', 'Contact'], admin: 'Admin panel', navLabel: 'Main navigation', theme: 'Toggle theme', close: 'Close menu', open: 'Open menu', switchLanguage: 'Change language' }

  useEffect(() => {
    let active = true
    let currentRequest: AbortController | undefined
    const refreshAdminSession = () => {
      currentRequest?.abort()
      const requestController = new AbortController()
      currentRequest = requestController
      fetch(`${apiBase}/auth/me`, { credentials: 'include', cache: 'no-store', signal: requestController.signal })
        .then(async (response) => {
          if (!response.ok) return null
          return response.json() as Promise<unknown>
        })
        .then((result) => {
          if (active && !requestController.signal.aborted) setIsAdmin(hasAdminSession(result))
        })
        .catch(() => {
          if (active && !requestController.signal.aborted) setIsAdmin(false)
        })
    }
    refreshAdminSession()
    window.addEventListener('focus', refreshAdminSession)
    return () => {
      active = false
      currentRequest?.abort()
      window.removeEventListener('focus', refreshAdminSession)
    }
  }, [])

  function toggleTheme() {
    const nextTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = nextTheme
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      'content',
      nextTheme === 'dark' ? '#11120f' : '#f4f4ef',
    )
  }

  function closeMenu() {
    setIsMenuOpen(false)
  }

  return (
    <header className="nav">
      <a href={homePath} className="logo" aria-label={locale === 'pl' ? 'Strona główna' : 'Home'}>
        {portfolio.monogram}
      </a>
      <nav className={isMenuOpen ? 'open' : undefined} aria-label={copy.navLabel}>
        <a href={activePage === 'home' ? '#work' : `${homePath}#work`} onClick={closeMenu}>{copy.nav[0]}</a>
        <a href={activePage === 'home' ? '#about' : `${homePath}#about`} onClick={closeMenu}>{copy.nav[1]}</a>
        <a href={activePage === 'home' ? '#photo' : `${homePath}#photo`} onClick={closeMenu}>{copy.nav[2]}</a>
        <a href={activePage === 'home' ? '#contact' : `${homePath}#contact`} onClick={closeMenu}>{copy.nav[3]}</a>
        {isAdmin && <a href={`/${locale}/admin/`} onClick={closeMenu}>{copy.admin}</a>}
      </nav>
      <div className="nav-right">
        <div className="language-switcher" aria-label={copy.switchLanguage}>
          <a href={languagePath('pl')} lang="pl" aria-current={locale === 'pl' ? 'page' : undefined}>PL</a>
          <span aria-hidden="true">/</span>
          <a href={languagePath('en')} lang="en" aria-current={locale === 'en' ? 'page' : undefined}>EN</a>
        </div>
        <button className="theme-toggle" type="button" onClick={toggleTheme} aria-label={copy.theme}>
          <span className="sun" aria-hidden="true">☼</span>
          <span className="moon" aria-hidden="true">◐</span>
        </button>
        <a className="availability" href={activePage === 'home' ? '#contact' : `${homePath}#contact`}><i aria-hidden="true" />{locale === 'pl' ? 'Dostępny do współpracy' : portfolio.availability.label}</a>
        <button
          className="menu-toggle"
          id="menuToggle"
          type="button"
          aria-label={isMenuOpen ? copy.close : copy.open}
          aria-expanded={isMenuOpen}
          onClick={() => setIsMenuOpen((open) => !open)}
        >
          <span /><span />
        </button>
      </div>
    </header>
  )
}
