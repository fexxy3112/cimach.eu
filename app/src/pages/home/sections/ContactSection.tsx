import { getPortfolio } from '../../../data/portfolio'
import { useLocale } from '../../../i18n/LocaleContext'
import { Reveal } from '../../../components/Reveal'
import { SectionHeading } from '../../../components/SectionHeading'
import { ArrowUpRight } from '../../../components/ArrowUpRight'

export function ContactSection() {
  const locale = useLocale()
  const portfolio = getPortfolio(locale)
  const contact = portfolio.contact

  return (
    <section id="contact" className="section contact" aria-labelledby="contact-title">
      <SectionHeading eyebrow={locale === 'pl' ? '04 - KONTAKT' : '04 - GET IN TOUCH'} note={contact.note} />
      <Reveal as="h2" id="contact-title">
        {contact.titleFirstLine}<br /><em>{contact.titleAccent}</em>
      </Reveal>
      <Reveal className="contact-bottom">
        <p>{contact.description}</p>
        <a href={`mailto:${contact.email}`} className="email-link">{contact.email}<ArrowUpRight /></a>
      </Reveal>
    </section>
  )
}
