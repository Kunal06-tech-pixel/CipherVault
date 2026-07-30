import React from 'react'

interface SectionBadgeProps {
  children: React.ReactNode
  icon?: React.ReactNode
  className?: string
}

export function SectionBadge({ children, icon, className = '' }: SectionBadgeProps) {
  return (
    <span className={`kw-section-badge ${className}`}>
      {icon}
      {children}
    </span>
  )
}
