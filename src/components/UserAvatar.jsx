import { useState } from 'react'
import { initials } from './Avatars.jsx'

// Un avatar: la foto de perfil si hay (y carga), si no la inicial sobre el
// acento. `tone`: 'solid' (acento pleno, para tu propio perfil) o 'tint'
// (suave, para listas de otras personas).
export default function UserAvatar({ name, url, size = 40, tone = 'tint', className = '', style = null }) {
  const [failed, setFailed] = useState(false)
  const base = {
    width: size,
    height: size,
    fontSize: Math.round(size * 0.38),
    ...(tone === 'solid'
      ? { backgroundColor: 'var(--accent-action)', color: 'var(--on-accent)' }
      : { backgroundColor: 'var(--accent-tint)', color: 'var(--accent-ink)' }),
    ...style,
  }
  return (
    <span
      aria-hidden="true"
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold ${className}`}
      style={base}
    >
      {url && !failed ? (
        <img src={url} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} className="h-full w-full object-cover" />
      ) : (
        initials(name)
      )}
    </span>
  )
}
