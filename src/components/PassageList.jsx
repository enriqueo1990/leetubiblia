import { youVersionUrl } from '../lib/bible.js'
import { bookLabel } from '../i18n/books.js'

// Los pasajes del día como protagonistas: cada referencia abre su capítulo en
// la Biblia (tinta plena, sin color — el toque lo confirma la opacidad al
// presionar). Compartido entre Hoy y la lectura de grupo, que muestran el
// mismo tipo de lista. Con ≥4 pasajes la display baja un talle.
export default function PassageList({ refs, locale }) {
  const displayClass = refs.length >= 4 ? 'text-display-sm' : 'text-display'
  return refs.map((ref, i) => {
    const url = youVersionUrl(ref, locale)
    const label = bookLabel(ref, locale)
    return url ? (
      <a
        key={i}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={`block w-fit ${displayClass} text-ink transition-opacity active:opacity-50`}
      >
        {label}
      </a>
    ) : (
      <p key={i} className={`${displayClass} text-ink`}>
        {label}
      </p>
    )
  })
}
