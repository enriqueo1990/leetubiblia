import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'
import { usePreferences } from '../lib/preferences.jsx'
import { getFollowedGroupReadings } from '../lib/db.js'
import { ChevronRight } from './icons.jsx'

// Sección "Con tus grupos" de la pantalla Hoy: una fila por grupo cuyo plan sigo
// como lectura ADICIONAL (mi plan personal queda intacto). Mismo flujo que los
// catecismos: la fila navega a la vista de lectura del grupo (/grupos/:id/lectura),
// donde vive el ÚNICO "Marcar como leído" — acá no hay checks propios compitiendo
// con el botón grande de Hoy. El ✓ en la metadata solo señala lo ya leído.
// Vacío si no sigo ninguno (la puerta vive en el detalle del grupo).
export default function GroupReadingsToday() {
  const { user, profile } = useAuth()
  const { t } = usePreferences()
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

  return (
    <div className="mt-8">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-soft">
          {t('hoy.withGroups')}
        </p>
        <span
          className="rounded-pill px-2 py-0.5 text-[11px] font-semibold"
          style={{ color: 'var(--accent-ink)', backgroundColor: 'var(--accent-tint)' }}
        >
          {t('hoy.groupReadingLabel')}
        </span>
      </div>

      {/* Una sola card agrupada (filas + hairline), como "Mis otras lecturas". */}
      <div className="card divide-y divide-hairline">
        {list.map((r) => (
          <Link
            key={r.groupId}
            to={`/grupos/${r.groupId}/lectura`}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
          >
            <span className="block min-w-0 flex-1">
              <span className="block truncate text-[16px] font-medium text-ink">
                {r.groupName}
              </span>
              <span className="mt-0.5 block truncate text-[12px] text-ink-soft">
                {t('hoy.groupReadingMeta')}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-1.5">
              <span className="text-[13px] tabular-nums text-ink-soft">
                {r.read && (
                  <span aria-hidden="true" style={{ color: 'var(--accent-ink)' }}>✓ </span>
                )}
                {t('planes.dayN', { n: r.day })} {t('ajustes.ofTotal', { total: r.totalDays })}
              </span>
              <span className="text-ink-soft" style={{ opacity: 0.5 }}>
                <ChevronRight size={18} />
              </span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
