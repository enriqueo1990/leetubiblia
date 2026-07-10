import { useEffect, useState } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'
import {
  loadMaterialContent,
  isMaterialActive,
  positionOf,
  withMaterialPosition,
} from '../lib/materials.js'
import { youVersionUrl } from '../lib/bible.js'
import { usePreferences } from '../lib/preferences.jsx'
import { bookLabel } from '../i18n/books.js'
import { shareQuestion, buildQuestionImage, QUOTE_STYLES } from '../lib/shareImage.js'
import { ListIcon, ShareIcon } from '../components/icons.jsx'
import BackLink from '../components/BackLink.jsx'
import MaterialIndexSheet from '../components/MaterialIndexSheet.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import Sheet from '../components/Sheet.jsx'
import Segmented from '../components/Segmented.jsx'

// Último estilo y formato de imagen compartida. Es memoria de flujo, no una
// preferencia del perfil: vive en el dispositivo.
const SHARE_FORMAT_KEY = 'ltb:shareFormat'
const SHARE_STYLE_KEY = 'ltb:shareStyle'

// Vista de lectura de un material (catecismo, etc.) — un lector tipo libro con
// marcador. Se abre en la pregunta actual (la posición guardada). Navegás libremente
// entre las que ya leíste; en la pregunta del frente, "Marcar como leído" avanza el
// marcador (secuencial, sin saltear — como la lectura del plan). El progreso NO toca
// reading_progress: es tu marcador personal del material, nada más.
//
// Diseño (mismo principio que Hoy): metadata callada, contenido protagonista, UNA
// acción primaria por estado. La fila de navegación (‹ Anterior / Siguiente ›) es
// constante: mismo lugar, color y vocabulario en frontera y repaso — el control de
// "volver" no se teletransporta al cambiar de estado. En la frontera "Marcar como
// leído" ocupa el lugar de avanzar (no hay Siguiente); nada de botones
// deshabilitados ocupando lugar.
export default function MaterialReader() {
  const { slug } = useParams()
  const { profile, updateProfile } = useAuth()
  const { t, locale } = usePreferences()

  const [content, setContent] = useState(null) // null = cargando
  const [notFound, setNotFound] = useState(false)
  const [pos, setPos] = useState(null) // marcador optimista (próxima sin leer, 1-based)
  const [n, setN] = useState(null) // pregunta que se está viendo
  const [indexOpen, setIndexOpen] = useState(false) // hoja de índice
  const [confirmRestart, setConfirmRestart] = useState(false)
  const [saveError, setSaveError] = useState(false) // falló guardar el avance
  const [shareOpen, setShareOpen] = useState(false) // hoja de formato (1:1 / 9:16)
  const [sharing, setSharing] = useState(false) // generando la imagen para compartir
  const [shareError, setShareError] = useState(false)

  // Cargar el contenido (import dinámico, cacheado).
  useEffect(() => {
    let on = true
    loadMaterialContent(slug).then((c) => {
      if (!on) return
      if (!c) setNotFound(true)
      else setContent(c)
    })
    return () => {
      on = false
    }
  }, [slug])

  // Sembrar el marcador desde el perfil una sola vez (después queda local/optimista).
  useEffect(() => {
    if (pos != null) return
    const saved = positionOf(profile, slug)
    if (saved != null) setPos(saved)
  }, [profile, slug, pos])

  // Abrir en la pregunta actual (marcador), acotada al total. Si todavía no leyó
  // nada y el material tiene introducción, abrir en la portada (n=0).
  useEffect(() => {
    if (n != null || pos == null || !content) return
    const hasIntro = Array.isArray(content.intro) && content.intro.length > 0
    setN(pos === 1 && hasIntro ? 0 : Math.min(pos, content.total))
  }, [n, pos, content])

  // Al cambiar de pregunta, volver arriba: si la anterior era larga y quedaste
  // scrolleado, la ficha nueva se lee desde el título (salto instantáneo, sin
  // animación de scroll — es lectura, no espectáculo).
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [n])

  // Slug inexistente, o material que el usuario no activó → volver al catálogo.
  if (notFound) return <Navigate to="/materiales" replace />
  if (profile && !isMaterialActive(profile, slug)) return <Navigate to="/materiales" replace />

  if (!content || pos == null || n == null) {
    return (
      <div className="pt-2">
        <div className="h-4 w-40 rounded-pill" style={{ backgroundColor: 'var(--surface-alt)' }} />
        <div className="mt-6 h-7 w-3/4 rounded-pill" style={{ backgroundColor: 'var(--surface-alt)' }} />
      </div>
    )
  }

  const total = content.total
  const hasIntro = Array.isArray(content.intro) && content.intro.length > 0
  const isIntro = n === 0 // "ficha 0": portada con contexto histórico, sin marcador
  const entry = isIntro ? null : content.entries[n - 1]
  const completed = pos > total
  const atFrontier = !completed && n === pos // la pregunta actual, lista para marcar
  const maxN = Math.min(pos, total) // no se avanza más allá de lo leído (+ la del frente)
  const canPrev = n > (hasIntro ? 0 : 1)
  const canNext = n < maxN

  // Avance optimista PERO honesto: la UI avanza ya, y si el guardado falla se
  // revierte y se avisa (canon: nunca mostrar un estado que no quedó guardado).
  async function persist(nextPos, revertPos, revertN) {
    setSaveError(false)
    const { error } = await updateProfile({
      active_materials: withMaterialPosition(profile, slug, nextPos),
    })
    if (error) {
      setPos(revertPos)
      setN(revertN)
      setSaveError(true)
    }
  }

  function markRead() {
    const next = n + 1
    const revertPos = pos
    const revertN = n
    setPos(next)
    if (n < total) setN(n + 1) // avanza a la siguiente; si era la última, queda completado
    persist(next, revertPos, revertN)
  }

  function restart() {
    const revertPos = pos
    const revertN = n
    setPos(1)
    setN(hasIntro ? 0 : 1) // volver a empezar = volver a la portada
    persist(1, revertPos, revertN)
  }

  // Datos de la tarjeta (la i18n se resuelve acá: el módulo de dibujo recibe
  // textos ya armados). "Pregunta N de M" con espacios duros: no debe partirse.
  const shareData = entry
    ? {
        meta: [
          content.name,
          t('materialsToday.questionOf', { n: entry.number, total }).replace(/ /g, '\u00A0'),
        ].join(' · '),
        question: entry.question,
        answer: entry.answer,
        refs: entry.refs.map((ref) => bookLabel(ref, locale)),
      }
    : null

  // Compartir con el estilo y formato elegidos en la hoja (decisiones del
  // momento, no preferencias globales); ambos se recuerdan en el dispositivo.
  async function handleShare(style, format) {
    if (sharing || !shareData) return
    setShareOpen(false)
    setSharing(true)
    setShareError(false)
    try {
      localStorage.setItem(SHARE_FORMAT_KEY, format)
      localStorage.setItem(SHARE_STYLE_KEY, style)
    } catch {
      /* almacenamiento bloqueado: se comparte igual, sin recordar */
    }
    try {
      await shareQuestion({
        ...shareData,
        style,
        format,
        filename: `${slug}-${entry.number}${format === 'story' ? '-historia' : ''}.png`,
      })
    } catch {
      setShareError(true)
    } finally {
      setSharing(false)
    }
  }

  return (
    <div className="flex min-h-[calc(100dvh-120px)] flex-col pt-2">
      {/* Header según el canon (como Hoy: navegación a la izquierda, acción a la
          derecha). La miga es BackLink: honesta con el origen (desde el catálogo
          vuelve a Materiales; desde Hoy, a Hoy). "Índice" abre la hoja de bloques
          y preguntas. */}
      <div className="flex items-center justify-between">
        <BackLink to="/" label={t('nav.hoy')} />
        <div className="flex items-center gap-2">
          {/* Compartir la pregunta como imagen — solo en fichas de pregunta
              (la portada no es contenido compartible). Icono solo: "Índice"
              conserva su etiqueta porque nombra un lugar, no una acción obvia. */}
          {!isIntro && (
            <button
              type="button"
              onClick={() => setShareOpen(true)}
              disabled={sharing}
              aria-label={t('materialReader.share')}
              className="flex h-9 w-9 items-center justify-center text-ink-soft transition-colors hover:text-accent-ink disabled:opacity-50"
            >
              <ShareIcon size={16} />
            </button>
          )}
          <button
            type="button"
            onClick={() => setIndexOpen(true)}
            className="-mr-1 flex h-9 items-center gap-1.5 px-1 text-[13px] font-medium text-ink-soft transition-colors hover:text-accent-ink"
          >
            <ListIcon size={16} />
            {t('materialReader.index')}
          </button>
        </div>
      </div>

      {/* La pregunta como ficha: un .card contiene la unidad de lectura completa
          (metadata, pregunta, respuesta, citas). Navegar = cambiar de ficha dentro
          de un marco estable. La miga y las acciones quedan fuera del contenedor.
          key={n} + screen-enter: al cambiar de pregunta la ficha entra con la misma
          transición que las pantallas de la app (reduced-motion ya cubierto global). */}
      {isIntro ? (
        /* Ficha 0 — portada: contexto histórico. No es una pregunta: no se marca,
           no mueve el marcador. Acá vive el nombre completo del material. */
        <div key="intro" className="screen-enter card mt-6 p-5">
          <p className="text-[13px] font-medium text-ink-soft">{t('materialReader.intro')}</p>
          <h1 className="mt-2.5 text-[20px] font-semibold leading-snug text-ink">
            {content.name}
          </h1>
          <div className="mt-3.5 space-y-3">
            {content.intro.map((p, i) => (
              <p key={i} className="text-[17px] leading-relaxed text-ink">
                {p}
              </p>
            ))}
          </div>
        </div>
      ) : (
      <div key={n} className="screen-enter card mt-6 p-5">
        {/* Una sola línea de metadata: posición y bloque. El estado leída/actual NO
            va acá: ya lo comunica la zona de abajo (botón primario = actual;
            solo navegación = repaso). Cada estado se dice una sola vez. */}
        <p className="text-[13px] font-medium text-ink-soft">
          {[t('materialsToday.questionOf', { n: entry.number, total }), entry.blockTitle].filter(Boolean).join(' · ')}
        </p>

        <h1 className="mt-2.5 text-[20px] font-semibold leading-snug text-ink">
          {entry.question}
        </h1>

        <p className="mt-3.5 text-[17px] leading-relaxed text-ink">{entry.answer}</p>

        {/* Citas de apoyo como nota al pie de la ficha: filete hairline arriba
            (como en un catecismo impreso), sin etiqueta ni cromo. El color acento
            ya dice "tocables"; cada una abre su capítulo en la Biblia. */}
        {entry.refs.length > 0 && (
          <p className="mt-5 border-t border-hairline pt-4 leading-relaxed">
            {entry.refs.map((ref, i) => {
              const url = youVersionUrl(ref, locale)
              const last = i === entry.refs.length - 1
              return (
                // nowrap por pasaje con el "·" pegado al final: el separador cierra
                // renglón, nunca lo abre. El espacio de quiebre va fuera del nowrap.
                <span key={i}>
                  <span className="whitespace-nowrap">
                    {url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block py-1 text-[15px] font-medium transition-opacity active:opacity-50"
                        style={{ color: 'var(--accent-ink)' }}
                      >
                        {bookLabel(ref, locale)}
                      </a>
                    ) : (
                      <span className="text-[15px] text-ink">{bookLabel(ref, locale)}</span>
                    )}
                    {!last && (
                      <span aria-hidden="true" className="text-ink-soft" style={{ opacity: 0.5 }}>
                        {' · '}
                      </span>
                    )}
                  </span>
                  {!last && ' '}
                </span>
              )
            })}
          </p>
        )}
      </div>
      )}

      {completed && !isIntro && (
        <p className="mt-6 text-[14px] text-ink-soft">
          <span aria-hidden="true" style={{ color: 'var(--accent-ink)' }}>✓ </span>
          {t('materialReader.completed')}
        </p>
      )}

      {/* En móvil crece para empujar la barra sticky al fondo; en desktop no crece,
          así la acción queda pegada a la ficha en vez de vararse abajo del viewport. */}
      <div className="flex-1 lg:hidden" />

      {/* Zona de acción (sticky, como en Hoy). Una acción primaria por estado:
          — frontera: marcar como leído
          — repaso: solo navegación
          — completado: navegación + volver a empezar
          Debajo del botón (si lo hay) va SIEMPRE la misma fila de navegación:
          "‹ Anterior" a la izquierda, "Siguiente ›" a la derecha. En la frontera
          no existe Siguiente (avanzar es marcar); la fila conserva posición,
          color y vocabulario para que el gesto de volver no cambie de lugar.
          En desktop se alinea al ancho de la ficha (sin cap de 440px): acá el
          contenido vive en un .card con bordes visibles, así que el botón debe
          quedar a ras de esos bordes, no varado más angosto. */}
      <div className="action-bar space-y-1">
        {saveError && (
          <p className="pb-1 text-[12px]" style={{ color: 'var(--danger)' }}>
            {t('materialReader.saveError')}
          </p>
        )}
        {shareError && (
          <p className="pb-1 text-[12px]" style={{ color: 'var(--danger)' }}>
            {t('materialReader.shareError')}
          </p>
        )}
        {isIntro && pos === 1 ? (
          /* Primera visita (nada leído): la portada invita a arrancar. */
          <button type="button" onClick={() => setN(1)} className="btn btn-primary">
            {t('materialReader.start')}
          </button>
        ) : (
          <>
            {atFrontier && (
              <button type="button" onClick={markRead} className="btn btn-primary">
                {t('hoy.markRead')}
              </button>
            )}
            {(canPrev || canNext) && (
              <div className="flex items-center justify-between">
                {canPrev ? (
                  <button
                    type="button"
                    onClick={() => setN(n - 1)}
                    className="py-2.5 pr-4 text-[15px] font-medium"
                    style={{ color: 'var(--accent-ink)' }}
                  >
                    {/* Desde la pregunta 1 lo anterior es la portada: decirlo. */}
                    ‹ {n === 1 && hasIntro ? t('materialReader.intro') : t('materialReader.previous')}
                  </button>
                ) : (
                  <span />
                )}
                {canNext && (
                  <button
                    type="button"
                    onClick={() => setN(n + 1)}
                    className="py-2.5 pl-4 text-[15px] font-medium"
                    style={{ color: 'var(--accent-ink)' }}
                  >
                    {t('materialReader.next')} ›
                  </button>
                )}
              </div>
            )}
            {completed && (
              <button
                type="button"
                onClick={() => setConfirmRestart(true)}
                className="btn btn-secondary"
              >
                {t('materialReader.restart')}
              </button>
            )}
          </>
        )}
      </div>

      {/* Hoja de compartir: mini-compositor de dos decisiones (estilo y
          formato) con vista previa real — la imagen que ves es la que sale. */}
      {shareOpen && shareData && (
        <ShareSheet data={shareData} onShare={handleShare} onCancel={() => setShareOpen(false)} t={t} />
      )}

      {indexOpen && (
        <MaterialIndexSheet
          content={content}
          frontier={maxN}
          current={n}
          onPick={(num) => {
            setN(num)
            setIndexOpen(false)
          }}
          onClose={() => setIndexOpen(false)}
        />
      )}

      {/* Reiniciar es destructivo (el marcador vuelve a 1 y se re-bloquea el
          resto): pide confirmación, como renovar un plan en Hoy. */}
      {confirmRestart && (
        <ConfirmDialog
          title={t('materialReader.restartTitle')}
          message={t('materialReader.restartMsg')}
          confirmLabel={t('materialReader.restart')}
          onConfirm={() => {
            setConfirmRestart(false)
            restart()
          }}
          onCancel={() => setConfirmRestart(false)}
        />
      )}
    </div>
  )
}

// Hoja de compartir: vista previa REAL (generar la imagen tarda ~50ms, así que
// lo que ves es exactamente lo que sale), estilo en chips con el fondo de cada
// dirección visual, y formato en segmentado. El último estilo/formato usados
// son el punto de partida — memoria de flujo, no preferencia del perfil.
function ShareSheet({ data, onShare, onCancel, t }) {
  const [style, setStyle] = useState(() => {
    try {
      const s = localStorage.getItem(SHARE_STYLE_KEY)
      return QUOTE_STYLES.includes(s) ? s : QUOTE_STYLES[0]
    } catch {
      return QUOTE_STYLES[0]
    }
  })
  const [format, setFormat] = useState(() => {
    try {
      return localStorage.getItem(SHARE_FORMAT_KEY) === 'story' ? 'story' : 'square'
    } catch {
      return 'square'
    }
  })
  const [preview, setPreview] = useState(null)

  // Regenerar la vista previa al cambiar estilo/formato; la URL anterior se
  // revoca al reemplazarla y la última al desmontar (efecto de abajo).
  useEffect(() => {
    let on = true
    buildQuestionImage({ ...data, style, format })
      .then((blob) => {
        if (!on) return
        const url = URL.createObjectURL(blob)
        setPreview((prev) => {
          if (prev) URL.revokeObjectURL(prev)
          return url
        })
      })
      .catch(() => {
        /* la vista previa es adorno: si falla, el botón Compartir sigue vivo */
      })
    return () => {
      on = false
    }
  }, [data, style, format])
  useEffect(
    () => () =>
      setPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      }),
    []
  )

  // Swatch = el fondo real de cada estilo; el de "ficha" es vivo (tema actual)
  // y el de "moderno" lleva su degradé pastel.
  const styles = [
    { id: 'ficha', label: t('materialReader.styleFicha'), swatch: 'var(--surface)', ring: 'var(--hairline)' },
    { id: 'clasico', label: t('materialReader.styleClasico'), swatch: '#F5F0E6', ring: '#A88B6A' },
    { id: 'noche', label: t('materialReader.styleNoche'), swatch: '#12100D', ring: '#C2A57E' },
    {
      id: 'moderno',
      label: t('materialReader.styleModerno'),
      swatch: 'linear-gradient(135deg, #C3B2EA, #9BC5EC)',
      ring: '#7C6BB8',
      gradient: true,
    },
    {
      id: 'vibrante',
      label: t('materialReader.styleVibrante'),
      swatch: 'linear-gradient(135deg, #D97E63, #BE6C9C)',
      ring: '#BE6C9C',
      gradient: true,
    },
  ]

  return (
    <Sheet
      title={t('materialReader.shareTitle')}
      onCancel={onCancel}
      footer={
        <button type="button" onClick={() => onShare(style, format)} className="btn btn-primary">
          {t('materialReader.shareAction')}
        </button>
      }
    >
      <div className="space-y-4 pb-1">
        {/* Vista previa con altura fija: la hoja no salta al pasar de 1:1 a 9:16. */}
        <div className="flex h-[38dvh] items-center justify-center">
          {preview && (
            <img
              src={preview}
              alt=""
              className="max-h-full max-w-full rounded-[10px]"
              style={{ boxShadow: 'var(--shadow-overlay)' }}
            />
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {styles.map((s) => {
            const active = s.id === style
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setStyle(s.id)}
                aria-pressed={active}
                className="flex items-center justify-center gap-2 rounded-input border py-2.5 text-[14px] font-medium text-ink transition-colors"
                style={{
                  borderColor: active ? 'var(--accent)' : 'var(--hairline)',
                  backgroundColor: active ? 'var(--accent-tint)' : 'transparent',
                }}
              >
                <span
                  aria-hidden="true"
                  className="h-4 w-4 rounded-full border"
                  style={{
                    [s.gradient ? 'backgroundImage' : 'backgroundColor']: s.swatch,
                    borderColor: s.ring,
                  }}
                />
                {s.label}
              </button>
            )
          })}
        </div>

        <Segmented
          value={format}
          onChange={setFormat}
          options={[
            { key: 'square', label: t('materialReader.shareSquare') },
            { key: 'story', label: t('materialReader.shareStory') },
          ]}
        />
      </div>
    </Sheet>
  )
}
