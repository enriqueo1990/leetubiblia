import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

import { CheckIcon } from '../components/icons.jsx'
import BackLink from '../components/BackLink.jsx'
import { getGroup, getGroupTestimonies } from '../lib/db.js'
import RetryError from '../components/RetryError.jsx'
import EmptyState from '../components/EmptyState.jsx'
import { SkeletonCards } from '../components/Skeleton.jsx'

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
    setError(null)
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
      <BackLink to={`/grupos/${id}`} label={group?.name ?? 'Grupo'} />

      <h1 className="mt-3 text-[26px] font-bold tracking-tight text-ink">Testimonios</h1>
      <p className="mt-1 text-[15px] text-ink-soft">Oraciones que el grupo vio responder.</p>

      {error && <RetryError message={error} onRetry={load} />}
      {!error && items === null && <div className="mt-5"><SkeletonCards count={3} /></div>}
      {items?.length === 0 && (
        <EmptyState
          icon={<CheckIcon size={30} strokeWidth={2.2} />}
          text="Todavía no hay testimonios. Cuando alguien marque una oración respondida y la comparta, aparece acá."
        />
      )}

      <ul className="mt-5 space-y-3">
        {items?.map((t) => (
          <li key={t.id} className="card p-[18px]">
            <div className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-accent-ink">
              <CheckIcon size={13} strokeWidth={2.4} />
              Respondido · {fmtDate(t.answered_at)}
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
