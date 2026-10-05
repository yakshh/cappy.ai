/**
 * cappy.ai mark: a calm capybara in profile with an orange balanced on its head.
 *
 * <Logo size={34} />            full app-icon tile in the current theme accent
 * <Logo size={16} tile={false}/> bare mark, for placing inside an existing accent-colored box
 *
 * Keep the shapes in sync with /favicon.svg.
 */
export default function Logo({ size = 32, tile = true, cutout = 'var(--accent)', title = 'cappy.ai' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label={title}
      style={{ display: 'block', flexShrink: 0 }}
    >
      {tile && <rect width="64" height="64" rx="16" fill="var(--accent)" />}

      {/* the orange and its leaf */}
      <circle cx="37" cy="19" r="7" fill="#FFB547"/>
      <path d="M37 12.5c0-3.4 2.6-5.2 6-5.2 0 3.4-2.6 5.2-6 5.2Z" fill="#7BC47F"/>
      {/* ear, then head in profile (blunt snout on the left) */}
      <circle cx="47" cy="29.5" r="4.2" fill="#fff"/>
      <path d="M10 41c0-8 6-13.5 16-13.5h19c8 0 12 5.5 12 12.5v6.5c0 3.6-2.8 6.5-6.4 6.5H17c-4 0-7-3-7-7Z" fill="#fff"/>
      {/* face: ear hollow, eye, nostril */}
      <circle cx="47" cy="29.8" r="1.9" fill={cutout} opacity=".6"/>
      <circle cx="29" cy="36" r="2.5" fill={cutout}/>
      <ellipse cx="15.5" cy="40.5" rx="2.4" ry="3" fill={cutout} opacity=".85"/>
    </svg>
  )
}
