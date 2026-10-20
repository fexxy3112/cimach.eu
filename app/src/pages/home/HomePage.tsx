import type { PublicProject } from '../../data/projectApi'
import { AboutSection } from './sections/AboutSection'
import { ContactSection } from './sections/ContactSection'
import { HeroSection } from './sections/HeroSection'
import { PhotographySection } from './sections/PhotographySection'
import { ProjectsSection } from './sections/ProjectsSection'
import { TechnologyTicker } from './sections/TechnologyTicker'

export function HomePage({ projects, loading, error }: {
  projects: PublicProject[]
  loading: boolean
  error: boolean
}) {
  return (
    <main className="site-main" id="home">
      <HeroSection />
      <TechnologyTicker />
      <ProjectsSection projects={projects} loading={loading} error={error} />
      <AboutSection />
      <PhotographySection />
      <ContactSection />
    </main>
  )
}
