import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useLocale } from '../../i18n/LocaleContext'
import { LoadingSpinner } from '../../components/LoadingSpinner'
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
type GalleryImage = { src: string; altPl: string; altEn: string }
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
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [uploadingTarget, setUploadingTarget] = useState<string | null>(null)
  const [isCleaning, setIsCleaning] = useState(false)
  const operation = useRef(false)
  const mounted = useRef(true)
  const pendingUploads = useRef(new Set<string>())
  const busy = isSaving || uploadingTarget !== null || isCleaning

  useEffect(() => { onBusyChange?.(busy) }, [busy, onBusyChange])

  async function discardUploads(urls: string[], keepalive = false) {
    if (urls.length === 0) return
    for (let offset = 0; offset < urls.length; offset += 51) {
      const batch = urls.slice(offset, offset + 51)
      const response = await fetch(`${apiBase}/admin/uploads/discard`, {
        method: 'POST', credentials: 'include', keepalive,
        headers: { 'Content-Type': 'application/json', 'X-CIMACH-CSRF': '1' },
        body: JSON.stringify({ urls: batch }),
      })
      if (!response.ok) throw new Error('upload_cleanup_failed')
      batch.forEach((url) => pendingUploads.current.delete(url))
    }
  }

  useEffect(() => {
    mounted.current = true
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      if (!operation.current && pendingUploads.current.size === 0) return
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
    void discardUploads(unused).catch(() => {
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
    } catch {
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
        slug: 'Slug', externalUrl: 'Link zewnętrzny', mainImage: 'Zdjęcie główne (URL)',
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
        slug: 'Slug', externalUrl: 'External link', mainImage: 'Main image (URL)',
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
          gallery: result.project.gallery || [],
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

  function updateImage(index: number, key: keyof GalleryImage, value: string) {
    setProject((current) => current ? {
      ...current,
      gallery: current.gallery.map((image, imageIndex) => imageIndex === index ? { ...image, [key]: value } : image),
    } : current)
  }

  async function uploadImage(file: File, target: string, onUploaded: (url: string) => void) {
    if (operation.current) return
    operation.current = true
    setUploadingTarget(target)
    setError('')
    const form = new FormData()
    form.append('image', file)
    try {
      const response = await fetch(`${apiBase}/admin/uploads`, {
        method: 'POST', credentials: 'include', headers: { 'X-CIMACH-CSRF': '1' }, body: form,
      })
      if (response.status === 401 || response.status === 403) {
        window.location.replace(`/${locale}/login/?expired=1`)
        return
      }
      if (!response.ok) throw new Error('upload_error')
      const result = await response.json() as { url: string }
      pendingUploads.current.add(result.url)
      if (!mounted.current) {
        await discardUploads([result.url], true)
        return
      }
      onUploaded(result.url)
    } catch {
      setError(locale === 'pl' ? 'Nie udało się przesłać obrazu. Użyj JPG, PNG lub WebP do 10 MB.' : 'Could not upload image. Use JPG, PNG or WebP up to 10 MB.')
    } finally {
      operation.current = false
      setUploadingTarget(null)
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!project || operation.current) return
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
      gallery: project.gallery,
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
      if (response.status === 401 || response.status === 403) {
        window.location.replace(`/${locale}/login/?expired=1`)
        return
      }
      if (response.status === 409) throw new Error('slug_conflict')
      if (response.status === 422) {
        const result = await response.json() as { error?: string }
        throw new Error(result.error === 'invalid_upload' ? 'invalid_upload' : 'invalid_project')
      }
      if (!response.ok) throw new Error('save_error')
      // A referenced image is protected by the server, including after a lost save response.
      await discardUploads([...pendingUploads.current]).catch(() => {})
      pendingUploads.current.clear()
      onSaved()
    } catch (cause) {
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
    <form className="admin-project-editor" aria-busy={busy} onSubmit={submit} onInvalidCapture={(event) => { event.preventDefault(); setError(copy.invalid) }}>
      <fieldset className="admin-project-editor__controls" aria-label={isCreate ? copy.createTitle : copy.title} disabled={busy}>
      <div className="admin-project-editor__heading">
        <h2 className="eyebrow">{isCreate ? copy.createTitle : copy.title}</h2>
        <button className="admin-project-editor__button admin-project-editor__button--quiet" type="button" onClick={() => void cancel()}>{isCleaning && <LoadingSpinner />} {copy.cancel}</button>
      </div>
      {error && <p className="admin-project-editor__error" role="alert">{error}</p>}
      <div className="admin-project-editor__grid admin-project-editor__grid--meta">
        <label><span>{copy.slug}</span><input required maxLength={160} value={project.slug} onChange={(event) => updateProject('slug', event.target.value)} /></label>
        <label><span>{copy.externalUrl}</span><input required type="url" value={project.projectUrl} onChange={(event) => updateProject('projectUrl', event.target.value)} /></label>
        <label><span>{copy.mainImage}</span><input type="text" value={project.mainImageUrl} onChange={(event) => updateProject('mainImageUrl', event.target.value)} /></label>
        <label><span>{locale === 'pl' ? 'Upload obrazu' : 'Upload image'}</span><input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploadingTarget !== null} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadImage(file, 'main', (url) => updateProject('mainImageUrl', url)); event.currentTarget.value = '' }} /></label>
        <label><span>{locale === 'pl' ? 'Alt zdjęcia głównego PL' : 'Main image alt PL'}</span><input maxLength={512} value={project.mainImageAltPl} onChange={(event) => updateProject('mainImageAltPl', event.target.value)} /></label>
        <label><span>{locale === 'pl' ? 'Alt zdjęcia głównego EN' : 'Main image alt EN'}</span><input maxLength={512} value={project.mainImageAltEn} onChange={(event) => updateProject('mainImageAltEn', event.target.value)} /></label>
        <label><span>{copy.status}</span>
          <select value={project.status} onChange={(event) => updateProject('status', event.target.value as ProjectDraft['status'])}>
            <option value="draft">{copy.draft}</option><option value="published">{copy.published}</option>
          </select>
        </label>
        {!isCreate && <label><span>{copy.order}</span><input type="number" min="0" max="1000000" required value={project.sortOrder} onChange={(event) => updateProject('sortOrder', Number(event.target.value))} /></label>}
      </div>
      {uploadingTarget === 'main' && <p className="admin-project-editor__hint" role="status"><LoadingSpinner /> {locale === 'pl' ? 'Przesyłanie i optymalizacja obrazu…' : 'Uploading and optimizing image…'}</p>}
      <div className="admin-project-editor__translations">
        {(['pl', 'en'] as const).map((language) => (
          <fieldset key={language}>
            <legend>{copy.translations[language]}</legend>
            <label><span>{copy.titleLabel}</span><input required maxLength={255} value={project.translations[language].title} onChange={(event) => updateTranslation('title', event.target.value, language)} /></label>
            <label><span>{copy.category}</span><input required maxLength={255} value={project.translations[language].category} onChange={(event) => updateTranslation('category', event.target.value, language)} /></label>
            <label><span>{copy.description}</span><textarea required rows={4} value={project.translations[language].description} onChange={(event) => updateTranslation('description', event.target.value, language)} /></label>
            <label><span>{copy.seoTitle}</span><input maxLength={255} value={project.translations[language].seoTitle || ''} onChange={(event) => updateTranslation('seoTitle', event.target.value, language)} /></label>
            <label><span>{copy.seoDescription}</span><textarea rows={3} value={project.translations[language].seoDescription || ''} onChange={(event) => updateTranslation('seoDescription', event.target.value, language)} /></label>
            <label><span>{copy.technologies}</span><textarea rows={4} value={project.translations[language].technologies.join('\n')} onChange={(event) => updateTranslation('technologies', event.target.value.split('\n'), language)} /></label>
          </fieldset>
        ))}
      </div>
      <section className="admin-project-editor__gallery" aria-labelledby="admin-project-gallery-title">
        <h3 id="admin-project-gallery-title" className="eyebrow">{copy.gallery}</h3>
        {project.gallery.map((image, index) => (
          <fieldset key={`${index}-${image.src}`}>
            <legend>{String(index + 1).padStart(2, '0')}</legend>
            <label><span>{copy.imageUrl}</span><input required type="text" value={image.src} onChange={(event) => updateImage(index, 'src', event.target.value)} /></label>
            <label><span>{locale === 'pl' ? 'Upload obrazu' : 'Upload image'}</span><input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploadingTarget !== null} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadImage(file, `gallery-${index}`, (url) => updateImage(index, 'src', url)); event.currentTarget.value = '' }} /></label>
            <label><span>{copy.altPl}</span><input required maxLength={512} value={image.altPl} onChange={(event) => updateImage(index, 'altPl', event.target.value)} /></label>
            <label><span>{copy.altEn}</span><input required maxLength={512} value={image.altEn} onChange={(event) => updateImage(index, 'altEn', event.target.value)} /></label>
            <button className="admin-project-editor__button admin-project-editor__button--quiet" type="button" onClick={() => updateProject('gallery', project.gallery.filter((_, imageIndex) => imageIndex !== index))}>{copy.removeImage}</button>
          </fieldset>
        ))}
        {uploadingTarget?.startsWith('gallery-') && <p className="admin-project-editor__hint" role="status"><LoadingSpinner /> {locale === 'pl' ? 'Przesyłanie i optymalizacja obrazu…' : 'Uploading and optimizing image…'}</p>}
        <button className="admin-project-editor__button admin-project-editor__button--quiet" type="button" onClick={() => updateProject('gallery', [...project.gallery, { src: '', altPl: '', altEn: '' }])}>{copy.addImage}</button>
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
