import { getPortfolio } from '../../../data/portfolio'
import { useLocale } from '../../../i18n/LocaleContext'
import { Fragment } from 'react'

export function TechnologyTicker() {
  const locale = useLocale()
  const portfolio = getPortfolio(locale)
  const repeatedTopics = [...portfolio.technologyTicker, ...portfolio.technologyTicker]

  return (
    <div className="ticker" aria-label={locale === 'pl' ? 'Technologie i obszary pracy' : 'Technologies and areas of work'}>
      <div className="ticker-track" aria-hidden="true">
        {repeatedTopics.map((topic, index) => (
          <Fragment key={`${topic}-${index}`}>
            <span>{topic}</span><b>✳</b>
          </Fragment>
        ))}
      </div>
    </div>
  )
}
