import '../../styles/landing.css'
import { Navbar } from '../../components/landing/Navbar'
import { HeroSection } from '../../components/landing/HeroSection'
import { SecurityArchitectureSection } from '../../components/landing/SecurityArchitectureSection'
import { PrivacySection } from '../../components/landing/PrivacySection'
import { ReleaseBoundarySection } from '../../components/landing/ReleaseBoundarySection'
import { ClosingSection } from '../../components/landing/ClosingSection'
import { Footer } from '../../components/landing/Footer'

export function LandingPage() {
  return (
    <div className="keywall-landing-root">
      <Navbar />
      <main aria-label="Public">
        <HeroSection />
        <SecurityArchitectureSection />
        <PrivacySection />
        <ReleaseBoundarySection />
        <ClosingSection />
      </main>
      <Footer />
    </div>
  )
}
