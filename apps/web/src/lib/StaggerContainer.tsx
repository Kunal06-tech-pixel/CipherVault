import { useRef } from 'react'
import { motion, useInView, useReducedMotion } from 'framer-motion'
import { staggerContainer, staggerItem, viewportMargin } from './motion'

interface StaggerContainerProps {
  children: React.ReactNode
  /** Delay between each child animation in seconds */
  staggerDelay?: number
  /** CSS class on the wrapper */
  className?: string
  /** Inline styles */
  style?: React.CSSProperties
}

export function StaggerContainer({
  children,
  staggerDelay = 0.07,
  className,
  style,
}: StaggerContainerProps) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: viewportMargin })
  const prefersReducedMotion = useReducedMotion()

  const props: Record<string, unknown> = {
    ref,
    initial: 'hidden',
    animate: isInView ? 'visible' : 'hidden',
    variants: staggerContainer(staggerDelay),
  }

  if (className) props.className = className
  if (style) props.style = style

  if (prefersReducedMotion) {
    const divProps: Record<string, unknown> = { ref }
    if (className) divProps.className = className
    if (style) divProps.style = style
    return <div {...divProps}>{children}</div>
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <motion.div {...(props as any)}>{children}</motion.div>
}

/** Wrap each child in a StaggerContainer with this for the stagger effect */
export function StaggerItem({
  children,
  className,
  style,
}: {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}) {
  const props: Record<string, unknown> = {
    variants: staggerItem,
  }

  if (className) props.className = className
  if (style) props.style = style

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <motion.div {...(props as any)}>{children}</motion.div>
}
