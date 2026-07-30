import React from 'react'

interface PrimaryButtonProps {
  children: React.ReactNode
  href?: string
  onClick?: () => void
  icon?: React.ReactNode
  variant?: 'gradient' | 'secondary'
  className?: string
}

export function PrimaryButton({
  children,
  href,
  onClick,
  icon,
  variant = 'gradient',
  className = '',
}: PrimaryButtonProps) {
  const baseClass = variant === 'gradient' ? 'kw-btn-gradient' : 'kw-btn-secondary'
  const combinedClass = `${baseClass} ${className}`.trim()

  if (href) {
    return (
      <a href={href} className={combinedClass} onClick={onClick}>
        {children}
        {icon}
      </a>
    )
  }

  return (
    <button type="button" onClick={onClick} className={combinedClass}>
      {children}
      {icon}
    </button>
  )
}
