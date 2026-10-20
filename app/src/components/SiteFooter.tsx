import { getPortfolio } from '../data/portfolio'
import { useLocale } from '../i18n/LocaleContext'
import { ArrowUpRight } from './ArrowUpRight'

export function SiteFooter() {
  const locale = useLocale()
  const portfolio = getPortfolio(locale)
  return (
    <footer className="site-footer">
      <a className="logo" href={`/${locale}/`} aria-label={locale === 'pl' ? 'Wróć na początek' : 'Back to top'}>{portfolio.monogram}</a>
      <span>© 2026 {portfolio.owner.toUpperCase()}</span>
      <div>
        <a href={portfolio.social.github} target="_blank" rel="noreferrer">GITHUB <ArrowUpRight /></a>
        <a href={portfolio.social.instagram} target="_blank" rel="noreferrer">INSTAGRAM <ArrowUpRight /></a>
      </div>
    </footer>
  )
}
