import { getPortfolio } from '../../../data/portfolio'
import { useLocale } from '../../../i18n/LocaleContext'
import { Reveal } from '../../../components/Reveal'
import { SectionHeading } from '../../../components/SectionHeading'

export function AboutSection() {
  const locale = useLocale()
  const portfolio = getPortfolio(locale)
  const about = portfolio.about

  return (
    <section id="about" className="section about" aria-labelledby="about-title">
      <SectionHeading eyebrow={locale === 'pl' ? '02 - O MNIE' : '02 - ABOUT'} note={about.note} />
      <div className="about-grid">
        <Reveal as="h2" id="about-title">
          {about.titleFirstLine}<br />{about.titleSecondLine} <em>{about.titleAccent}</em>
        </Reveal>
        <Reveal className="about-copy">
          {about.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          <div className="skill-cloud">{about.skills.map((skill) => <span key={skill}>{skill}</span>)}</div>
        </Reveal>
      </div>
      <Reveal className="about-stats">
        {about.stats.map((stat) => (
          <div key={stat.label}>
            <strong>{stat.value}{'suffix' in stat && <span>{stat.suffix}</span>}</strong>
            <span>{stat.label}</span>
          </div>
        ))}
      </Reveal>
    </section>
  )
}
