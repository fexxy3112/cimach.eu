import type { PublicProject } from '../../../data/projectApi'
import { getPortfolio } from '../../../data/portfolio'
import { useLocale } from '../../../i18n/LocaleContext'
import { Reveal } from '../../../components/Reveal'
import { SectionHeading } from '../../../components/SectionHeading'
import { ArrowUpRight } from '../../../components/ArrowUpRight'
import type { Locale } from '../../../i18n/LocaleContext'

export function ProjectRow({ project, locale, position }: { project: PublicProject; locale: Locale; position: number }) {
  const content = <>
      <span className="work-num">{String(position).padStart(2, '0')}</span>
      <div className="work-name">
        <h3>{project.name}</h3>
        <span>{project.category}</span>
      </div>
      <p>{project.description}</p>
      <div className="tags">{project.technologies.map((technology) => <span key={technology}>{technology}</span>)}</div>
      {project.caseStudySlug && <span className="work-arrow"><ArrowUpRight /></span>}
    </>
  return project.caseStudySlug
    ? <Reveal as="a" className="work-item" href={`/${locale}/projects/${encodeURIComponent(project.caseStudySlug)}/`} draggable={false}>{content}</Reveal>
    : <Reveal as="div" className="work-item" aria-disabled="true">{content}</Reveal>
}

export function ProjectsSection({ projects, loading, error }: {
  projects: PublicProject[]
  loading: boolean
  error: boolean
}) {
  const locale = useLocale()
  const intro = getPortfolio(locale).projectsIntro

  return (
    <section id="work" className="section work" aria-labelledby="work-title">
      <SectionHeading eyebrow={locale === 'pl' ? '01 - WYBRANE PROJEKTY' : '01 - SELECTED WORK'} note={intro.note} />
      <Reveal className="work-intro">
        <h2 id="work-title">{intro.title}<br /><em>{intro.accent}</em></h2>
        <p>{intro.description}</p>
      </Reveal>
      <div className="work-list" aria-busy={loading}>
        {projects.map((project, index) => <ProjectRow key={project.caseStudySlug || project.href} project={project} locale={locale} position={index + 1} />)}
        <Reveal as="a" className="work-item work-item--all" href={`/${locale}/projects/`} draggable={false}>
          <span className="work-num">{String(projects.length + 1).padStart(2, '0')}</span>
          <div className="work-name"><h3>{locale === 'pl' ? 'Zobacz wszystkie projekty' : 'View all projects'}</h3></div>
          <span className="work-arrow"><ArrowUpRight /></span>
        </Reveal>
        {loading && <p role="status">{locale === 'pl' ? 'Ładowanie projektów…' : 'Loading projects…'}</p>}
        {error && <p role="alert">{locale === 'pl' ? 'Nie udało się pobrać projektów.' : 'Projects could not be loaded.'}</p>}
      </div>
    </section>
  )
}
