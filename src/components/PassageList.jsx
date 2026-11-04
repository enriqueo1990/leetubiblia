import { useEffect } from 'react'
import { passageUrl } from '../lib/bible.js'
import { bookLabel, bookLabelParts } from '../i18n/books.js'
import { ensureBrandFont } from '../lib/brandFont.js'

// Los pasajes del día como protagonistas, en la serif de la marca: el libro en
// tinta y el capítulo en el acento (como en las portadas). Cada referencia abre
// su capítulo en la Biblia; el toque lo confirma la opacidad al presionar.
// Compartido entre Hoy y la lectura de grupo, que muestran el mismo tipo de
// lista. Con ≥4 pasajes la display baja un talle.
export default function PassageList({ refs, locale, provider, externalHint }) {
  useEffect(() => {
    ensureBrandFont()
  }, [])
  const displayClass = refs.length >= 4 ? 'text-display-sm' : 'text-display'
  return refs.map((ref, i) => {
    const url = passageUrl(ref, locale, provider)
    const label = bookLabel(ref, locale)
    const { name, numeric } = bookLabelParts(ref, locale)
    const text = (
      <>
        {name}
        {numeric && (
          <>
            {' '}
            <span style={{ color: 'var(--accent-ink)' }}>{numeric}</span>
          </>
        )}
      </>
    )
    return url ? (
      <a
        key={i}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={externalHint ? `${label}. ${externalHint}` : label}
        className={`block w-fit ${displayClass} text-ink transition-opacity active:opacity-50`}
      >
        {text}
      </a>
    ) : (
      <p key={i} className={`${displayClass} text-ink`}>
        {text}
      </p>
    )
  })
}
