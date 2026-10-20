import { getPortfolio } from '../../../data/portfolio'
import { useLocale } from '../../../i18n/LocaleContext'
import { Reveal } from '../../../components/Reveal'

export function HeroSection() {
  const locale = useLocale()
  const portfolio = getPortfolio(locale)
  const hero = portfolio.hero
  return (
    <section className="hero" id="intro" aria-labelledby="hero-title">
      <Reveal className="hero-meta">
        <span>{hero.metaLabel}</span><span>{portfolio.location}</span>
      </Reveal>
      <div className="hero-title-wrap">
        <Reveal as="p" className="hero-kicker">{hero.kicker}</Reveal>
        <h1 className="hero-title" id="hero-title">
          <span className="title-line"><span>{hero.firstLine}</span></span>
          <span className="title-line"><span>{hero.secondLine} <em>{hero.accent}</em></span></span>
        </h1>
      </div>
      <Reveal className="hero-bottom">
        <p>{hero.description}</p>
        <a className="round-link" href="#work" aria-label={locale === 'pl' ? 'Przejdź do projektów' : 'Go to projects'} draggable={false}>
          <svg className="nodrag" aria-hidden="true" viewBox="0 0 24 24" fill="none">
            <path d="M12 4v15m0 0 6-6m-6 6-6-6" />
          </svg>
        </a>
      </Reveal>
      <div className="hero-index"><span>01</span><span>{locale === 'pl' ? 'PRZEWIŃ, ABY ODKRYĆ' : 'SCROLL TO EXPLORE'}</span></div>
    </section>
  )
}
