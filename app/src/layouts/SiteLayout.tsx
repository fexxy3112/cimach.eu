import { useEffect, useRef, type ReactNode } from 'react'
import { SiteFooter } from '../components/SiteFooter'
import { SiteHeader } from '../components/SiteHeader'
import { SectionMap } from '../components/SectionMap'
import type { SeoPage } from '../seo'

export function SiteLayout({ children, activePage }: { children: ReactNode; activePage: SeoPage }) {
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
      <SiteHeader activePage={activePage} />
      {activePage === 'home' && <SectionMap />}
      {children}
      <SiteFooter />
    </>
  )
}
