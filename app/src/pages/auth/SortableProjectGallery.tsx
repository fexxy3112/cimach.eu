import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent, type KeyboardEvent } from 'react'
import { useLocale } from '../../i18n/LocaleContext'
import { ProjectImageField } from './ProjectImageField'
import './SortableProjectGallery.scss'

export type GalleryImage = { clientId: string; src: string; altPl: string; altEn: string }
type Drag = { id: string; pointerId: number; x: number; y: number; startX: number; startY: number }

export function SortableProjectGallery({ images, disabled, uploadingTarget, onChange, onUpload, onRemove, onReorder, onDraggingChange }: {
  images: GalleryImage[]
  disabled: boolean
  uploadingTarget: string | null
  onChange: (id: string, value: GalleryImage) => void
  onUpload: (id: string, file: File) => Promise<void>
  onRemove: (id: string) => void
  onReorder: (images: GalleryImage[]) => void
  onDraggingChange: (dragging: boolean) => void
}) {
  const locale = useLocale()
  const grid = useRef<HTMLDivElement>(null)
  const [order, setOrder] = useState(images.map((image) => image.clientId))
  const orderRef = useRef(order)
  const [activeId, setActiveId] = useState<string | null>(null)
  const drag = useRef<Drag | null>(null)
  const positions = useRef(new Map<string, DOMRect>())
  const dropping = useRef<{ id: string; bounds: DOMRect } | null>(null)
  const callbacks = useRef({ images, onReorder, onDraggingChange })
  callbacks.current = { images, onReorder, onDraggingChange }
  const [announcement, setAnnouncement] = useState('')
  const fingerprint = images.map((image) => image.clientId).join(',')

  useEffect(() => {
    if (drag.current) return
    const ids = callbacks.current.images.map((image) => image.clientId)
    orderRef.current = ids
    setOrder(ids)
  }, [fingerprint])

  function slots() { return Array.from(grid.current?.querySelectorAll<HTMLElement>('[data-gallery-slot]') ?? []) }
  function capturePositions() {
    positions.current = new Map(slots().map((slot) => [slot.dataset.gallerySlot!, slot.querySelector<HTMLElement>('[data-gallery-card]')!.getBoundingClientRect()]))
  }

  useLayoutEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    for (const slot of slots()) {
      const card = slot.querySelector<HTMLElement>('[data-gallery-card]')!
      card.getAnimations().forEach((animation) => animation.cancel())
      if (slot.dataset.gallerySlot === drag.current?.id || slot.dataset.gallerySlot === dropping.current?.id) continue
      const before = positions.current.get(slot.dataset.gallerySlot!)
      if (!before || reduced) continue
      const after = card.getBoundingClientRect()
      const x = before.left - after.left
      const y = before.top - after.top
      if (x || y) card.animate([{ transform: `translate(${x}px, ${y}px)` }, { transform: 'translate(0, 0)' }], { duration: 200, easing: 'cubic-bezier(.2,.8,.2,1)' })
    }
    positions.current.clear()
    if (dropping.current && !activeId) {
      const { id, bounds } = dropping.current
      const card = grid.current?.querySelector<HTMLElement>(`[data-gallery-card="${id}"]`)
      if (card && !reduced) {
        const target = card.getBoundingClientRect()
        card.animate([
          { transform: `translate(${bounds.left - target.left}px, ${bounds.top - target.top}px) scale(1.015)` },
          { transform: 'translate(0, 0) scale(1)' },
        ], { duration: 180, easing: 'cubic-bezier(.2,.8,.2,1)' })
      }
      dropping.current = null
    }
  }, [order, activeId])

  useEffect(() => {
    if (!activeId) return
    const card = grid.current?.querySelector<HTMLElement>(`[data-gallery-card="${activeId}"]`)
    if (!card) return
    let frame = 0
    let scrollTarget: HTMLElement = document.scrollingElement as HTMLElement
    for (let ancestor = grid.current?.parentElement; ancestor; ancestor = ancestor.parentElement) {
      if (/(auto|scroll)/.test(getComputedStyle(ancestor).overflowY) && ancestor.scrollHeight > ancestor.clientHeight) { scrollTarget = ancestor; break }
    }

    const update = () => {
      const current = drag.current
      if (!current) return
      card.style.transform = `translate3d(${current.x - current.startX}px, ${current.y - current.startY}px, 0) scale(1.015)`
      const bounds = scrollTarget === document.scrollingElement ? { top: 0, bottom: window.innerHeight } : scrollTarget.getBoundingClientRect()
      const edge = 48
      const delta = current.y < bounds.top + edge ? -Math.min(16, (bounds.top + edge - current.y) / 3)
        : current.y > bounds.bottom - edge ? Math.min(16, (current.y - bounds.bottom + edge) / 3) : 0
      if (delta) scrollTarget.scrollTop += delta
      const target = document.elementFromPoint(current.x, current.y)?.closest<HTMLElement>('[data-gallery-slot]')
      const targetId = target?.dataset.gallerySlot
      if (targetId && targetId !== current.id && grid.current?.contains(target!)) {
        const next = [...orderRef.current]
        const from = next.indexOf(current.id)
        const to = next.indexOf(targetId)
        if (from >= 0 && to >= 0) {
          capturePositions()
          next.splice(to, 0, next.splice(from, 1)[0])
          orderRef.current = next
          setOrder(next)
        }
      }
      frame = requestAnimationFrame(update)
    }
    frame = requestAnimationFrame(update)
    const move = (event: globalThis.PointerEvent) => {
      if (!drag.current || event.pointerId !== drag.current.pointerId) return
      event.preventDefault()
      drag.current.x = event.clientX
      drag.current.y = event.clientY
    }
    const finish = (commit: boolean) => {
      if (!drag.current) return
      const original = callbacks.current.images
      const floatingBounds = card.getBoundingClientRect()
      dropping.current = { id: drag.current.id, bounds: floatingBounds }
      const changed = original.some((image, index) => image.clientId !== orderRef.current[index])
      const byId = new Map(original.map((image) => [image.clientId, image]))
      const valid = orderRef.current.length === original.length && new Set(orderRef.current).size === original.length && orderRef.current.every((id) => byId.has(id))
      capturePositions()
      if (commit && changed && valid) {
        callbacks.current.onReorder(orderRef.current.map((id) => byId.get(id)!))
        setAnnouncement(locale === 'pl' ? 'Zmieniono kolejność zdjęć. Zapisz projekt, aby zachować zmiany.' : 'Image order changed. Save the project to keep changes.')
      } else if (!commit || !valid) {
        orderRef.current = original.map((image) => image.clientId)
        setOrder(orderRef.current)
      }
      card.style.removeProperty('position')
      card.style.removeProperty('left')
      card.style.removeProperty('top')
      card.style.removeProperty('width')
      card.style.removeProperty('transform')
      card.parentElement?.style.removeProperty('min-height')
      drag.current = null
      setActiveId(null)
      callbacks.current.onDraggingChange(false)
    }
    const up = (event: globalThis.PointerEvent) => { if (event.pointerId === drag.current?.pointerId) finish(true) }
    const cancel = (event: globalThis.PointerEvent) => { if (event.pointerId === drag.current?.pointerId) finish(false) }
    const key = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); finish(false) } }
    const blur = () => finish(false)
    window.addEventListener('pointermove', move, { passive: false, capture: true })
    window.addEventListener('pointerup', up, true)
    window.addEventListener('pointercancel', cancel, true)
    window.addEventListener('keydown', key, true)
    window.addEventListener('blur', blur)
    window.addEventListener('resize', blur)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('pointermove', move, true)
      window.removeEventListener('pointerup', up, true)
      window.removeEventListener('pointercancel', cancel, true)
      window.removeEventListener('keydown', key, true)
      window.removeEventListener('blur', blur)
      window.removeEventListener('resize', blur)
      if (drag.current) { drag.current = null; callbacks.current.onDraggingChange(false) }
    }
  }, [activeId, locale])

  function start(event: PointerEvent<HTMLElement>, id: string) {
    if (disabled || images.length < 2 || drag.current || event.button !== 0 || !event.isPrimary) return
    const card = event.currentTarget.closest<HTMLElement>('[data-gallery-card]')
    if (!card) return
    event.preventDefault()
    const bounds = card.getBoundingClientRect()
    const slot = card.parentElement!
    card.getAnimations().forEach((animation) => animation.cancel())
    slot.getAnimations().forEach((animation) => animation.cancel())
    slot.style.minHeight = `${bounds.height}px`
    card.style.position = 'fixed'
    card.style.left = `${bounds.left}px`
    card.style.top = `${bounds.top}px`
    card.style.width = `${bounds.width}px`
    drag.current = { id, pointerId: event.pointerId, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY }
    setActiveId(id)
    callbacks.current.onDraggingChange(true)
  }

  function keyboard(event: KeyboardEvent<HTMLButtonElement>, id: string) {
    if (disabled || drag.current || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
    event.preventDefault()
    const from = orderRef.current.indexOf(id)
    const to = from + (event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1)
    if (to < 0 || to >= images.length) return
    capturePositions()
    const next = [...images]
    next.splice(to, 0, next.splice(from, 1)[0])
    orderRef.current = next.map((image) => image.clientId)
    setOrder(orderRef.current)
    onReorder(next)
    setAnnouncement(locale === 'pl' ? 'Zmieniono kolejność zdjęć. Zapisz projekt, aby zachować zmiany.' : 'Image order changed. Save the project to keep changes.')
  }

  const byId = new Map(images.map((image) => [image.clientId, image]))
  const visibleOrder = order.length === images.length && order.every((id) => byId.has(id)) ? order : images.map((image) => image.clientId)
  return <>
    {images.length > 1 && <p className="admin-project-editor__hint">{locale === 'pl' ? 'Przeciągnij uchwyt zdjęcia, aby zmienić kolejność. Możesz też użyć klawiszy strzałek na uchwycie.' : 'Drag an image handle to reorder. You can also use the arrow keys while the handle is focused.'}</p>}
    <div ref={grid} className={`gallery-sort${activeId ? ' gallery-sort--dragging' : ''}`}>
      {visibleOrder.map((id, index) => {
        const image = byId.get(id)!
        return <div key={id} data-gallery-slot={id} className={`gallery-sort__slot${activeId === id ? ' gallery-sort__slot--active' : ''}`}>
          <div data-gallery-card={id} className={`gallery-sort__card${activeId === id ? ' gallery-sort__card--active' : ''}`} onPointerDown={(event) => {
            if (event.pointerType === 'mouse' && (event.target as HTMLElement).closest('.project-image-field__visual')) start(event, id)
          }}>
            <button className="gallery-sort__handle" type="button" disabled={disabled || images.length < 2} onPointerDown={(event) => start(event, id)} onKeyDown={(event) => keyboard(event, id)} aria-label={`${locale === 'pl' ? 'Przesuń zdjęcie' : 'Move image'} ${index + 1}`}>
              <svg viewBox="0 0 24 16" aria-hidden="true"><path d="M4 3h16M4 8h16M4 13h16" /></svg>
              {locale === 'pl' ? 'Przeciągnij' : 'Drag'}
            </button>
            <ProjectImageField title={`${locale === 'pl' ? 'Zdjęcie' : 'Image'} ${String(index + 1).padStart(2, '0')}`} image={image} disabled={disabled || activeId !== null} uploading={uploadingTarget === `gallery-${id}`} requireAlt
              onChange={(value) => onChange(id, { ...image, ...value })} onUpload={(file) => onUpload(id, file)} onRemove={() => onRemove(id)} />
          </div>
        </div>
      })}
    </div>
    {announcement && <p className="admin-project-editor__hint" role="status">{announcement}</p>}
  </>
}
