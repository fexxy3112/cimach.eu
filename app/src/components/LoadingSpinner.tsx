import './LoadingSpinner.scss'

type LoadingSpinnerProps = { className?: string }

export function LoadingSpinner({ className }: LoadingSpinnerProps) {
  return <span className={`loading-spinner${className ? ` ${className}` : ''}`} aria-hidden="true" />
}
