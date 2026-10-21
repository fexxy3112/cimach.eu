import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useLocale } from '../../i18n/LocaleContext'
import { LoadingSpinner } from '../../components/LoadingSpinner'
import { ErrorToast } from '../../components/ErrorToast'
import { RequiredMark } from '../../components/RequiredMark'
import { ProjectImageField } from './ProjectImageField'
import { SortableProjectGallery, type GalleryImage } from './SortableProjectGallery'
import './AdminProjectEditor.scss'

const apiBase = import.meta.env.VITE_API_BASE_URL || '/api'

type Locale = 'pl' | 'en'
type Translation = {
  title: string
  category: string
  description: string
  seoTitle: string | null
  seoDescription: string | null
  technologies: string[]
}
type ProjectDraft = {
  id: string
  slug: string
  projectUrl: string
  mainImageUrl: string
  mainImageAltPl: string
  mainImageAltEn: string
  status: 'draft' | 'published'
  sortOrder: number
  translations: Record<Locale, Translation>
  gallery: GalleryImage[]
}

const emptyTranslation = (): Translation => ({ title: '', category: '', description: '', seoTitle: '', seoDescription: '', technologies: [] })
const emptyProject = (sortOrder: number): ProjectDraft => ({
  id: '', slug: '', projectUrl: '', mainImageUrl: '', mainImageAltPl: '', mainImageAltEn: '', status: 'draft', sortOrder,
  translations: { pl: emptyTranslation(), en: emptyTranslation() },
  gallery: [],
})

export function AdminProjectEditor({ projectId, initialSortOrder = 0, onCancel, onSaved, onBusyChange }: {
  projectId: string | null
  initialSortOrder?: number
  onCancel: () => void
  onSaved: () => void
  onBusyChange?: (busy: boolean) => void
}) {
  const locale = useLocale()
  const isCreate = projectId === null
  const [project, setProject] = useState<ProjectDraft | null>(null)
  const [error, setError] = useState('')
  const [sessionExpired, setSessionExpired] = useState(false)
  const saveCompleted = useRef(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [uploadingTarget, setUploadingTarget] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null)
  const [isCleaning, setIsCleaning] = useState(false)
  const [validationAttempted, setValidationAttempted] = useState(false)
  const [galleryDragging, setGalleryDragging] = useState(false)
  const galleryOrderChanged = useRef(false)
  const operation = useRef(false)
  const mounted = useRef(true)
  const pendingUploads = useRef(new Set<string>())
  const galleryFileInput = useRef<HTMLInputElement>(null)
  const requestBusy = isSaving || uploadingTarget !== null || isCleaning
  const busy = requestBusy || galleryDragging

  useEffect(() => { onBusyChange?.(busy) }, [busy, onBusyChange])

  function checkSession(response: Response) {
    if (response.status === 401) {
      setSessionExpired(true)
      setError(locale === 'pl' ? 'Sesja wygasła. Zmiany pozostają w otwartym formularzu. Zaloguj się w nowej karcie, wróć tutaj i ponów operację.' : 'Your session expired. Your changes remain in this open form. Sign in in a new tab, return here and try again.')
      throw new Error('session_expired')
    }
    setSessionExpired(false)
    if (response.status === 403) {
      setError(locale === 'pl' ? 'Serwer odmówił dostępu. Sprawdź uprawnienia administratora. Zmiany pozostają w formularzu.' : 'Access was denied. Check your administrator permissions. Your changes remain in the form.')
      throw new Error('permission_denied')
    }
  }

  function isSessionError(cause: unknown) {
    return cause instanceof Error && ['session_expired', 'permission_denied'].includes(cause.message)
  }

  async function discardUploads(urls: string[], keepalive = false) {
    if (urls.length === 0) return
    for (let offset = 0; offset < urls.length; offset += 51) {
      const batch = urls.slice(offset, offset + 51)
      const response = await fetch(`${apiBase}/admin/uploads/discard`, {
        method: 'POST', credentials: 'include', keepalive,
        headers: { 'Content-Type': 'application/json', 'X-CIMACH-CSRF': '1' },
        body: JSON.stringify({ urls: batch }),
      })
      checkSession(response)
      if (!response.ok) throw new Error('upload_cleanup_failed')
      batch.forEach((url) => pendingUploads.current.delete(url))
    }
  }

  useEffect(() => {
    mounted.current = true
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      if (saveCompleted.current) return
      if (!operation.current && pendingUploads.current.size === 0 && !galleryOrderChanged.current) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warnBeforeLeaving)
    return () => {
      mounted.current = false
      window.removeEventListener('beforeunload', warnBeforeLeaving)
      onBusyChange?.(false)
      // Best effort only; server-side expiry handles closed tabs and lost connections.
      void discardUploads([...pendingUploads.current], true).catch(() => {})
    }
  }, [onBusyChange])

  useEffect(() => {
    if (!project || operation.current) return
    const imageKey = (value: string) => {
      try {
        const url = new URL(value, window.location.origin)
        return url.origin === window.location.origin && url.pathname.startsWith('/api/uploads/')
          ? decodeURIComponent(url.pathname)
          : value
      } catch { return value }
    }
    const used = new Set([project.mainImageUrl, ...project.gallery.map((image) => image.src)].map(imageKey))
    const unused = [...pendingUploads.current].filter((url) => !used.has(imageKey(url)))
    if (!unused.length) return
    operation.current = true
    setIsCleaning(true)
    void discardUploads(unused).catch((cause: unknown) => {
      if (isSessionError(cause)) return
      setError(locale === 'pl' ? 'Nie udało się usunąć nieużywanego uploadu. Ponowimy sprzątanie przy anulowaniu lub zapisie.' : 'Could not remove the unused upload. Cleanup will retry when cancelling or saving.')
    }).finally(() => {
      operation.current = false
      if (mounted.current) setIsCleaning(false)
    })
  }, [project, locale])

  async function cancel() {
    if (operation.current) return
    operation.current = true
    setIsCleaning(true)
    setError('')
    try {
      await discardUploads([...pendingUploads.current])
      onCancel()
    } catch (cause) {
      if (isSessionError(cause)) return
      setError(locale === 'pl' ? 'Nie udało się posprzątać uploadów. Spróbuj anulować ponownie.' : 'Could not clean up uploads. Please try cancelling again.')
    } finally {
      operation.current = false
      if (mounted.current) setIsCleaning(false)
    }
  }
  const copy = locale === 'pl'
    ? {
        title: 'Edytuj projekt', createTitle: 'Nowy projekt', loading: 'Wczytuję projekt…', loadError: 'Nie udało się wczytać projektu.',
        saveError: 'Nie udało się zapisać zmian.', slugConflict: 'Ten slug jest już używany.',
        invalid: 'Uzupełnij wymagane pola i sprawdź adresy URL.', notFound: 'Projekt nie istnieje.',
        slug: 'Slug', externalUrl: 'Link zewnętrzny', mainImage: 'Zdjęcie główne',
        status: 'Status publikacji', draft: 'Szkic', published: 'Opublikowany', order: 'Kolejność',
        translations: { pl: 'Treść polska', en: 'Treść angielska' }, titleLabel: 'Tytuł', category: 'Kategoria',
        description: 'Opis', seoTitle: 'Tytuł SEO', seoDescription: 'Opis SEO', technologies: 'Technologie (po jednej w wierszu)',
        gallery: 'Galeria zdjęć', imageUrl: 'Adres zdjęcia', altPl: 'Tekst alternatywny PL', altEn: 'Tekst alternatywny EN',
        addImage: 'Dodaj zdjęcie', removeImage: 'Usuń zdjęcie', save: 'Zapisz zmiany', create: 'Utwórz projekt', saving: 'Zapisywanie…', creating: 'Tworzenie…', cancel: 'Anuluj',
        projectUnavailable: 'Zdjęcia można wskazać przez URL. Upload plików nie jest jeszcze dostępny.',
      }
    : {
        title: 'Edit project', createTitle: 'New project', loading: 'Loading project…', loadError: 'Could not load the project.',
        saveError: 'Could not save changes.', slugConflict: 'This slug is already in use.',
        invalid: 'Complete required fields and check the URLs.', notFound: 'Project not found.',
        slug: 'Slug', externalUrl: 'External link', mainImage: 'Main image',
        status: 'Publication status', draft: 'Draft', published: 'Published', order: 'Order',
        translations: { pl: 'Polish content', en: 'English content' }, titleLabel: 'Title', category: 'Category',
        description: 'Description', seoTitle: 'SEO title', seoDescription: 'SEO description', technologies: 'Technologies (one per line)',
        gallery: 'Photo gallery', imageUrl: 'Image URL', altPl: 'Alt text PL', altEn: 'Alt text EN',
        addImage: 'Add image', removeImage: 'Remove image', save: 'Save changes', create: 'Create project', saving: 'Saving…', creating: 'Creating…', cancel: 'Cancel',
        projectUnavailable: 'Images can be referenced by URL. File uploads are not available yet.',
      }

  useEffect(() => {
    if (isCreate) {
      setProject(emptyProject(initialSortOrder))
      setIsLoading(false)
      return
    }
    let cancelled = false
    fetch(`${apiBase}/admin/projects/${encodeURIComponent(projectId)}`, { credentials: 'include', cache: 'no-store' })
      .then(async (response) => {
        if (response.status === 401 || response.status === 403) {
          window.location.replace(`/${locale}/login/?expired=1`)
          return null
        }
        if (response.status === 404) throw new Error('project_not_found')
        if (!response.ok) throw new Error('project_load_error')
        return response.json() as Promise<{ project: Omit<ProjectDraft, 'translations'> & { translations: Partial<Record<Locale, Translation | null>> } }>
      })
      .then((result) => {
        if (!result || cancelled) return
        setProject({
          ...result.project,
          mainImageUrl: result.project.mainImageUrl || '',
          mainImageAltPl: result.project.mainImageAltPl || '',
          mainImageAltEn: result.project.mainImageAltEn || '',
          translations: {
            pl: result.project.translations.pl || emptyTranslation(),
            en: result.project.translations.en || emptyTranslation(),
          },
          gallery: (result.project.gallery || []).map((image) => ({ ...image, clientId: crypto.randomUUID() })),
        })
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error && cause.message === 'project_not_found' ? copy.notFound : copy.loadError)
      })
      .finally(() => { if (!cancelled) setIsLoading(false) })
    return () => { cancelled = true }
  }, [projectId, initialSortOrder, isCreate, locale, copy.loadError, copy.notFound])

  function updateProject<K extends keyof ProjectDraft>(key: K, value: ProjectDraft[K]) {
    setProject((current) => current ? { ...current, [key]: value } : current)
  }

  function updateTranslation<K extends keyof Translation>(key: K, value: Translation[K], language: Locale) {
    setProject((current) => current ? {
      ...current,
      translations: { ...current.translations, [language]: { ...current.translations[language], [key]: value } },
    } : current)
  }

  async function uploadFile(file: File): Promise<string | null> {
    const form = new FormData()
    form.append('image', file)
    const response = await fetch(`${apiBase}/admin/uploads`, {
      method: 'POST', credentials: 'include', headers: { 'X-CIMACH-CSRF': '1' }, body: form,
    })
    checkSession(response)
    if (!response.ok) throw new Error('upload_error')
    const result = await response.json() as { url: string }
    pendingUploads.current.add(result.url)
    if (!mounted.current) {
      await discardUploads([result.url], true)
      return null
    }
    return result.url
  }

  async function uploadImage(file: File, target: string, onUploaded: (url: string) => void) {
    if (operation.current) return
    operation.current = true
    setUploadingTarget(target)
    setError('')
    try {
      const url = await uploadFile(file)
      if (url) onUploaded(url)
    } catch (cause) {
      if (!mounted.current || isSessionError(cause)) return
      setError(locale === 'pl' ? 'Nie udało się przesłać obrazu. Użyj JPG, PNG lub WebP do 10 MB.' : 'Could not upload image. Use JPG, PNG or WebP up to 10 MB.')
    } finally {
      operation.current = false
      if (mounted.current) setUploadingTarget(null)
    }
  }

  async function uploadGallery(files: File[]) {
    if (!project || operation.current || files.length === 0) return
    const remaining = 50 - project.gallery.length
    if (files.length > remaining) {
      setError(locale === 'pl' ? `Galeria mieści maksymalnie 50 zdjęć. Możesz dodać jeszcze ${remaining}.` : `The gallery supports up to 50 images. You can add ${remaining} more.`)
      return
    }
    operation.current = true
    setUploadingTarget('gallery-batch')
    setError('')
    const failed: string[] = []
    let uploaded = 0
    try {
      for (const [index, file] of files.entries()) {
        if (!mounted.current) return
        setUploadProgress({ current: index + 1, total: files.length })
        try {
          const url = await uploadFile(file)
          if (!url) return
          const image = { clientId: crypto.randomUUID(), src: url, altPl: '', altEn: '' }
          setProject((current) => current && { ...current, gallery: [...current.gallery, image] })
          uploaded++
        } catch (cause) {
          if (!mounted.current || isSessionError(cause)) return
          failed.push(file.name)
        }
      }
      if (failed.length) {
        const names = failed.slice(0, 3).map((name) => name.slice(0, 80)).join(', ')
        setError(locale === 'pl'
          ? `Dodano ${uploaded} z ${files.length} zdjęć. Błędy: ${names}${failed.length > 3 ? ` (+${failed.length - 3})` : ''}. Użyj JPG, PNG lub WebP do 10 MB na plik.`
          : `Added ${uploaded} of ${files.length} images. Failed: ${names}${failed.length > 3 ? ` (+${failed.length - 3})` : ''}. Use JPG, PNG or WebP up to 10 MB per file.`)
      }
    } finally {
      operation.current = false
      if (mounted.current) { setUploadingTarget(null); setUploadProgress(null) }
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!project || operation.current) return
    if (project.gallery.some((image) => !image.src.trim())) {
      setError(locale === 'pl' ? 'Wybierz zdjęcie dla każdej pozycji galerii lub usuń puste pozycje.' : 'Choose an image for each gallery entry or remove empty entries.')
      return
    }
    operation.current = true
    setIsSaving(true)
    setError('')
    const payload = {
      slug: project.slug,
      projectUrl: project.projectUrl,
      mainImageUrl: project.mainImageUrl || null,
      mainImageAltPl: project.mainImageAltPl,
      mainImageAltEn: project.mainImageAltEn,
      status: project.status,
      ...(!isCreate ? { sortOrder: Number(project.sortOrder) } : {}),
      translations: Object.fromEntries((['pl', 'en'] as const).map((language) => [language, {
        ...project.translations[language],
        seoTitle: project.translations[language].seoTitle || null,
        seoDescription: project.translations[language].seoDescription || null,
        technologies: project.translations[language].technologies.map((technology) => technology.trim()).filter(Boolean),
      }])),
      gallery: project.gallery.map(({ src, altPl, altEn }) => ({ src, altPl, altEn })),
    }
    try {
      const endpoint = isCreate
        ? `${apiBase}/admin/projects`
        : `${apiBase}/admin/projects/${encodeURIComponent(project.id)}`
      const response = await fetch(endpoint, {
        method: isCreate ? 'POST' : 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CIMACH-CSRF': '1' },
        body: JSON.stringify(payload),
      })
      checkSession(response)
      if (response.status === 409) throw new Error('slug_conflict')
      if (response.status === 422) {
        const result = await response.json() as { error?: string }
        throw new Error(result.error === 'invalid_upload' ? 'invalid_upload' : 'invalid_project')
      }
      if (!response.ok) throw new Error('save_error')
      saveCompleted.current = true
      // A referenced image is protected by the server, including after a lost save response.
      await discardUploads([...pendingUploads.current]).catch(() => {})
      pendingUploads.current.clear()
      galleryOrderChanged.current = false
      onSaved()
    } catch (cause) {
      if (isSessionError(cause)) return
      const key = cause instanceof Error ? cause.message : ''
      setError(key === 'invalid_upload'
        ? locale === 'pl' ? 'Upload wygasł lub zdjęcie jest niedostępne. Prześlij je ponownie.' : 'The upload expired or the image is unavailable. Please upload it again.'
        : key === 'slug_conflict' ? copy.slugConflict : key === 'invalid_project' ? copy.invalid : copy.saveError)
      setIsSaving(false)
    } finally {
      operation.current = false
      if (mounted.current) setIsSaving(false)
    }
  }

  if (isLoading) return <p className="admin-page__message" role="status"><LoadingSpinner /> {copy.loading}</p>
  if (error && !project) return <p className="admin-page__message" role="alert">{error}</p>
  if (!project) return null

  return (
    <form className={`admin-project-editor${validationAttempted ? ' admin-project-editor--validated' : ''}`} aria-busy={busy} onSubmit={submit} onInvalidCapture={(event) => {
      event.preventDefault()
      setValidationAttempted(true)
      setError(copy.invalid)
      const first = event.currentTarget.querySelector<HTMLElement>('input:invalid, textarea:invalid, select:invalid')
      const details = first?.closest('details')
      if (details) details.open = true
      first?.focus()
    }}>
      <ErrorToast message={error} onDismiss={() => setError('')} action={sessionExpired ? { href: `/${locale}/login/`, label: locale === 'pl' ? 'Zaloguj się w nowej karcie' : 'Sign in in a new tab' } : undefined} />
      <fieldset className="admin-project-editor__controls" aria-label={isCreate ? copy.createTitle : copy.title} disabled={requestBusy}>
      <div className="admin-project-editor__heading">
        <h2 className="eyebrow">{isCreate ? copy.createTitle : copy.title}</h2>
        <button className="admin-project-editor__button admin-project-editor__button--quiet" type="button" onClick={() => void cancel()}>{isCleaning && <LoadingSpinner />} {copy.cancel}</button>
      </div>
      <p className="admin-project-editor__hint"><RequiredMark /> {locale === 'pl' ? 'Pola wymagane' : 'Required fields'}</p>
      <div className="admin-project-editor__grid admin-project-editor__grid--meta">
        <label><span>{copy.slug}<RequiredMark /></span><input required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={160} value={project.slug} onChange={(event) => updateProject('slug', event.target.value)} /></label>
        <label><span>{copy.externalUrl}<RequiredMark /></span><input required type="url" value={project.projectUrl} onChange={(event) => updateProject('projectUrl', event.target.value)} /></label>
        <label><span>{copy.status}<RequiredMark /></span>
          <select required value={project.status} onChange={(event) => updateProject('status', event.target.value as ProjectDraft['status'])}>
            <option value="draft">{copy.draft}</option><option value="published">{copy.published}</option>
          </select>
        </label>
        {!isCreate && <label><span>{copy.order}<RequiredMark /></span><input type="number" min="0" max="1000000" required value={project.sortOrder} onChange={(event) => updateProject('sortOrder', Number(event.target.value))} /></label>}
      </div>
      <section className="admin-project-editor__main-image" aria-label={copy.mainImage}>
        <ProjectImageField title={copy.mainImage}
          image={{ src: project.mainImageUrl, altPl: project.mainImageAltPl, altEn: project.mainImageAltEn }}
          disabled={busy} uploading={uploadingTarget === 'main'}
          onChange={(image) => setProject((current) => current && { ...current, mainImageUrl: image.src, mainImageAltPl: image.altPl, mainImageAltEn: image.altEn })}
          onUpload={(file) => uploadImage(file, 'main', (url) => updateProject('mainImageUrl', url))}
          onRemove={project.mainImageUrl ? () => setProject((current) => current && { ...current, mainImageUrl: '', mainImageAltPl: '', mainImageAltEn: '' }) : undefined}
        />
      </section>
      <div className="admin-project-editor__translations">
        {(['pl', 'en'] as const).map((language) => (
          <fieldset key={language}>
            <legend>{copy.translations[language]}</legend>
            <label><span>{copy.titleLabel}<RequiredMark /></span><input required maxLength={255} value={project.translations[language].title} onChange={(event) => updateTranslation('title', event.target.value, language)} /></label>
            <label><span>{copy.category}<RequiredMark /></span><input required maxLength={255} value={project.translations[language].category} onChange={(event) => updateTranslation('category', event.target.value, language)} /></label>
            <label><span>{copy.description}<RequiredMark /></span><textarea required rows={4} maxLength={20000} value={project.translations[language].description} onChange={(event) => updateTranslation('description', event.target.value, language)} /></label>
            <label><span>{copy.seoTitle}</span><input maxLength={255} value={project.translations[language].seoTitle || ''} onChange={(event) => updateTranslation('seoTitle', event.target.value, language)} /></label>
            <label><span>{copy.seoDescription}</span><textarea rows={3} value={project.translations[language].seoDescription || ''} onChange={(event) => updateTranslation('seoDescription', event.target.value, language)} /></label>
            <label><span>{copy.technologies}</span><textarea rows={4} value={project.translations[language].technologies.join('\n')} onChange={(event) => updateTranslation('technologies', event.target.value.split('\n'), language)} /></label>
          </fieldset>
        ))}
      </div>
      <section className="admin-project-editor__gallery" aria-labelledby="admin-project-gallery-title">
        <h3 id="admin-project-gallery-title" className="eyebrow">{copy.gallery}</h3>
        <SortableProjectGallery images={project.gallery} disabled={requestBusy} uploadingTarget={uploadingTarget}
          onChange={(id, value) => setProject((current) => current && { ...current, gallery: current.gallery.map((image) => image.clientId === id ? value : image) })}
          onUpload={(id, file) => uploadImage(file, `gallery-${id}`, (url) => setProject((current) => current && { ...current, gallery: current.gallery.map((image) => image.clientId === id ? { ...image, src: url } : image) }))}
          onRemove={(id) => updateProject('gallery', project.gallery.filter((image) => image.clientId !== id))}
          onReorder={(gallery) => { galleryOrderChanged.current = true; updateProject('gallery', gallery) }}
          onDraggingChange={(dragging) => { operation.current = dragging; setGalleryDragging(dragging) }}
        />
        {uploadingTarget?.startsWith('gallery-') && <p className="admin-project-editor__hint" role="status"><LoadingSpinner /> {locale === 'pl' ? 'Przesyłanie i optymalizacja…' : 'Uploading and optimizing…'}{uploadProgress && ` ${uploadProgress.current} / ${uploadProgress.total}`}</p>}
        <input ref={galleryFileInput} type="file" hidden multiple accept="image/jpeg,image/png,image/webp" onChange={(event) => {
          const files = Array.from(event.target.files || [])
          void uploadGallery(files)
          event.currentTarget.value = ''
        }} />
        <div className="admin-project-editor__image-actions">
          <button className="admin-project-editor__button" type="button" disabled={busy || project.gallery.length >= 50} onClick={() => galleryFileInput.current?.click()}>{uploadProgress && <LoadingSpinner />} {locale === 'pl' ? 'Dodaj zdjęcia' : 'Add images'}</button>
          <button className="admin-project-editor__button admin-project-editor__button--quiet" type="button" disabled={busy || project.gallery.length >= 50} onClick={() => updateProject('gallery', [...project.gallery, { clientId: crypto.randomUUID(), src: '', altPl: '', altEn: '' }])}>{locale === 'pl' ? 'Dodaj z adresu' : 'Add from URL'}</button>
        </div>
      </section>
      <div className="admin-project-editor__actions">
        <button className="admin-page__logout" type="submit" disabled={busy}>{isSaving && <LoadingSpinner />} {isSaving ? isCreate ? copy.creating : copy.saving : isCreate ? copy.create : copy.save}</button>
        <button className="admin-project-editor__button admin-project-editor__button--quiet" type="button" onClick={() => void cancel()}>{isCleaning && <LoadingSpinner />} {copy.cancel}</button>
      </div>
      {isCleaning && <p className="admin-project-editor__hint" role="status"><LoadingSpinner /> {locale === 'pl' ? 'Usuwanie nieużywanych uploadów…' : 'Cleaning up unused uploads…'}</p>}
      </fieldset>
    </form>
  )
}
