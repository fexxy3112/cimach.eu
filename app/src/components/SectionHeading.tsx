import { Reveal } from './Reveal'

type SectionHeadingProps = {
  eyebrow: string
  note: string
}

export function SectionHeading({ eyebrow, note }: SectionHeadingProps) {
  return (
    <Reveal className="section-top">
      <span className="eyebrow">{eyebrow}</span>
      <span className="section-note">{note}</span>
    </Reveal>
  )
}
