import { Disc as Discord, Github, Moon, Sparkles, Sun, Twitter } from 'lucide-react'
import { Logo } from '../../ui/Logo'
import { FadeIn } from '../../lib/FadeIn'

export function Footer() {
  return (
    <footer className="kw-footer">
      <FadeIn distance={14} className="landing-container kw-footer-inner">
        {/* Logo */}
        <Logo light />

        {/* Footer Nav Links */}
        <nav className="kw-footer-nav" aria-label="Footer Navigation">
          <a href="/docs" id="docs">Docs</a>
          <a href="#security">Security</a>
          <a href="#privacy">Privacy</a>
          <a href="#status">Status</a>
          <a href="#pricing" id="pricing">Pricing</a>
        </nav>

        {/* Social & Theme Icons */}
        <div className="kw-footer-icons" aria-label="Social and settings">
          <a href="https://github.com" target="_blank" rel="noreferrer" aria-label="GitHub">
            <Github size={18} />
          </a>
          <a href="https://twitter.com" target="_blank" rel="noreferrer" aria-label="Twitter">
            <Twitter size={18} />
          </a>
          <a href="https://discord.com" target="_blank" rel="noreferrer" aria-label="Discord">
            <Discord size={18} />
          </a>
          <span className="icon-btn" aria-label="Features">
            <Sparkles size={18} />
          </span>
          <span className="icon-btn" aria-label="Dark theme">
            <Moon size={18} />
          </span>
          <span className="icon-btn" aria-label="Light theme">
            <Sun size={18} />
          </span>
        </div>
      </FadeIn>
    </footer>
  )
}
