import { useEffect, useRef, type ReactNode } from 'react'
import { SiteFooter } from '../components/SiteFooter'
import { SiteHeader } from '../components/SiteHeader'
import { SectionMap } from '../components/SectionMap'
import type { SeoPage } from '../seo'
import type { Locale } from '../i18n/LocaleContext'

export function SiteLayout({ children, activePage, projectSlug, projectLocales, projectPreview }: {
  children: ReactNode
  activePage: SeoPage
  projectSlug?: string
  projectLocales?: Locale[]
  projectPreview?: boolean
}) {
  const progressRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    let frame = 0
    const updateProgress = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight
        const progress = maxScroll > 0 ? (window.scrollY / maxScroll) * 100 : 0
        if (progressRef.current) progressRef.current.style.width = `${progress}%`
      })
    }

    window.addEventListener('scroll', updateProgress, { passive: true })
    updateProgress()
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', updateProgress)
    }
  }, [])

  return (
    <>
      <div className="progress" aria-hidden="true"><span ref={progressRef} /></div>
      <SiteHeader activePage={activePage} projectSlug={projectSlug} projectLocales={projectLocales} projectPreview={projectPreview} />
      {activePage === 'home' && <SectionMap />}
      {children}
      <SiteFooter />
    </>
  )
}
