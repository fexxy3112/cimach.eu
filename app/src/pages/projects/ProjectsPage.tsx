import type { PublicProject } from '../../data/projectApi'
import { useLocale } from '../../i18n/LocaleContext'
import { ProjectRow } from '../home/sections/ProjectsSection'
import './ProjectsPage.scss'

export function ProjectsPage({ projects, loading, error }: {
  projects: PublicProject[]
  loading: boolean
  error: boolean
}) {
  const locale = useLocale()
  return (
    <main className="site-main projects-page">
      <section className="section work" aria-labelledby="projects-title">
        <div className="work-intro">
          <h1 id="projects-title">{locale === 'pl' ? 'Wszystkie projekty' : 'All projects'}<em>.</em></h1>
        </div>
        <div className="work-list" aria-busy={loading}>
          {projects.map((project, index) => <ProjectRow key={project.caseStudySlug || project.href} project={project} locale={locale} position={index + 1} />)}
          {loading && <p role="status">{locale === 'pl' ? 'Ładowanie projektów…' : 'Loading projects…'}</p>}
          {error && <p role="alert">{locale === 'pl' ? 'Nie udało się pobrać projektów.' : 'Projects could not be loaded.'}</p>}
          {!loading && !error && projects.length === 0 && <p>{locale === 'pl' ? 'Brak opublikowanych projektów.' : 'No published projects yet.'}</p>}
        </div>
      </section>
    </main>
  )
}
