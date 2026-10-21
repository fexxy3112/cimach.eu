import { useLocale } from '../i18n/LocaleContext'
import './ErrorToast.scss'

export function ErrorToast({ message, onDismiss, action }: { message: string; onDismiss: () => void; action?: { href: string; label: string } }) {
  const locale = useLocale()
  if (!message) return null
  return <div className="error-toast" role="alert" aria-atomic="true">
    <div className="error-toast__content"><p>{message}</p>{action && <a href={action.href} target="_blank" rel="noopener noreferrer">{action.label}</a>}</div>
    <button type="button" onClick={onDismiss} aria-label={locale === 'pl' ? 'Zamknij komunikat' : 'Dismiss message'}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
    </button>
  </div>
}
