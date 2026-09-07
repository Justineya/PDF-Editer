/** Lightweight inline SVG icons for toolbar / menus */
type IconProps = { size?: number; className?: string }

export function IconSelect({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M4 4l7 16 1.5-6.5L19 12 4 4z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  )
}

export function IconRegion({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <rect x="4" y="5" width="16" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.8" strokeDasharray="3 2" />
      <circle cx="4" cy="5" r="1.5" fill="currentColor" />
      <circle cx="20" cy="5" r="1.5" fill="currentColor" />
      <circle cx="4" cy="19" r="1.5" fill="currentColor" />
      <circle cx="20" cy="19" r="1.5" fill="currentColor" />
    </svg>
  )
}

export function IconText({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M5 6h14M12 6v13M8 19h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export function IconWhiteout({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <rect x="4" y="7" width="16" height="10" rx="1.5" fill="currentColor" opacity="0.2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M7 12h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export function IconImage({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="9" cy="10" r="1.8" fill="currentColor" />
      <path d="M5 17l5-5 3 3 3-4 3 6" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  )
}

export function IconReplace({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M5 8h10M15 8l-2-2M15 8l-2 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19 16H9M9 16l2-2M9 16l2 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Content-stream / edit-original */
export function IconStreamEdit({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M4 20h6L19 11l-3-3L7 17v3z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M14 6l3 3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M4 4h7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}

export function IconWatermark({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" opacity="0.5" />
      <text x="12" y="14.5" textAnchor="middle" fontSize="8" fill="currentColor" opacity="0.85">
        WM
      </text>
    </svg>
  )
}

export function IconUndo({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M9 8H5V4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 8a8 8 0 1 1-1.2 6.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export function IconRedo({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M15 8h4V4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19 8a8 8 0 1 0 1.2 6.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export function IconFile({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.6" />
      <path d="M14 3v5h5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}

export function IconBrowse({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M4 12h16M12 4v16" stroke="currentColor" strokeWidth="1.6" opacity="0.25" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  )
}

export function IconAnnotate({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M5 19l2.5-1L18 7.5 15.5 5 5 15.5V19z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  )
}

export function IconCheck({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M5 12.5l4.5 4.5L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function IconClose({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M7 7l10 10M17 7L7 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}
