import { useEffect, useRef, useState, type CSSProperties, type ElementType, type ReactNode } from 'react'

type RevealProps = {
  as?: ElementType
  id?: string
  className?: string
  children: ReactNode
  delay?: number
  href?: string
  target?: string
  rel?: string
  ariaLabel?: string
  draggable?: boolean
}

export function Reveal({
  as: Tag = 'div', id, className = '', children, delay = 0,
  href, target, rel, ariaLabel, draggable,
}: RevealProps) {
  const elementRef = useRef<HTMLElement | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const element = elementRef.current
    if (!element) return

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
      setVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.unobserve(entry.target)
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -30px 0px' },
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const style = { '--reveal-delay': `${delay}ms` } as CSSProperties
  return (
    <Tag
      ref={elementRef}
      id={id}
      className={`reveal${visible ? ' visible' : ''}${className ? ` ${className}` : ''}`}
      style={style}
      href={href}
      target={target}
      rel={rel}
      aria-label={ariaLabel}
      draggable={draggable}
    >
      {children}
    </Tag>
  )
}
