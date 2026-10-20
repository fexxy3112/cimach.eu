import { AboutSection } from './sections/AboutSection'
import { ContactSection } from './sections/ContactSection'
import { HeroSection } from './sections/HeroSection'
import { PhotographySection } from './sections/PhotographySection'
import { ProjectsSection } from './sections/ProjectsSection'
import { TechnologyTicker } from './sections/TechnologyTicker'

export function HomePage() {
  return (
    <main className="site-main" id="home">
      <HeroSection />
      <TechnologyTicker />
      <ProjectsSection />
      <AboutSection />
      <PhotographySection />
      <ContactSection />
    </main>
  )
}
