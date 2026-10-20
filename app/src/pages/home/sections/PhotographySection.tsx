import { getPortfolio } from '../../../data/portfolio'
import { useLocale } from '../../../i18n/LocaleContext'
import { Reveal } from '../../../components/Reveal'
import { SectionHeading } from '../../../components/SectionHeading'
import { ArrowUpRight } from '../../../components/ArrowUpRight'
import photograph from '../../../assets/main_photo.jpg'

export function PhotographySection() {
  const locale = useLocale()
  const portfolio = getPortfolio(locale)
  const photography = portfolio.photography

  return (
    <section id="photo" className="section photo" aria-labelledby="photo-title">
      <SectionHeading eyebrow={locale === 'pl' ? '03 - FOTOGRAFIA' : '03 - PHOTOGRAPHY'} note={photography.note} />
      <div className="photo-grid">
        <Reveal className="photo-copy">
          <h2 id="photo-title">{photography.titleFirstLine}<br />{photography.titleSecondLine} <em>{photography.titleAccent}</em></h2>
          <p>{photography.description}</p>
          <a className="line-link" href={photography.href} target="_blank" rel="noreferrer">{photography.linkLabel}<ArrowUpRight /></a>
        </Reveal>
        <Reveal as="a" className="photo-frame" href={photography.href} target="_blank" rel="noreferrer" ariaLabel={locale === 'pl' ? 'Otwórz profil fotograficzny' : 'Open photography profile'}>
          <div className="photo-art" aria-hidden="true">
            <img className="nodrag" src={photograph} alt="" draggable={false} />
            <span className="photo-label">{photography.frameLabel}</span>
          </div>
          <span className="photo-caption">{photography.caption}</span>
        </Reveal>
      </div>
    </section>
  )
}
