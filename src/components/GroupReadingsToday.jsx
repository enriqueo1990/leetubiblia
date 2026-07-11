import { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth.jsx'
import { usePreferences } from '../lib/preferences.jsx'
import { getFollowedGroupReadings, markRead, unmarkRead } from '../lib/db.js'
import { youVersionUrl } from '../lib/bible.js'
import { bookLabel } from '../i18n/books.js'
import { CheckIcon } from './icons.jsx'

// Sección "Con tus grupos" de la pantalla Hoy: la lectura del día de cada grupo
// cuyo plan sigo como lectura ADICIONAL (mi plan personal queda intacto). El día
// lo dicta el calendario del grupo — sin racha ni progreso propio, como los
// materiales. El check escribe en reading_progress con el plan_id del grupo, así
// el pulso "quién leyó hoy" del grupo me cuenta. Vacío si no sigo ninguno (y sin
// aviso de descubrimiento: la puerta vive en el detalle del grupo).
export default function GroupReadingsToday() {
  const { user, profile } = useAuth()
  const { t, locale } = usePreferences()
  const [readings, setReadings] = useState([])

  useEffect(() => {
    if (!user) return
    let on = true
    getFollowedGroupReadings(user.id)
      .then((list) => on && setReadings(list))
      .catch(() => {}) // sin red (o sin la migración): la sección no aparece
    return () => {
      on = false
    }
  }, [user])

  // Si el plan del grupo ES mi plan activo anclado a la misma fecha, la lectura
  // ya está arriba como principal — repetirla abajo sería la misma fila dos veces.
  const list = readings.filter(
    (r) =>
      !(
        r.planId === profile?.active_plan_id &&
        r.planStartDate === profile?.plan_start_date
      )
  )
  if (list.length === 0) return null

  // Optimista e idempotente (mismo criterio que marcar el día principal): si el
  // servidor falla, se revierte y el toque queda disponible de nuevo.
  async function toggle(r) {
    const next = !r.read
    setReadings((rs) => rs.map((x) => (x.groupId === r.groupId ? { ...x, read: next } : x)))
    try {
      if (next) await markRead(user.id, r.planId, r.day)
      else await unmarkRead(user.id, r.planId, r.day)
    } catch {
      setReadings((rs) => rs.map((x) => (x.groupId === r.groupId ? { ...x, read: r.read } : x)))
    }
  }

  return (
    <div className="mt-8">
      <p className="mb-2 text-[13px] font-medium text-ink-soft">{t('hoy.withGroups')}</p>

      {/* Una sola card agrupada (filas + hairline), como "Mis otras lecturas". */}
      <div className="card divide-y divide-hairline">
        {list.map((r) => (
          <div key={r.groupId} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] text-ink-soft">
                {r.groupName} · {t('planes.dayN', { n: r.day })}
              </p>
              {/* Cada referencia abre su capítulo, como la lectura principal. */}
              <p className="mt-0.5 text-[16px] leading-relaxed text-ink">
                {r.refs.map((ref, i) => {
                  const url = youVersionUrl(ref, locale)
                  const label = bookLabel(ref, locale)
                  return (
                    <span key={i}>
                      {i > 0 && <span aria-hidden="true" className="text-ink-soft"> · </span>}
                      {url ? (
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="transition-opacity active:opacity-50"
                        >
                          {label}
                        </a>
                      ) : (
                        label
                      )}
                    </span>
                  )
                })}
              </p>
            </div>
            <button
              type="button"
              onClick={() => toggle(r)}
              aria-pressed={r.read}
              aria-label={
                r.read
                  ? t('hoy.unmarkGroupReadAria', { name: r.groupName })
                  : t('hoy.markGroupReadAria', { name: r.groupName })
              }
              className="flex h-11 w-11 shrink-0 items-center justify-center"
            >
              <span
                className="flex h-7 w-7 items-center justify-center rounded-full"
                style={
                  r.read
                    ? { backgroundColor: 'var(--accent)', color: 'var(--on-accent)' }
                    : { border: '1.5px solid var(--hairline)' }
                }
                aria-hidden="true"
              >
                {r.read && <CheckIcon size={15} strokeWidth={2.4} />}
              </span>
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
