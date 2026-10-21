import { useEffect, useRef, useState } from 'react'
import { LoadingSpinner } from '../../components/LoadingSpinner'
import { RequiredMark } from '../../components/RequiredMark'
import { useLocale } from '../../i18n/LocaleContext'
import './ProjectImageField.scss'

type ImageValue = { src: string; altPl: string; altEn: string }

export function ProjectImageField({ title, image, onChange, onUpload, onRemove, disabled, uploading, requireAlt = false }: {
  title: string
  image: ImageValue
  onChange: (image: ImageValue) => void
  onUpload: (file: File) => Promise<void>
  onRemove?: () => void
  disabled: boolean
  uploading: boolean
  requireAlt?: boolean
}) {
  const locale = useLocale()
  const fileInput = useRef<HTMLInputElement>(null)
  const [localPreview, setLocalPreview] = useState<string | null>(null)
  const [failedSource, setFailedSource] = useState<string | null>(null)
  const [urlOpen, setUrlOpen] = useState(!image.src && requireAlt)
  const source = localPreview || image.src
  useEffect(() => () => { if (localPreview) URL.revokeObjectURL(localPreview) }, [localPreview])

  async function selectFile(file: File) {
    setLocalPreview(URL.createObjectURL(file))
    try { await onUpload(file) } finally { setLocalPreview(null) }
  }

  return <fieldset className="project-image-field" disabled={disabled} aria-busy={uploading}>
    <legend>{title}{requireAlt && <RequiredMark />}</legend>
    <div className="project-image-field__visual">
      {source && source !== failedSource
        ? <img src={source} alt={locale === 'pl' ? image.altPl : image.altEn} draggable={false} onError={() => setFailedSource(source)} />
        : <p>{source
          ? locale === 'pl' ? 'Nie udało się wczytać podglądu.' : 'Preview could not be loaded.'
          : locale === 'pl' ? 'Wybierz zdjęcie, aby zobaczyć podgląd.' : 'Choose an image to see its preview.'}</p>}
      {uploading && <span className="project-image-field__progress" role="status"><LoadingSpinner /> {locale === 'pl' ? 'Przesyłanie i optymalizacja…' : 'Uploading and optimizing…'}</span>}
    </div>
    <div className="project-image-field__actions">
      <input ref={fileInput} type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={(event) => {
        const file = event.target.files?.[0]
        if (file) void selectFile(file)
        event.currentTarget.value = ''
      }} />
      <button type="button" className="admin-project-editor__button" onClick={() => fileInput.current?.click()} disabled={disabled}>
        {uploading && <LoadingSpinner />} {image.src ? locale === 'pl' ? 'Zmień zdjęcie' : 'Replace image' : locale === 'pl' ? 'Wybierz zdjęcie' : 'Choose image'}
      </button>
      {onRemove && <button type="button" className="admin-project-editor__button admin-project-editor__button--quiet" disabled={disabled} onClick={onRemove}>{locale === 'pl' ? 'Usuń' : 'Remove'}</button>}
    </div>
    <p className="project-image-field__hint">JPG, PNG, WebP · {locale === 'pl' ? 'do 10 MB. Zdjęcie zostanie automatycznie zoptymalizowane.' : 'up to 10 MB. Images are optimized automatically.'}</p>
    <div className="project-image-field__alts">
      <label><span>{locale === 'pl' ? 'Opis zdjęcia po polsku (alt)' : 'Image description in Polish (alt)'}{requireAlt && <RequiredMark />}</span><input required={requireAlt} maxLength={512} value={image.altPl} onChange={(event) => onChange({ ...image, altPl: event.target.value })} /></label>
      <label><span>{locale === 'pl' ? 'Opis zdjęcia po angielsku (alt)' : 'Image description in English (alt)'}{requireAlt && <RequiredMark />}</span><input required={requireAlt} maxLength={512} value={image.altEn} onChange={(event) => onChange({ ...image, altEn: event.target.value })} /></label>
    </div>
    <details className="project-image-field__advanced" open={urlOpen} onToggle={(event) => setUrlOpen(event.currentTarget.open)}>
      <summary>{locale === 'pl' ? 'Użyj adresu istniejącego zdjęcia' : 'Use an existing image URL'}</summary>
      <label><span>{locale === 'pl' ? 'Adres zdjęcia' : 'Image URL'}{requireAlt && <RequiredMark />}</span><input type="text" required={requireAlt} maxLength={2048} value={image.src} onChange={(event) => onChange({ ...image, src: event.target.value })} /></label>
    </details>
  </fieldset>
}
