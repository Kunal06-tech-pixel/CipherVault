import { useEffect, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { ArrowRight, Menu, X } from 'lucide-react'
import { brand } from '@keywall/brand'
import { Logo } from '../../ui/Logo'
import { PrimaryButton } from './PrimaryButton'
import { easeOut } from '../../lib/motion'

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const prefersReducedMotion = useReducedMotion()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header className={`kw-navbar ${scrolled ? 'kw-navbar--scrolled' : ''}`}>
      <div className="landing-container kw-navbar-inner">
        <Logo light />

        <nav className="kw-nav-links" aria-label="Main Navigation">
          <a href="#product" className="kw-nav-link">Product</a>
          <a href="#security" className="kw-nav-link">Security</a>
          <a href="#docs" className="kw-nav-link">Docs</a>
          <a href="#enterprise" className="kw-nav-link">Enterprise</a>
          <a href="#pricing" className="kw-nav-link">Pricing</a>
          <a href="/app" className="kw-nav-link">Sign in</a>
          <a href="#beta" className="kw-nav-link">Beta status</a>
          <PrimaryButton href="/app" icon={<ArrowRight size={15} />}>
            {brand.copy.launchCta}
          </PrimaryButton>
        </nav>

        <button
          className="kw-mobile-menu-btn"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle navigation menu"
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>

        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              className="kw-mobile-menu"
              initial={prefersReducedMotion ? false : { opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: easeOut }}
            >
              <a href="#product" onClick={() => setMobileMenuOpen(false)}>Product</a>
              <a href="#security" onClick={() => setMobileMenuOpen(false)}>Security</a>
              <a href="#docs" onClick={() => setMobileMenuOpen(false)}>Docs</a>
              <a href="#enterprise" onClick={() => setMobileMenuOpen(false)}>Enterprise</a>
              <a href="#pricing" onClick={() => setMobileMenuOpen(false)}>Pricing</a>
              <a href="/app" onClick={() => setMobileMenuOpen(false)}>Sign in</a>
              <a href="#beta" onClick={() => setMobileMenuOpen(false)}>Beta status</a>
              <PrimaryButton href="/app" icon={<ArrowRight size={15} />}>
                {brand.copy.launchCta}
              </PrimaryButton>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  )
}
