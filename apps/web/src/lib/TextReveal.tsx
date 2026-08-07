import { useRef } from 'react'
import { motion, useInView, useReducedMotion } from 'framer-motion'
import { easeOut, viewportMargin } from './motion'

interface TextRevealProps {
  /** The text to animate word-by-word */
  children: string
  /** Base delay before animation starts (seconds) */
  delay?: number
  /** Wrapper element */
  as?: 'h1' | 'h2' | 'h3' | 'p' | 'span'
  /** CSS class */
  className?: string
  /** Render function for segments that should NOT be animated word-by-word (e.g. <br/>, <span>) */
  segments?: React.ReactNode[]
}

/**
 * Word-by-word reveal animation for headings.
 * Each word fades in from below with slight blur.
 *
 * Usage:
 * ```tsx
 * <TextReveal as="h1" className="kw-hero-title">
 *   Keys stay on your device
 * </TextReveal>
 * ```
 *
 * For headings with mixed content (gradient spans, line breaks), use `segments`:
 * ```tsx
 * <TextReveal
 *   as="h1"
 *   className="kw-hero-title"
 *   segments={[
 *     'Keys stay on your device.',
 *     <br key="br" />,
 *     <span key="gradient" className="kw-gradient-text">Servers never see your secrets.</span>
 *   ]}
 * >
 *   {''}
 * </TextReveal>
 * ```
 */
export function TextReveal({
  children,
  delay = 0,
  as: Tag = 'h1',
  className,
  segments,
}: TextRevealProps) {
  const ref = useRef<HTMLElement>(null)
  const isInView = useInView(ref, { once: true, margin: viewportMargin })
  const prefersReducedMotion = useReducedMotion()

  // Determine what to render
  const content = segments ?? [children]

  // Flatten into word-level tokens
  let wordIndex = 0
  const rendered = content.map((segment, segIdx) => {
    // Non-string segments (JSX like <br/>) render as-is with a delay
    if (typeof segment !== 'string') {
      const idx = wordIndex++
      if (prefersReducedMotion) return segment
      return (
        <motion.span
          key={`seg-${segIdx}`}
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: { duration: 0.3, delay: delay + idx * 0.04, ease: easeOut },
            },
          }}
          style={{ display: 'inline' }}
        >
          {segment}
        </motion.span>
      )
    }

    // String segments: split into words
    const words = segment.split(/\s+/).filter(Boolean)
    return words.map((word, wIdx) => {
      const idx = wordIndex++
      if (prefersReducedMotion) {
        return (
          <span key={`w-${segIdx}-${wIdx}`}>
            {word}{' '}
          </span>
        )
      }
      return (
        <motion.span
          key={`w-${segIdx}-${wIdx}`}
          variants={{
            hidden: {
              opacity: 0,
              y: 12,
              filter: 'blur(4px)',
            },
            visible: {
              opacity: 1,
              y: 0,
              filter: 'blur(0px)',
              transition: {
                duration: 0.4,
                delay: delay + idx * 0.04,
                ease: easeOut,
              },
            },
          }}
          style={{ display: 'inline-block', willChange: 'transform, opacity, filter' }}
        >
          {word}&nbsp;
        </motion.span>
      )
    })
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const MotionTag = (motion as any)[Tag]

  return (
    <MotionTag
      ref={ref}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      {...(className ? { className } : {})}
      style={{ overflow: 'hidden' }}
    >
      {rendered}
    </MotionTag>
  )
}
