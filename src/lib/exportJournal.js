// Exporta el diario "Mi camino" completo como archivo de texto plano.
// Las reflexiones son del usuario: tienen que poder salir de la app en un
// formato que se abra en cualquier lado, sin depender de nosotros.
import { getReflectionJournal, localDateISO, todayLocalISO } from './db.js'
import { fmtISODate, capitalize } from '../i18n/dates.js'
import { planName } from './planLabels.js'

const PAGE = 200

// Trae TODAS las reflexiones (paginando por cursor), más antiguas primero:
// un diario se lee en orden cronológico.
async function fetchAllReflections(userId) {
  const all = []
  let before = null
  for (;;) {
    const page = await getReflectionJournal(userId, { limit: PAGE, before })
    all.push(...page)
    if (page.length < PAGE) break
    before = page[page.length - 1].created_at
  }
  return all.reverse()
}

// Arma el texto del archivo. `t`/`locale` vienen de usePreferences (esto no es
// un componente). Cada entrada: fecha larga · Día N · plan, y la nota debajo.
function buildJournalText(entries, { t, locale }) {
  const fmtLongISO = (iso) =>
    capitalize(
      fmtISODate(iso, locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    )
  const lines = [
    `${t('progreso.view.camino')} — Lee Tu Biblia`,
    `${t('exportJournal.entries', { count: entries.length })} · ${t('exportJournal.exportedOn', {
      date: fmtISODate(todayLocalISO(), locale, { day: 'numeric', month: 'long', year: 'numeric' }),
    })}`,
    '',
  ]
  for (const e of entries) {
    const meta = [
      t('diario.entryMeta', { date: fmtLongISO(localDateISO(e.created_at)), day: e.day_number }),
      planName(t, { slug: e.plan_slug, name: e.plan_name }),
    ]
      .filter(Boolean)
      .join(' · ')
    lines.push('· · ·', '', meta, e.body, '')
  }
  return lines.join('\n')
}

// Exporta el diario: hoja nativa si el dispositivo comparte archivos (móvil,
// donde "descargar" no existe como gesto), descarga directa si no (desktop).
// Devuelve 'shared' | 'downloaded' | 'empty'.
export async function exportJournal(userId, { t, locale }) {
  const entries = await fetchAllReflections(userId)
  if (entries.length === 0) return 'empty'

  const text = buildJournalText(entries, { t, locale })
  const filename = `mi-camino-${todayLocalISO()}.txt`
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const file = new File([blob], filename, { type: 'text/plain' })

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
      return 'shared'
    } catch (e) {
      if (e?.name === 'AbortError') return 'shared' // el usuario canceló
      // si falla el share, caemos a descarga
    }
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return 'downloaded'
}
