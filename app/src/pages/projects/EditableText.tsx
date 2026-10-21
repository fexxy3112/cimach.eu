import { useEffect, useRef } from 'react'
import { RequiredMark } from '../../components/RequiredMark'

export function EditableText({ value, onChange, label, multiline = false, disabled = false, required = false }: {
  value: string
  onChange: (value: string) => void
  label: string
  multiline?: boolean
  disabled?: boolean
  required?: boolean
}) {
  const element = useRef<HTMLSpanElement>(null)
  const initialValue = useRef(value)
  useEffect(() => {
    if (element.current && element.current.innerText !== value) element.current.textContent = value
  }, [value])
  return <><span
    ref={element}
    className="project-edit__text"
    contentEditable={disabled ? false : 'plaintext-only'}
    suppressContentEditableWarning
    role="textbox"
    aria-label={label}
    aria-required={required}
    aria-multiline={multiline}
    aria-disabled={disabled}
    tabIndex={disabled ? -1 : 0}
    data-placeholder={label}
    onInput={(event) => onChange(event.currentTarget.innerText.replace(/\r\n/g, '\n'))}
    onKeyDown={(event) => { if (!multiline && event.key === 'Enter') event.preventDefault() }}
    onPaste={(event) => {
      event.preventDefault()
      if (disabled) return
      const text = event.clipboardData.getData('text/plain')
      const selection = window.getSelection()
      if (!selection?.rangeCount) return
      const range = selection.getRangeAt(0)
      if (!event.currentTarget.contains(range.commonAncestorContainer)) return
      range.deleteContents()
      const node = document.createTextNode(multiline ? text : text.replace(/[\r\n]+/g, ' '))
      range.insertNode(node)
      range.setStartAfter(node)
      range.collapse(true)
      selection.removeAllRanges()
      selection.addRange(range)
      onChange(event.currentTarget.innerText)
    }}
  >{initialValue.current}</span>{required && <RequiredMark />}</>
}
