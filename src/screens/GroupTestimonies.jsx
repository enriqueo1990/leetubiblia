import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CheckIcon } from '../components/icons.jsx'
import { getGroup, getGroupTestimonies } from '../lib/db.js'

// Testimonios del grupo (Fase 2, F2-C): oraciones respondidas que el autor
// eligió compartir. Solo lectura, ordenadas de la más reciente a la más vieja.
function fmtDate(iso) {
  return iso ? new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : ''
}

export default function GroupTestimonies() {
  const { id } = useParams()
  const [group, setGroup] = useState(null)
  const [items, setItems] = useState(null)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    try {
      const [g, t] = await Promise.all([getGroup(Number(id)), getGroupTestimonies(Number(id))])
      setGroup(g)
      setItems(t)
    } catch {
      setError('No se pudieron cargar los testimonios.')
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="pt-2">
      <Link
        to={`/grupos/${id}`}
        className="text-[15px] font-medium"
        style={{ color: 'var(--accent)' }}
      >
        ‹ {group?.name ?? 'Grupo'}
      </Link>

      <h1 className="mt-3 text-[26px] font-bold tracking-tight text-ink">Testimonios</h1>
      <p className="mt-1 text-[14px] text-ink-soft">Oraciones que el grupo vio responder.</p>

      {error && <p className="mt-8 text-[15px] text-ink-soft">{error}</p>}
      {!error && items === null && <p className="mt-8 text-[15px] text-ink-soft">Cargando…</p>}
      {items?.length === 0 && (
        <p className="mt-10 text-center text-[15px] leading-relaxed text-ink-soft">
          Todavía no hay testimonios. Cuando alguien marque una oración respondida y la comparta,
          aparece acá.
        </p>
      )}

      <ul className="mt-5 space-y-3">
        {items?.map((t) => (
          <li key={t.id} className="card p-[18px]">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-accent">
              <CheckIcon size={13} strokeWidth={2.4} />
              Respondida · {fmtDate(t.answered_at)}
            </div>
            <p className="mt-2.5 text-[18px] font-semibold tracking-tight text-ink">{t.title}</p>
            {t.testimony && (
              <p className="mt-2.5 text-[15px] leading-relaxed text-ink">«{t.testimony}»</p>
            )}
            <p className="mt-3 text-[13px] font-medium text-ink-soft">{t.author_name}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
