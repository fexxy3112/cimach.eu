import { useEffect, useRef, useState } from 'react'
import type { PublicProjectDetail } from '../../data/projectApi'
import { useLocale } from '../../i18n/LocaleContext'
import { ArrowUpRight } from '../../components/ArrowUpRight'
import { LoadingSpinner } from '../../components/LoadingSpinner'
import { ErrorToast } from '../../components/ErrorToast'
import { AdminProjectEditor } from '../auth/AdminProjectEditor'
import { EditableText } from './EditableText'
import { useProjectEditing } from './useProjectEditing'
import './ProjectPage.scss'
import './ProjectEditing.scss'

export function ProjectPage({ project, loading, error, notFound, onProjectUpdated, preview = false }: {
  project: PublicProjectDetail | null
  loading: boolean
  error: boolean
  notFound: boolean
  onProjectUpdated: (project: PublicProjectDetail) => void
  preview?: boolean
}) {
  const locale = useLocale()
  const editing = useProjectEditing(project, locale, onProjectUpdated, preview)
  const settingsDialog = useRef<HTMLDialogElement>(null)
  const inline = editing.mode === 'inline' && editing.draft !== null
  useEffect(() => {
    if (editing.mode === 'settings') settingsDialog.current?.showModal()
    else settingsDialog.current?.close()
  }, [editing.mode])
  const dialogRef = useRef<HTMLDialogElement>(null)
  const backRef = useRef<HTMLAnchorElement>(null)
  const titleSectionRef = useRef<HTMLElement>(null)
  const [selectedPreviewIndex, setSelectedPreviewIndex] = useState<number | null>(null)
  const [isBackCompact, setIsBackCompact] = useState(false)
  const previews = project
    ? project.gallery.length ? project.gallery : project.mainImage ? [{ src: project.mainImage, alt: project.mainImageAlt || project.name }] : []
    : []

  useEffect(() => {
    const titleSection = titleSectionRef.current
    const back = backRef.current
    if (!project || !titleSection || !back) {
      setIsBackCompact(false)
      return
    }

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
  }, [project])

  if (preview && editing.accessDenied) return <main className="site-main project-detail"><p role="status">{locale === 'pl' ? 'Wymagane logowanie administratora.' : 'Administrator login required.'}</p></main>
  if (!project) {
    if (notFound) {
      const copy = locale === 'pl'
        ? { title: 'Nie znaleziono projektu.', back: 'POWRÓT DO PROJEKTÓW' }
        : { title: 'Project not found.', back: 'BACK TO SELECTED WORK' }
      return (
        <main className="site-main project-detail">
          <a className="project-detail__back" href={`/${locale}/#work`}>
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><path d="M19 12H5m0 0 7-7m-7 7 7 7" /></svg>
            <span>{copy.back}</span>
          </a>
          <section className="project-detail__hero" aria-labelledby="project-title">
            <p className="eyebrow">404</p>
            <h1 id="project-title">{copy.title}</h1>
          </section>
        </main>
      )
    }
    const message = error
      ? locale === 'pl' ? 'Nie udało się pobrać projektu.' : 'Project could not be loaded.'
      : loading ? locale === 'pl' ? 'Ładowanie projektu…' : 'Loading project…' : null
    if (!message) return null
    return <main className="site-main project-detail"><p role={error ? 'alert' : 'status'}>{message}</p></main>
  }

  const copy = locale === 'pl'
    ? { back: 'POWRÓT DO PROJEKTÓW', eyebrow: `PROJEKT / ${project.number}`, overview: 'O projekcie', previews: 'Podgląd zdjęć', technologies: 'Technologie', visit: 'Odwiedź projekt', close: 'Zamknij podgląd zdjęcia', previous: 'Poprzednie zdjęcie', next: 'Następne zdjęcie', photo: 'Zdjęcie' }
    : { back: 'BACK TO SELECTED WORK', eyebrow: `PROJECT / ${project.number}`, overview: 'Overview', previews: 'Photo previews', technologies: 'Technologies', visit: 'Visit project', close: 'Close photo preview', previous: 'Previous photo', next: 'Next photo', photo: 'Photo' }

  const selectedPreview = selectedPreviewIndex === null ? null : previews[selectedPreviewIndex]

  function openPreview(index: number) {
    setSelectedPreviewIndex(index)
    dialogRef.current?.showModal()
  }

  function movePreview(direction: -1 | 1) {
    setSelectedPreviewIndex((current) => current === null
      ? current
      : (current + direction + previews.length) % previews.length)
  }

  return (
    <main className="site-main project-detail">
      {(editing.isAdmin || editing.mode !== null) && <div className="project-edit__toolbar" aria-label={locale === 'pl' ? 'Edycja projektu' : 'Project editor'} aria-busy={editing.busy}>
        {preview && <span>{locale === 'pl' ? 'Podgląd administracyjny' : 'Admin preview'}</span>}
        <label className="project-edit__status">
          {locale === 'pl' ? 'Widoczność' : 'Visibility'}
          <select aria-label={locale === 'pl' ? 'Status projektu' : 'Project status'} value={editing.status ?? ''} disabled={editing.busy || editing.settingsBusy || editing.mode !== null || !editing.status} onChange={(event) => void editing.changeStatus(event.target.value as 'draft' | 'published')}>
            {!editing.status && <option value="">…</option>}
            <option value="draft">{locale === 'pl' ? 'Szkic' : 'Draft'}</option>
            <option value="published">{locale === 'pl' ? 'Opublikowany' : 'Published'}</option>
          </select>
          {editing.busy && <LoadingSpinner />}
        </label>
        {inline ? <>
          <span>{locale === 'pl' ? 'Edytujesz treść PL · * pole wymagane' : 'Editing EN content · * required field'}</span>
          <button type="button" disabled={editing.busy} onClick={() => void editing.save()}>{editing.busy && <LoadingSpinner />} {locale === 'pl' ? 'Zapisz' : 'Save'}</button>
          <button type="button" disabled={editing.busy} onClick={editing.cancel}>{locale === 'pl' ? 'Anuluj' : 'Cancel'}</button>
        </> : <>
          <button type="button" disabled={editing.busy || editing.settingsBusy} onClick={() => void editing.begin('inline')}>{editing.busy && <LoadingSpinner />} {locale === 'pl' ? 'Edytuj na stronie' : 'Edit on page'}</button>
          <button type="button" disabled={editing.busy || editing.settingsBusy} onClick={() => void editing.begin('settings')}>{locale === 'pl' ? 'Zdjęcia i ustawienia' : 'Images and settings'}</button>
        </>}
        {editing.saved && !inline && <span role="status">{locale === 'pl' ? 'Zapisano zmiany.' : 'Changes saved.'}</span>}
      </div>}
      <ErrorToast message={editing.error} onDismiss={editing.clearError} action={editing.sessionExpired ? { href: `/${locale}/login/`, label: locale === 'pl' ? 'Zaloguj się w nowej karcie' : 'Sign in in a new tab' } : undefined} />
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
        <h1 id="project-title">{inline && editing.draft ? <EditableText required value={editing.draft.title} label={locale === 'pl' ? 'Tytuł projektu' : 'Project title'} disabled={editing.busy} onChange={(title) => editing.setDraft((draft) => draft && { ...draft, title })} /> : project.name}<em>.</em></h1>
        <p className="project-detail__category">{inline && editing.draft ? <EditableText required value={editing.draft.category} label={locale === 'pl' ? 'Kategoria' : 'Category'} disabled={editing.busy} onChange={(category) => editing.setDraft((draft) => draft && { ...draft, category })} /> : project.category}</p>
      </section>
      <section className="project-detail__overview" aria-labelledby="project-overview-title">
        <h2 id="project-overview-title" className="eyebrow">{copy.overview}</h2>
        <p>{inline && editing.draft ? <EditableText required value={editing.draft.description} label={copy.overview} multiline disabled={editing.busy} onChange={(description) => editing.setDraft((draft) => draft && { ...draft, description })} /> : project.description}</p>
      </section>
      {previews.length > 0 && <section className="project-detail__gallery" aria-labelledby="project-gallery-title">
        <h2 id="project-gallery-title" className="eyebrow">{copy.previews}</h2>
        <div className="project-detail__gallery-grid">
          {previews.map((preview, index) => (
            <button
              className="project-detail__preview"
              type="button"
              key={preview.src}
              onClick={() => openPreview(index)}
              aria-label={`${copy.previews} ${index + 1}`}
            >
              <img className="nodrag" src={preview.src} alt={preview.alt} loading="lazy" decoding="async" draggable={false} />
            </button>
          ))}
        </div>
      </section>}
      <section className="project-detail__bottom" aria-label={copy.technologies}>
        <div>
          <h2 className="eyebrow">{copy.technologies}</h2>
          <div className="tags">
            {inline && editing.draft ? <>
              {editing.draft.technologies.map((technology, index) => <span key={index}>
                <EditableText value={technology} label={`${copy.technologies} ${index + 1}`} disabled={editing.busy} onChange={(value) => editing.setDraft((draft) => draft && { ...draft, technologies: draft.technologies.map((item, position) => position === index ? value : item) })} />
                <button className="project-edit__remove" type="button" disabled={editing.busy} aria-label={`${locale === 'pl' ? 'Usuń' : 'Remove'} ${technology}`} onClick={() => editing.setDraft((draft) => draft && { ...draft, technologies: draft.technologies.filter((_, position) => position !== index) })}>×</button>
              </span>)}
              <button type="button" className="project-edit__add" disabled={editing.busy || editing.draft.technologies.length >= 30} onClick={() => editing.setDraft((draft) => draft && { ...draft, technologies: [...draft.technologies, ''] })}>{locale === 'pl' ? '+ Technologia' : '+ Technology'}</button>
            </> : project.technologies.map((technology) => <span key={technology}>{technology}</span>)}
          </div>
        </div>
        <a className="project-detail__visit" href={project.href} target="_blank" rel="noreferrer">
          {copy.visit}<ArrowUpRight />
        </a>
      </section>
      <dialog ref={settingsDialog} className="project-edit__settings" aria-label={locale === 'pl' ? 'Zdjęcia i ustawienia projektu' : 'Project images and settings'} onCancel={(event) => event.preventDefault()}>
        {editing.mode === 'settings' && editing.projectId && <AdminProjectEditor
          projectId={editing.projectId}
          onCancel={editing.closeSettings}
          onSaved={() => void editing.settingsSaved()}
          onBusyChange={editing.setSettingsBusy}
        />}
      </dialog>
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
          {selectedPreview && <img className="project-detail__lightbox-image" src={selectedPreview.src} alt={selectedPreview.alt} />}
        </div>
        <div className="project-detail__lightbox-controls">
          <button className="project-detail__lightbox-arrow" type="button" onClick={() => movePreview(-1)} aria-label={copy.previous}>
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><path d="m15 18-6-6 6-6" /></svg>
          </button>
          <div className="project-detail__lightbox-dots" role="group" aria-label={copy.previews}>
            {previews.map((preview, index) => (
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
