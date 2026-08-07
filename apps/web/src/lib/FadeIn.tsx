import { useRef } from 'react'
import { motion, useInView, useReducedMotion, type Variant } from 'framer-motion'
import { easeOut, viewportMargin } from './motion'

interface FadeInProps {
  children: React.ReactNode
  /** Delay in seconds */
  delay?: number
  /** Animation duration in seconds */
  duration?: number
  /** Direction of entrance */
  direction?: 'up' | 'down' | 'left' | 'right' | 'none'
  /** Pixels of movement */
  distance?: number
  /** Apply entrance blur */
  blur?: boolean
  /** Scale entrance */
  scale?: number
  /** Wrapper element tag */
  as?: keyof typeof motion
  /** CSS class on the wrapper */
  className?: string
  /** Inline styles */
  style?: React.CSSProperties
}

export function FadeIn({
  children,
  delay = 0,
  duration = 0.55,
  direction = 'up',
  distance = 24,
  blur = true,
  scale,
  as = 'div',
  className,
  style,
}: FadeInProps) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: viewportMargin })
  const prefersReducedMotion = useReducedMotion()

  const directionMap: Record<string, { x?: number; y?: number }> = {
    up: { y: distance },
    down: { y: -distance },
    left: { x: distance },
    right: { x: -distance },
    none: {},
  }

  const offset = directionMap[direction] ?? {}

  const hidden: Variant = prefersReducedMotion
    ? { opacity: 0 }
    : {
        opacity: 0,
        ...offset,
        ...(blur ? { filter: 'blur(6px)' } : {}),
        ...(scale != null ? { scale } : {}),
      }

  const visible: Variant = prefersReducedMotion
    ? { opacity: 1, transition: { duration: 0.15 } }
    : {
        opacity: 1,
        x: 0,
        y: 0,
        filter: 'blur(0px)',
        ...(scale != null ? { scale: 1 } : {}),
        transition: { duration, delay, ease: easeOut },
      }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Component = (motion as any)[as]

  const props: Record<string, unknown> = {
    ref,
    initial: 'hidden',
    animate: isInView ? 'visible' : 'hidden',
    variants: { hidden, visible },
  }

  if (className) props.className = className
  if (style) props.style = style

  return <Component {...props}>{children}</Component>
}
