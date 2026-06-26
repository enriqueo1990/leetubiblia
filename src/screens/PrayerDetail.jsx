import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { HeartIcon, CheckIcon } from '../components/icons.jsx'
import Avatars from '../components/Avatars.jsx'
import PrayerSheet from './PrayerSheet.jsx'
import { useAuth } from '../lib/auth.jsx'
import { getPrayerDetail, addIntercession, removeIntercession, getMyGroups } from '../lib/db.js'

// Detalle de un pedido compartido con "Estoy orando por esto" (Fase 2, F2-A).
// Lo abren los miembros desde "De mis grupos"; el autor lo ve sin el botón pero
// con el conteo de quiénes oran (así "se entera" sin push, modelo pull).
function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

export default function PrayerDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(false)
  const [groups, setGroups] = useState([])

  const load = useCallback(async () => {
    setError(null)
    try {
      setData(await getPrayerDetail(Number(id), user?.id))
    } catch {
      setError('No se pudo cargar el pedido.')
    }
  }, [id, user])

  useEffect(() => {
    load()
  }, [load])

  // Carga grupos solo si el usuario es autor (necesario para abrir PrayerSheet en edición).
  useEffect(() => {
    if (user) getMyGroups(user.id).then(setGroups).catch(() => {})
  }, [user])

  async function toggle() {
    if (busy || !data || data.status !== 'active') return
    setBusy(true)
    const next = !data.i_intercede
    const meName = profile?.display_name || 'Vos'
    // Optimista: reflejamos el cambio antes de la red.
    setData((d) => ({
      ...d,
      i_intercede: next,
      intercessor_count: d.intercessor_count + (next ? 1 : -1),
      intercessors: next
        ? [...d.intercessors, { user_id: user.id, display_name: meName }]
        : d.intercessors.filter((x) => x.user_id !== user.id),
    }))
    try {
      if (next) await addIntercession(data.id, user.id)
      else await removeIntercession(data.id, user.id)
    } catch {
      await load() // revertir al estado real del servidor
    } finally {
      setBusy(false)
    }
  }

  if (error) {
    return (
      <div className="pt-2">
        <Link to="/oracion" className="text-[15px] font-medium" style={{ color: 'var(--accent)' }}>
          ‹ Oración
        </Link>
        <p className="mt-8 text-[15px] text-ink-soft">{error}</p>
        <button
          type="button"
          onClick={load}
          className="mt-2 text-[15px] font-semibold"
          style={{ color: 'var(--accent)' }}
        >
          Reintentar
        </button>
      </div>
    )
  }
  if (!data) return <p className="pt-10 text-[15px] text-ink-soft">Cargando…</p>

  const { intercessors, intercessor_count: count, i_intercede } = data
  const isAuthor = data.user_id === user?.id

  let countLabel
  if (i_intercede) {
    countLabel = `${count} ${count === 1 ? 'persona está orando' : 'personas están orando'} · vos incluido.`
  } else if (count > 0) {
    countLabel = `${count} ${count === 1 ? 'persona está orando' : 'personas están orando'} por esto.`
  } else {
    countLabel = isAuthor ? 'Todavía nadie se sumó a orar.' : 'Sé el primero en orar por esto.'
  }

  async function handleSheetSaved() {
    setEditing(false)
    try {
      await load()
    } catch {
      navigate('/oracion')
    }
  }

  return (
    <div className="pt-2">
      <div className="flex items-center justify-between">
        <Link to="/oracion" className="text-[15px] font-medium" style={{ color: 'var(--accent)' }}>
          ‹ Oración
        </Link>
        {isAuthor && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-[15px] font-medium"
            style={{ color: 'var(--accent)' }}
          >
            Editar
          </button>
        )}
      </div>

      {data.group?.name && (
        <p className="mt-4 text-[12px] font-semibold uppercase tracking-wide text-accent">
          {data.group.name}
        </p>
      )}
      <h1 className="mt-2 text-[25px] font-bold leading-tight tracking-tight text-ink">
        {data.title}
      </h1>
      <p className="mt-2 text-[14px] text-ink-soft">
        {data.author_name} · {fmtDate(data.created_at)}
      </p>

      {data.description && (
        <p className="mt-5 whitespace-pre-line text-[16px] leading-relaxed text-ink">
          {data.description}
        </p>
      )}

      {/* Intercesión */}
      <div className="card mt-7 p-[18px]">
        {count > 0 && (
          <div className="mb-3.5">
            <Avatars people={intercessors} count={count} />
          </div>
        )}
        <p className="mb-3.5 text-[14px] text-ink-soft">{countLabel}</p>

        {!isAuthor && data.status !== 'active' && (
          <p className="text-center text-[13px] text-ink-soft">
            Este pedido ya fue respondido.
          </p>
        )}

        {!isAuthor &&
          data.status === 'active' &&
          (i_intercede ? (
            <>
              <button
                type="button"
                onClick={toggle}
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-input py-[15px] text-[16px] font-semibold text-on-accent"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                <CheckIcon size={19} strokeWidth={2.2} /> Estás orando por esto
              </button>
              <p className="mt-2.5 text-center text-[13px] text-ink-soft">
                {data.author_name} va a ver que estás orando.
              </p>
            </>
          ) : (
            <button
              type="button"
              onClick={toggle}
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-input py-[15px] text-[16px] font-semibold"
              style={{ border: '1px solid var(--accent)', color: 'var(--accent)' }}
            >
              <HeartIcon size={19} /> Estoy orando por esto
            </button>
          ))}
      </div>

      {editing && (
        <PrayerSheet
          mode="edit"
          prayer={data}
          groups={groups}
          onClose={() => setEditing(false)}
          onSaved={handleSheetSaved}
        />
      )}
    </div>
  )
}
