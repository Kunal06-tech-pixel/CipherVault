/**
 * Shared motion constants for Keywall animations.
 * All components import from here to ensure consistent timing.
 */

/** Custom expo-out easing — smooth, premium feel */
export const easeOut: [number, number, number, number] = [0.16, 1, 0.3, 1]

/** Transition presets */
export const transitions = {
  /** Hover states, tooltips, micro-feedback */
  fast: { duration: 0.2, ease: easeOut },
  /** Standard UI transitions */
  normal: { duration: 0.45, ease: easeOut },
  /** Section reveals, panel slides */
  slow: { duration: 0.7, ease: easeOut },
  /** Hero entrance, major reveals */
  hero: { duration: 0.85, ease: easeOut },
} as const

/** Reveal animation variants (fade + slide + blur) */
export const revealVariants = {
  hidden: {
    opacity: 0,
    y: 24,
    filter: 'blur(6px)',
  },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: transitions.slow,
  },
} as const

/** Subtle reveal — less movement, no blur */
export const subtleRevealVariants = {
  hidden: {
    opacity: 0,
    y: 12,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: transitions.normal,
  },
} as const

/** Scale reveal — for cards and panels */
export const scaleRevealVariants = {
  hidden: {
    opacity: 0,
    scale: 0.96,
    filter: 'blur(4px)',
  },
  visible: {
    opacity: 1,
    scale: 1,
    filter: 'blur(0px)',
    transition: transitions.slow,
  },
} as const

/** Stagger container — orchestrates child delays */
export const staggerContainer = (staggerDelay = 0.07) => ({
  hidden: {},
  visible: {
    transition: {
      staggerChildren: staggerDelay,
      delayChildren: 0.1,
    },
  },
})

/** Stagger item — individual child in a stagger group */
export const staggerItem = {
  hidden: {
    opacity: 0,
    y: 20,
    filter: 'blur(4px)',
  },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: transitions.normal,
  },
} as const

/** Default viewport trigger margin */
export const viewportMargin = '-80px'
