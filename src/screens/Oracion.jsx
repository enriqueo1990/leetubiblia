import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PlusIcon, LockIcon, PeopleIcon } from '../components/icons.jsx'
import Segmented from '../components/Segmented.jsx'
import { SkeletonCards } from '../components/Skeleton.jsx'
import PrayerSheet from './PrayerSheet.jsx'
import { useAuth } from '../lib/auth.jsx'
import { getMyPrayers, getGroupPrayers, getMyGroups } from '../lib/db.js'

// Oración (documento maestro §5.4, README pantalla 4).
const SEGMENTS = [
  { key: 'mine', label: 'Míos' },
  { key: 'groups', label: 'De mis grupos' },
]

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

function StatusBadge({ status }) {
  const answered = status === 'answered'
  return (
    <span
      className="rounded-pill px-2 py-0.5 text-[12px] font-medium"
      style={{
        color: answered ? 'var(--accent)' : 'var(--text-soft)',
        backgroundColor: answered ? 'var(--accent-tint)' : 'var(--surface-alt)',
      }}
    >
      {answered ? 'Respondido' : 'Activo'}
    </span>
  )
}

function PrayerItem({ p, subtitle, onClick, dimmed }) {
  const count = p.intercessor_count ?? 0
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="card flex w-full items-center justify-between p-4 text-left"
        style={{ opacity: dimmed ? 0.55 : 1 }}
      >
        <div className="min-w-0 pr-3">
          <p className="truncate text-[16px] font-semibold text-ink">{p.title}</p>
          <p className="text-[13px] text-ink-soft">{subtitle}</p>
          {p.visibility === 'shared' && count > 0 && (
            <p className="mt-0.5 text-[12px] font-medium" style={{ color: 'var(--accent)' }}>
              {count} {count === 1 ? 'persona orando' : 'personas orando'}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2 text-ink-soft">
          {p.visibility === 'private' ? <LockIcon size={15} /> : <PeopleIcon size={16} />}
          <StatusBadge status={p.status} />
        </div>
      </button>
    </li>
  )
}

export default function Oracion() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [seg, setSeg] = useState('mine')
  const [mine, setMine] = useState(null)
  const [groupPrayers, setGroupPrayers] = useState(null)
  const [groups, setGroups] = useState([])
  const [sheet, setSheet] = useState(null) // { mode, prayer? } | null
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    setError(false)
    try {
      const [m, g, gr] = await Promise.all([
        getMyPrayers(user.id),
        getGroupPrayers(user.id),
        getMyGroups(user.id),
      ])
      setMine(m)
      setGroupPrayers(g)
      setGroups(gr)
    } catch {
      setError(true)
    }
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  function closeSheet(reload) {
    setSheet(null)
    if (reload) load()
  }

  // "Míos": activos primero, luego respondidos atenuados.
  const myActive = mine?.filter((p) => p.status === 'active') ?? []
  const myAnswered = mine?.filter((p) => p.status === 'answered') ?? []

  // "De mis grupos": agrupados por nombre de grupo.
  const byGroup = {}
  for (const p of groupPrayers ?? []) {
    const name = p.group?.name ?? 'Grupo'
    ;(byGroup[name] ??= []).push(p)
  }

  return (
    <div className="pt-2">
      <div className="flex items-center justify-between">
        <h1 className="text-[26px] font-bold tracking-tight text-ink">Oración</h1>
        <button
          type="button"
          aria-label="Nuevo pedido"
          onClick={() => setSheet({ mode: 'create' })}
          className="flex h-[44px] items-center justify-center gap-1 rounded-full px-3 text-on-accent lg:px-4"
          style={{ backgroundColor: 'var(--accent)', minWidth: 44 }}
        >
          <PlusIcon size={20} />
          <span className="hidden text-[14px] font-semibold lg:inline">Nuevo pedido</span>
        </button>
      </div>

      <Segmented className="mt-5" options={SEGMENTS} value={seg} onChange={setSeg} />

      {error && (
        <div className="mt-4 rounded-card p-4 text-[14px]" style={{ backgroundColor: 'var(--surface-alt)' }}>
          <p className="text-ink">No se pudieron cargar los pedidos.</p>
          <button
            type="button"
            onClick={load}
            className="mt-1 font-semibold"
            style={{ color: 'var(--accent)' }}
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Míos */}
      {seg === 'mine' && (
        <div className="mt-4">
          {mine === null && !error && <SkeletonCards count={3} />}
          {mine?.length === 0 && (
            <p className="mt-10 text-center text-[15px] leading-relaxed text-ink-soft">
              Todavía no tenés pedidos. Tocá + para crear el primero —privado, o
              compartido con un grupo para que otros oren con vos.
            </p>
          )}
          <ul className="space-y-3">
            {myActive.map((p) => (
              <PrayerItem
                key={p.id}
                p={p}
                subtitle={fmtDate(p.created_at)}
                onClick={
                  p.visibility === 'shared'
                    ? () => navigate(`/oracion/${p.id}`)
                    : () => setSheet({ mode: 'edit', prayer: p })
                }
              />
            ))}
          </ul>
          {myAnswered.length > 0 && (
            <>
              <p className="mb-2 mt-6 text-[12px] font-semibold uppercase tracking-wide text-ink-soft">
                Respondidos
              </p>
              <ul className="space-y-3">
                {myAnswered.map((p) => (
                  <PrayerItem
                    key={p.id}
                    p={p}
                    dimmed
                    subtitle={`Respondida · ${fmtDate(p.answered_at || p.created_at)}`}
                    onClick={
                      p.visibility === 'shared'
                        ? () => navigate(`/oracion/${p.id}`)
                        : () => setSheet({ mode: 'edit', prayer: p })
                    }
                  />
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {/* De mis grupos */}
      {seg === 'groups' && (
        <div className="mt-4">
          {groupPrayers === null && !error && <SkeletonCards count={3} />}
          {groupPrayers?.length === 0 && (
            <div className="mt-10 text-center">
              {groups.length === 0 ? (
                <>
                  <p className="text-[15px] leading-relaxed text-ink-soft">
                    Orá junto a otros: unite a un grupo para ver y sostener los pedidos
                    que comparten.
                  </p>
                  <Link to="/grupos" className="btn btn-primary mt-5 inline-block px-8">
                    Ir a Grupos
                  </Link>
                </>
              ) : (
                <p className="text-[15px] text-ink-soft">
                  No hay pedidos compartidos en tus grupos todavía.
                </p>
              )}
            </div>
          )}
          {Object.entries(byGroup).map(([name, items]) => {
            const active = items.filter((p) => p.status === 'active')
            const answered = items.filter((p) => p.status === 'answered')
            return (
              <div key={name} className="mb-6">
                <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-ink-soft">
                  {name}
                </p>
                <ul className="space-y-3">
                  {[...active, ...answered].map((p) => (
                    <PrayerItem
                      key={p.id}
                      p={p}
                      dimmed={p.status === 'answered'}
                      subtitle={`${p.author_name} · ${fmtDate(p.created_at)}`}
                      onClick={() => navigate(`/oracion/${p.id}`)}
                    />
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      )}

      {sheet && (
        <PrayerSheet
          mode={sheet.mode}
          prayer={sheet.prayer}
          groups={groups}
          onClose={() => closeSheet(false)}
          onSaved={() => closeSheet(true)}
        />
      )}
    </div>
  )
}
