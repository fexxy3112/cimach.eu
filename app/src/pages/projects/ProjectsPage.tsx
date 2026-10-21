import { useEffect, useState } from 'react'
import type { PublicProject } from '../../data/projectApi'
import { projectCatalogView } from '../../data/projectCatalogView'
import { hasAdminSession } from '../../auth/adminSession'
import { useLocale } from '../../i18n/LocaleContext'
import { ProjectRow } from '../home/sections/ProjectsSection'
import './ProjectsPage.scss'

export function ProjectsPage({ projects, loading, error }: {
  projects: PublicProject[]
  loading: boolean
  error: boolean
}) {
  const locale = useLocale()
  const [adminCatalog, setAdminCatalog] = useState<{ locale: string; projects: PublicProject[] } | null>(null)
  const [adminError, setAdminError] = useState(false)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  useEffect(() => {
    let request: AbortController | undefined
    const refresh = async () => {
      request?.abort()
      const controller = new AbortController()
      request = controller
      const options = { credentials: 'include' as const, cache: 'no-store' as const, signal: controller.signal }
      const base = import.meta.env.VITE_API_BASE_URL || '/api'
      try {
        const session = await fetch(`${base}/auth/me`, options)
        if (!session.ok || !hasAdminSession(await session.json())) {
          if (!controller.signal.aborted) { setAdminCatalog(null); setAdminError(false) }
          return
        }
        const response = await fetch(`${base}/admin/projects/catalog?locale=${locale}`, options)
        if (!response.ok) throw new Error('catalog_unavailable')
        const data = await response.json() as { projects: PublicProject[] }
        if (!controller.signal.aborted) {
          setAdminCatalog({ locale, projects: data.projects })
          setAdminError(false)
        }
      } catch {
        if (!controller.signal.aborted) { setAdminCatalog(null); setAdminError(true) }
      }
    }
    void refresh()
    window.addEventListener('focus', refresh)
    return () => { request?.abort(); window.removeEventListener('focus', refresh) }
  }, [locale])
  const isAdmin = adminCatalog?.locale === locale
  const view = projectCatalogView(isAdmin ? adminCatalog.projects : projects, query, page)
  const firstPage = Math.max(1, Math.min(view.page - 2, view.pages - 4))
  return (
    <main className="site-main projects-page">
      <section className="section work" aria-labelledby="projects-title">
        <div className="work-intro">
          <h1 id="projects-title">{locale === 'pl' ? 'Wszystkie projekty' : 'All projects'}<em>.</em></h1>
        </div>
        <div className="projects-page__tools">
          <label className="projects-page__search">
            <span>{locale === 'pl' ? 'Szukaj projektu' : 'Search projects'}</span>
            <input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} placeholder={locale === 'pl' ? 'Nazwa, opis lub technologia' : 'Name, description or technology'} />
          </label>
          <p role="status">{locale === 'pl' ? 'Wyniki' : 'Results'}: {view.total}</p>
        </div>
        {isAdmin && <p className="projects-page__hint">{locale === 'pl' ? 'Widok administratora - zawiera również szkice.' : 'Admin view - also includes drafts.'}</p>}
        {adminError && <p role="alert">{locale === 'pl' ? 'Nie udało się odświeżyć widoku administratora. Wyświetlamy tylko opublikowane projekty.' : 'Admin view could not be refreshed. Only published projects are shown.'}</p>}
        <div className="work-list" aria-busy={loading}>
          {view.projects.map((project, index) => <ProjectRow key={project.caseStudySlug || project.href} project={project} locale={locale} position={view.offset + index + 1} />)}
          {loading && <p role="status">{locale === 'pl' ? 'Ładowanie projektów…' : 'Loading projects…'}</p>}
          {error && <p role="alert">{locale === 'pl' ? 'Nie udało się pobrać projektów.' : 'Projects could not be loaded.'}</p>}
          {!loading && !error && view.total === 0 && <p>{locale === 'pl' ? 'Brak projektów spełniających kryteria.' : 'No matching projects.'}</p>}
        </div>
        {view.pages > 1 && <nav className="projects-page__pagination" aria-label={locale === 'pl' ? 'Strony projektów' : 'Project pages'}>
          <button type="button" disabled={view.page === 1} onClick={() => setPage(view.page - 1)}>{locale === 'pl' ? 'Poprzednia' : 'Previous'}</button>
          {Array.from({ length: Math.min(5, view.pages) }, (_, index) => firstPage + index).map((number) => <button type="button" key={number} aria-current={number === view.page ? 'page' : undefined} onClick={() => setPage(number)}>{number}</button>)}
          <button type="button" disabled={view.page === view.pages} onClick={() => setPage(view.page + 1)}>{locale === 'pl' ? 'Następna' : 'Next'}</button>
        </nav>}
      </section>
    </main>
  )
}
