import { getPortfolio, type PortfolioProject } from '../../../data/portfolio'
import { useLocale } from '../../../i18n/LocaleContext'
import { Reveal } from '../../../components/Reveal'
import { SectionHeading } from '../../../components/SectionHeading'
import { ArrowUpRight } from '../../../components/ArrowUpRight'
import type { Locale } from '../../../i18n/LocaleContext'

function ProjectRow({ project, locale }: { project: PortfolioProject; locale: Locale }) {
  const href = project.caseStudySlug
    ? `/${locale}/projects/${project.caseStudySlug}/`
    : project.href
  return (
    <Reveal as="a" className="work-item" href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noreferrer" draggable={false}>
      <span className="work-num">{project.number}</span>
      <div className="work-name">
        <h3>{project.name}</h3>
        <span>{project.category}</span>
      </div>
      <p>{project.description}</p>
      <div className="tags">{project.technologies.map((technology) => <span key={technology}>{technology}</span>)}</div>
      <span className="work-arrow"><ArrowUpRight /></span>
    </Reveal>
  )
}

export function ProjectsSection() {
  const locale = useLocale()
  const portfolio = getPortfolio(locale)
  const intro = portfolio.projectsIntro

  return (
    <section id="work" className="section work" aria-labelledby="work-title">
      <SectionHeading eyebrow={locale === 'pl' ? '01 - WYBRANE PROJEKTY' : '01 - SELECTED WORK'} note={intro.note} />
      <Reveal className="work-intro">
        <h2 id="work-title">{intro.title}<br /><em>{intro.accent}</em></h2>
        <p>{intro.description}</p>
      </Reveal>
      <div className="work-list">{portfolio.projects.map((project) => <ProjectRow key={project.number} project={project} locale={locale} />)}</div>
    </section>
  )
}
