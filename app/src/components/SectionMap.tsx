import { useEffect, useState } from 'react'
import { useLocale } from '../i18n/LocaleContext'
import './SectionMap.scss'

export function SectionMap() {
  const locale = useLocale()
  const sections = [
    { id: 'intro', label: locale === 'pl' ? 'Intro' : 'Intro' },
    { id: 'work', label: locale === 'pl' ? 'Projekty' : 'Work' },
    { id: 'about', label: locale === 'pl' ? 'O mnie' : 'About' },
    { id: 'photo', label: locale === 'pl' ? 'Fotografia' : 'Photography' },
    { id: 'contact', label: locale === 'pl' ? 'Kontakt' : 'Contact' },
  ]
  const [activeSection, setActiveSection] = useState(sections[0].id)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visibleSections = entries
          .filter((entry) => entry.isIntersecting)
          .sort((first, second) => second.intersectionRatio - first.intersectionRatio)

        if (visibleSections[0]) setActiveSection(visibleSections[0].target.id)
      },
      { rootMargin: '-38% 0px -38% 0px', threshold: [0, 0.15, 0.35, 0.6] },
    )

    sections.forEach(({ id }) => {
      const section = document.getElementById(id)
      if (section) observer.observe(section)
    })

    return () => observer.disconnect()
  }, [])

  return (
    <nav className="section-map" aria-label={locale === 'pl' ? 'Mapa sekcji' : 'Section map'}>
      {sections.map(({ id, label }, index) => {
        const number = id === 'intro' ? '00' : String(index).padStart(2, '0')

        return (
          <a
            className={activeSection === id ? 'section-map__link section-map__link--active' : 'section-map__link'}
            href={`#${id}`}
            title={label}
            aria-label={`${number} - ${label}`}
            aria-current={activeSection === id ? 'location' : undefined}
            key={id}
          >
            <span className="section-map__number">{number}</span>
          </a>
        )
      })}
    </nav>
  )
}
