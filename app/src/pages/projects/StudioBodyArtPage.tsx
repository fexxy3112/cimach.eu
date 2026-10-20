import { useEffect, useRef, useState } from 'react'
import { getPortfolio } from '../../data/portfolio'
import { studioBodyArtPreviews } from '../../data/project-previews'
import { useLocale } from '../../i18n/LocaleContext'
import { ArrowUpRight } from '../../components/ArrowUpRight'
import './StudioBodyArtPage.scss'

export function StudioBodyArtPage() {
  const locale = useLocale()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const backRef = useRef<HTMLAnchorElement>(null)
  const titleSectionRef = useRef<HTMLElement>(null)
  const [selectedPreviewIndex, setSelectedPreviewIndex] = useState<number | null>(null)
  const [isBackCompact, setIsBackCompact] = useState(false)
  const project = getPortfolio(locale).projects.find(({ caseStudySlug }) => caseStudySlug === 'studio-bodyart')

  useEffect(() => {
    const titleSection = titleSectionRef.current
    const back = backRef.current
    if (!titleSection || !back) return

    let frame = 0
    const updateBackState = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        if (window.scrollY <= 0) {
          setIsBackCompact(false)
          return
        }

        const titleTop = titleSection.getBoundingClientRect().top
        const backRect = back.getBoundingClientRect()
        setIsBackCompact((isCompact) => isCompact
          ? titleTop <= backRect.bottom
          : titleTop <= backRect.top)
      })
    }

    updateBackState()
    window.addEventListener('scroll', updateBackState, { passive: true })
    window.addEventListener('resize', updateBackState)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', updateBackState)
      window.removeEventListener('resize', updateBackState)
    }
  }, [])

  if (!project) return null

  const copy = locale === 'pl'
    ? { back: 'POWRÓT DO PROJEKTÓW', eyebrow: 'PROJEKT / 02', overview: 'O projekcie', previews: 'Podgląd zdjęć', technologies: 'Technologie', visit: 'Odwiedź stronę projektu', close: 'Zamknij podgląd zdjęcia', previous: 'Poprzednie zdjęcie', next: 'Następne zdjęcie', photo: 'Zdjęcie' }
    : { back: 'BACK TO SELECTED WORK', eyebrow: 'PROJECT / 02', overview: 'Overview', previews: 'Photo previews', technologies: 'Technologies', visit: 'Visit the live project', close: 'Close photo preview', previous: 'Previous photo', next: 'Next photo', photo: 'Photo' }

  const selectedPreview = selectedPreviewIndex === null ? null : studioBodyArtPreviews[selectedPreviewIndex]

  function openPreview(index: number) {
    setSelectedPreviewIndex(index)
    dialogRef.current?.showModal()
  }

  function movePreview(direction: -1 | 1) {
    setSelectedPreviewIndex((current) => current === null
      ? current
      : (current + direction + studioBodyArtPreviews.length) % studioBodyArtPreviews.length)
  }

  return (
    <main className="site-main project-detail">
      <a
        ref={backRef}
        className={`project-detail__back${isBackCompact ? ' project-detail__back--compact' : ''}`}
        href={`/${locale}/#work`}
        aria-label={copy.back}
        title={isBackCompact ? copy.back : undefined}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
          <path d="M19 12H5m0 0 7-7m-7 7 7 7" />
        </svg>
        <span>{copy.back}</span>
      </a>
      <section className="project-detail__hero" aria-labelledby="project-title" ref={titleSectionRef}>
        <p className="eyebrow">{copy.eyebrow}</p>
        <h1 id="project-title">{project.name}<em>.</em></h1>
        <p className="project-detail__category">{project.category}</p>
      </section>
      <section className="project-detail__overview" aria-labelledby="project-overview-title">
        <h2 id="project-overview-title" className="eyebrow">{copy.overview}</h2>
        <p>{project.description}</p>
      </section>
      <section className="project-detail__gallery" aria-labelledby="project-gallery-title">
        <h2 id="project-gallery-title" className="eyebrow">{copy.previews}</h2>
        <div className="project-detail__gallery-grid">
          {studioBodyArtPreviews.map((preview, index) => (
            <button
              className="project-detail__preview"
              type="button"
              key={preview.src}
              onClick={() => openPreview(index)}
              aria-label={`${copy.previews} ${index + 1}`}
            >
              <img className="nodrag" src={preview.src} alt={preview.alt[locale]} loading="lazy" decoding="async" draggable={false} />
            </button>
          ))}
        </div>
      </section>
      <section className="project-detail__bottom" aria-label={copy.technologies}>
        <div>
          <h2 className="eyebrow">{copy.technologies}</h2>
          <div className="tags">
            {project.technologies.map((technology) => <span key={technology}>{technology}</span>)}
          </div>
        </div>
        <a className="project-detail__visit" href={project.href} target="_blank" rel="noreferrer">
          {copy.visit}<ArrowUpRight />
        </a>
      </section>
      <dialog
        className="project-detail__lightbox"
        ref={dialogRef}
        aria-label={copy.previews}
        onClose={() => setSelectedPreviewIndex(null)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft') {
            event.preventDefault()
            movePreview(-1)
          } else if (event.key === 'ArrowRight') {
            event.preventDefault()
            movePreview(1)
          }
        }}
        onClick={(event) => {
          if (event.target === dialogRef.current) dialogRef.current?.close()
        }}
      >
        <button className="project-detail__lightbox-close" type="button" onClick={() => dialogRef.current?.close()} aria-label={copy.close}>×</button>
        <div className="project-detail__lightbox-stage">
          {selectedPreview && <img className="project-detail__lightbox-image" src={selectedPreview.src} alt={selectedPreview.alt[locale]} />}
        </div>
        <div className="project-detail__lightbox-controls">
          <button className="project-detail__lightbox-arrow" type="button" onClick={() => movePreview(-1)} aria-label={copy.previous}>
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><path d="m15 18-6-6 6-6" /></svg>
          </button>
          <div className="project-detail__lightbox-dots" role="group" aria-label={copy.previews}>
            {studioBodyArtPreviews.map((preview, index) => (
              <button
                className={selectedPreviewIndex === index ? 'project-detail__lightbox-dot project-detail__lightbox-dot--active' : 'project-detail__lightbox-dot'}
                key={preview.src}
                type="button"
                aria-label={`${copy.photo} ${index + 1}`}
                aria-pressed={selectedPreviewIndex === index}
                onClick={() => setSelectedPreviewIndex(index)}
              />
            ))}
          </div>
          <button className="project-detail__lightbox-arrow" type="button" onClick={() => movePreview(1)} aria-label={copy.next}>
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><path d="m9 18 6-6-6-6" /></svg>
          </button>
        </div>
      </dialog>
    </main>
  )
}
