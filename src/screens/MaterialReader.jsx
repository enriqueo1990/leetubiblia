import { useEffect, useState } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'
import {
  loadMaterialContent,
  getMaterial,
  entryOfLabel,
  isMaterialActive,
  positionOf,
  withMaterialPosition,
  isCalendarMaterial,
  calendarEntryNumber,
  calendarDayOfMonth,
  readOnOf,
  isReadToday,
  localDateKey,
  withMaterialReadOn,
  withMaterialDeactivated,
} from '../lib/materials.js'
import { passageUrl } from '../lib/bible.js'
import { usePreferences } from '../lib/preferences.jsx'
import { bookLabel } from '../i18n/books.js'
import { coverFits, shareCover } from '../lib/coverImage.js'
import { shareCarousel } from '../lib/carouselImage.js'
import { shareOrDownload, shareUrl } from '../lib/canvasKit.js'
import { carouselSections } from '../lib/carousel.js'
import { joinSentences, splitSentences } from '../lib/sentences.js'
import { excerpt } from '../lib/excerpt.js'
import { ListIcon, ShareIcon, ChevronRight, CheckIcon } from '../components/icons.jsx'
import BookCover from '../components/BookCover.jsx'
import { bookAccentVars, materialTheme } from '../lib/materialTheme.js'
import { BRAND_SERIF, ensureBrandFont } from '../lib/brandFont.js'
import { paragraphs, splitDropCap } from '../lib/dropCap.js'
import BackLink from '../components/BackLink.jsx'
import RetryError from '../components/RetryError.jsx'
import { SkeletonDetail } from '../components/Skeleton.jsx'
import MaterialIndexSheet from '../components/MaterialIndexSheet.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import ShareImageSheet from '../components/ShareImageSheet.jsx'
import InlineError from '../components/InlineError.jsx'

// Vista de lectura de un material (catecismo, etc.) — un lector tipo libro con
// marcador. Se abre en la pregunta actual (la posición guardada). Navegás libremente
// entre las que ya leíste; en la pregunta del frente, "Marcar como leído" avanza el
// marcador (secuencial, sin saltear — como la lectura del plan). El progreso NO toca
// reading_progress: es tu marcador personal del material, nada más.
//
// Diseño (mismo principio que Hoy): metadata callada, contenido protagonista, UNA
// acción por estado. Se lee como un libro: sin ficha, en serif, con la tinta del
// material en la ubicación, los ornamentos y la capitular. La barra es UNA fila
// (‹ · acción · ›): las flechas no se mueven al cambiar de estado y la acción del
// centro dice qué toca — marcar, volver al marcador, volver a empezar. En la
// frontera "Marcar como leído" ocupa el lugar de avanzar (no hay ›).
//
// Materiales por fecha (devocional, cadence 'calendar'): no hay marcador ni
// frontera. Se abre en la lectura de hoy, se navega libremente por todo el año, y
// "Marcar como leído" existe solo en la de hoy (guarda la fecha, readOn). Desde
// otro día, la acción es volver a la de hoy.
// Una cita como enlace a la Biblia (o texto, si no hay enlace posible).
function RefLink({ refItem, locale, bibleProvider }) {
  const url = passageUrl(refItem, locale, bibleProvider)
  const label = bookLabel(refItem, locale)
  if (!url) return <span className="whitespace-nowrap text-[0.9375rem] font-medium text-ink-soft">{label}</span>
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="whitespace-nowrap text-[0.9375rem] font-medium transition-opacity active:opacity-50"
      style={{ color: 'var(--accent-ink)' }}
    >
      {label}
    </a>
  )
}

// Agrupa las citas consecutivas del mismo párrafo (`ref.p`); sin `p`, un solo grupo.
function refGroups(refs) {
  const groups = []
  for (const ref of refs) {
    const p = ref.p ?? null
    const last = groups[groups.length - 1]
    if (last && last.p === p) last.refs.push(ref)
    else groups.push({ p, refs: [ref] })
  }
  return groups
}

// Ornamento de libro entre el encabezado y el texto: dos filetes y un rombo,
// en la tinta del material.
function BookOrnament({ className = '' }) {
  return (
    <svg width="120" height="12" viewBox="0 0 120 12" aria-hidden="true" className={`mx-auto block ${className}`}>
      <path d="M0 6h50M70 6h50" stroke="var(--book-acc)" strokeOpacity="0.45" strokeWidth="1" />
      <path d="M60 1l5 5-5 5-5-5z" fill="var(--book-acc)" />
    </svg>
  )
}

// Texto corrido de libro: un párrafo por bloque y capitular en el primero
// (si `dropCap`). Los párrafos que traen su número ("6. Todo el consejo…", como
// en la Confesión de 1689) lo llevan al margen, como en una edición impresa.
function BookText({ text, size = 'md', dropCap = true, className = '' }) {
  const paras = paragraphs(text).map((p) => {
    const m = p.match(/^(\d+)\.\s+([\s\S]*)$/)
    return m ? { num: m[1], text: m[2] } : { num: null, text: p }
  })
  const numbered = paras.some((p) => p.num)
  const cap = dropCap ? splitDropCap(paras[0]?.text) : null
  const body = (p, i) =>
    i === 0 && cap ? (
      <>
        <span className="book-dropcap">
          {cap.punct && <span className="book-dropcap-punct">{cap.punct}</span>}
          {cap.letter}
        </span>
        {cap.rest}
      </>
    ) : (
      p.text
    )
  return (
    <div lang="es" className={`book-text book-text-${size} ${className}`}>
      {paras.map((p, i) =>
        numbered ? (
          <div key={i} className="book-num-row">
            <span className="book-num">{p.num}</span>
            <p>{body(p, i)}</p>
          </div>
        ) : (
          <p key={i}>{body(p, i)}</p>
        )
      )}
    </div>
  )
}

// Catecismos: la capitular solo cuando la respuesta da para envolverla (unos
// cuatro renglones); en una de dos renglones se comería la respuesta.
const CATECHISM_DROPCAP_MIN = 220

// Una frase para compartir, no un párrafo: hasta ~3 oraciones.
const PHRASE_MAX = 320

export default function MaterialReader() {
  const { slug } = useParams()
  const { profile, updateProfile } = useAuth()
  const { t, locale, bibleProvider } = usePreferences()

  const [content, setContent] = useState(null) // null = cargando
  const [notFound, setNotFound] = useState(false)
  const [loadError, setLoadError] = useState(false) // falló el import del material
  const [attempt, setAttempt] = useState(0)
  const [pos, setPos] = useState(null) // marcador optimista (próxima sin leer, 1-based)
  const [n, setN] = useState(null) // pregunta que se está viendo
  const [indexOpen, setIndexOpen] = useState(false) // hoja de índice
  const [confirmRestart, setConfirmRestart] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false) // "Quitar del estante"
  const [saveError, setSaveError] = useState(false) // falló guardar el avance
  const [shareSnap, setShareSnap] = useState(null) // hoja de compartir abierta: { data, carousel }
  const [pick, setPick] = useState(null) // "Elegir una frase": { start, end } (índices de oración) o null
  const [sharing, setSharing] = useState(false) // generando la imagen para compartir
  const [shareError, setShareError] = useState(false)
  const [confirmUnmark, setConfirmUnmark] = useState(false) // por fecha: desmarcar la de hoy
  useEffect(() => setPick(null), [n])
  // La serif de libro (Newsreader) para la portada y el devocional.
  useEffect(() => {
    ensureBrandFont()
  }, [])
  // Ficha a la que se llegó al marcar leída: mientras estés en ella, una línea
  // confirma que el marcador avanzó. Al navegar a otra ficha se va sola.
  const [markedFor, setMarkedFor] = useState(null)
  useEffect(() => {
    setMarkedFor((m) => (m === n ? m : null))
  }, [n])
  const calendar = isCalendarMaterial(slug)
  const today = calendarEntryNumber()
  const [readToday, setReadToday] = useState(null) // por fecha: ¿ya se marcó hoy? (optimista)

  // Cargar el contenido (import dinámico, cacheado).
  useEffect(() => {
    let on = true
    setLoadError(false)
    loadMaterialContent(slug)
      .then((c) => {
        if (!on) return
        if (!c) setNotFound(true)
        else setContent(c)
      })
      // Sin red, o un chunk viejo tras un deploy: avisar con reintento en vez de
      // dejar el skeleton para siempre.
      .catch(() => on && setLoadError(true))
    return () => {
      on = false
    }
  }, [slug, attempt])

  // Sembrar el marcador desde el perfil una sola vez (después queda local/optimista).
  useEffect(() => {
    if (pos != null) return
    const saved = positionOf(profile, slug)
    if (saved != null) setPos(saved)
  }, [profile, slug, pos])

  useEffect(() => {
    if (!calendar || readToday != null || !profile) return
    setReadToday(isReadToday(profile, slug))
  }, [calendar, readToday, profile, slug])

  // Abrir en la pregunta actual (marcador), acotada al total. Si todavía no leyó
  // nada y el material tiene introducción, abrir en la portada (n=0). Por fecha:
  // en la lectura de hoy (o en la portada, si nunca marcó ninguna).
  useEffect(() => {
    if (n != null || pos == null || !content) return
    const hasIntro = Array.isArray(content.intro) && content.intro.length > 0
    if (calendar) {
      setN(!readOnOf(profile, slug) && hasIntro ? 0 : Math.min(today, content.total))
      return
    }
    setN(pos === 1 && hasIntro ? 0 : Math.min(pos, content.total))
  }, [n, pos, content, calendar, profile, slug, today])

  // Al cambiar de pregunta, volver arriba: si la anterior era larga y quedaste
  // scrolleado, la ficha nueva se lee desde el título (salto instantáneo, sin
  // animación de scroll — es lectura, no espectáculo).
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [n])

  // Slug inexistente, o material que el usuario no activó → volver al catálogo.
  if (notFound) return <Navigate to="/materiales" replace />
  if (profile && !isMaterialActive(profile, slug)) return <Navigate to="/materiales" replace />

  if (loadError && !content) {
    return (
      <div className="pt-2">
        <BackLink to="/materiales" label={t('nav.materiales')} />
        <RetryError message={t('common.loadError')} onRetry={() => setAttempt((x) => x + 1)} />
      </div>
    )
  }

  if (!content || pos == null || n == null) {
    return <SkeletonDetail />
  }

  const total = content.total
  const hasIntro = Array.isArray(content.intro) && content.intro.length > 0
  const isIntro = n === 0 // "ficha 0": portada con contexto histórico, sin marcador
  const entry = isIntro ? null : content.entries[n - 1]
  // Con `headingRef`, la primera cita es la del versículo del encabezado y se
  // muestra junto a él; el pie queda para las demás (si las hay).
  const headingRef = content.headingRef && entry?.refs.length ? entry.refs[0] : null
  const footRefs = entry ? (headingRef ? entry.refs.slice(1) : entry.refs) : []
  const completed = !calendar && pos > total
  const sentences = pick && entry ? splitSentences(entry.answer) : []
  const atFrontier = calendar ? n === today && !readToday : !completed && n === pos // lista para marcar
  const maxN = calendar ? total : Math.min(pos, total) // no se avanza más allá de lo leído (+ la del frente)
  const canPrev = n > (hasIntro ? 0 : 1)
  const canNext = n < maxN
  const justMarked = !calendar && markedFor === n // acaba de marcar y sigue en esta ficha
  // Todo material se lee como un libro (sin ficha, texto en serif), con tres
  // formas según el género: el devocional (versículo como epígrafe, capitular,
  // firma), el catecismo (pregunta y respuesta; capitular solo si la respuesta
  // es larga) y la confesión (título del capítulo o artículo, capitular, párrafos
  // numerados al margen).
  const unit = getMaterial(slug)?.unit ?? 'question'
  const genre = calendar ? 'devotional' : unit === 'question' ? 'catechism' : 'confession'
  const tomorrow = calendar && n === today && n < total ? content.entries[n] : null
  // Portada: el pie de la tapa ("C. H. Spurgeon · 1865") y la cantidad debajo.
  const th = materialTheme(slug)
  const coverByline = [th.byline, th.year].filter(Boolean).join(' · ') || null
  const coverCount = t(`library.count.${unit}`, { count: total })

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
      setMarkedFor(null)
      setSaveError(true)
    }
  }

  function markRead() {
    const next = n + 1
    const revertPos = pos
    const revertN = n
    setPos(next)
    setMarkedFor(n < total ? n + 1 : n)
    if (n < total) setN(n + 1) // avanza a la siguiente; si era la última, queda completado
    persist(next, revertPos, revertN)
  }

  // Por fecha: marcar/desmarcar la de hoy guarda solo la fecha (readOn).
  async function setTodayRead(value) {
    setReadToday(value)
    setSaveError(false)
    const { error } = await updateProfile({
      active_materials: withMaterialReadOn(profile, slug, value ? localDateKey() : null),
    })
    if (error) {
      setReadToday(!value)
      setSaveError(true)
    }
  }

  function restart() {
    const revertPos = pos
    const revertN = n
    setPos(1)
    setN(hasIntro ? 0 : 1) // volver a empezar = volver a la portada
    persist(1, revertPos, revertN)
  }

  // La portada de esta entrada (la i18n se resuelve acá: el módulo de dibujo
  // recibe textos ya armados). `quote` = la frase elegida; sin ella, la respuesta
  // entera (un devocional por fecha comparte su primer párrafo: la meditación
  // completa va en el carrusel). Los catecismos no se recortan.
  const isDay = getMaterial(slug)?.unit === 'day'
  const stripRange = (q) => q.replace(/\s*\(\d+[–-]\d+\)\s*$/, '') // "(1–5)" sobra en la tapa
  function coverData(quote = null) {
    const read = pos - 1 // entradas ya leídas: el dato personal ("Llevo 42 de 129")
    return {
      slug,
      spine: content.name,
      number: isDay ? entryOfLabel(t, slug, entry.number, total, locale) : String(entry.label ?? entry.number),
      sub: isDay ? (headingRef ? bookLabel(headingRef, locale) : null) : stripRange(entry.question),
      quote: quote ?? (isDay ? excerpt(entry.answer) : entry.answer),
      personal: !calendar && read > 0 ? t('share.personalMaterial', { n: Math.min(read, total), total }) : null,
    }
  }

  // Carrusel: solo cuando la respuesta COMPLETA no entra en una portada (1689,
  // artículos largos de la Belga, la meditación entera de un devocional). Va
  // completa, repartida en láminas; la portada única sigue con su recorte.
  async function carouselData(data) {
    if (await coverFits({ ...data, quote: entry.answer })) return null
    const label = (ref) => bookLabel(ref, locale)
    // Con headingRef (devocional), el título ES el versículo: su cita va en la
    // portada, debajo, y no se repite al final del texto (como en el lector).
    const sections = carouselSections({ ...entry, refs: footRefs }, label)
    const numbered = sections.some((s) => s.label)
    // Pocas citas se nombran ("Romanos 1:20 · Salmo 19:1"); muchas, se cuentan.
    const refsNote = headingRef
      ? label(headingRef)
      : entry.refs.length > 3
        ? t('materialReader.carouselRefs', { count: entry.refs.length })
        : entry.refs.map(label).join(' · ')
    const nextEntry = !calendar ? content.entries[n] : null
    return {
      slug,
      spine: content.name,
      number: data.number,
      title: isDay ? entry.question : stripRange(entry.question),
      coverNote: [numbered && t('materialReader.carouselParagraphs', { count: sections.length }), refsNote]
        .filter(Boolean)
        .join(' · '),
      sections,
      next: nextEntry ? stripRange(nextEntry.question) : null,
      inviteTitle: t('share.inviteTitle', { name: getMaterial(slug)?.shortName ?? content.name }),
      personal: data.personal,
      labels: {
        swipe: t('materialReader.carouselSwipe'),
        more: t('materialReader.carouselMore'),
        cont: t('materialReader.carouselCont'),
        refsLabel: t('share.refsLabel'),
        next: t('share.nextUp'),
        markRead: t('hoy.markRead'),
        free: t('materialReader.carouselInviteFree'),
      },
    }
  }

  // La hoja recibe una foto fija de los datos al abrirse: así la vista previa
  // no se regenera con cada render del lector (el carrusel son varias láminas).
  async function openShare() {
    const data = coverData()
    setShareSnap({ data, carousel: await carouselData(data) })
  }

  // "Elegir una frase": la hoja se cierra y la ficha entra en modo selección;
  // al confirmar, la hoja vuelve con la frase elegida como protagonista.
  function startPicking() {
    setShareSnap(null)
    setPick({ start: null, end: null })
  }
  function sharePhrase() {
    const quote = joinSentences(sentences, pick.start, pick.end)
    setPick(null)
    setShareSnap({ data: coverData(quote), carousel: null })
  }
  // Tocar una oración la elige; tocar otra extiende el rango hasta ella (las
  // frases van seguidas). Tocar dentro de un rango ya armado vuelve a empezar.
  function tapSentence(i) {
    setPick((p) => {
      const lo = Math.min(p.start ?? i, p.end ?? i)
      const hi = Math.max(p.start ?? i, p.end ?? i)
      if (p.start == null || (i >= lo && i <= hi && lo !== hi)) return { start: i, end: i }
      const start = Math.min(lo, i)
      const end = Math.max(hi, i)
      // Una frase, no un párrafo.
      if (joinSentences(sentences, start, end).length > PHRASE_MAX) return p
      return { start, end }
    })
  }

  // La historia animada ya grabada en la hoja: se comparte con el toque nuevo.
  async function shareVideo(blob) {
    setShareSnap(null)
    setShareError(false)
    try {
      await shareOrDownload(
        [{ blob, filename: `${slug}-${entry.number}-historia.mp4` }],
        t('shareImage.fromApp', { url: shareUrl('material') }),
      )
    } catch {
      setShareError(true)
    }
  }

  // Compartir con el estilo y formato elegidos en la hoja (la hoja misma los
  // recuerda en el dispositivo).
  async function handleShare(variant, format, { personal }) {
    if (sharing || !shareSnap) return
    const { data, carousel } = shareSnap
    setShareSnap(null)
    setSharing(true)
    setShareError(false)
    const text = t('shareImage.fromApp', { url: shareUrl('material') })
    try {
      if (format === 'carousel' && carousel) {
        await shareCarousel({
          ...carousel,
          personal: personal ? carousel.personal : null,
          variant,
          text,
          filename: `${slug}-${entry.number}`,
        })
      } else {
        await shareCover({
          ...data,
          personal: personal ? data.personal : null,
          variant,
          format,
          text,
          filename: `${slug}-${entry.number}${format === 'story' ? '-historia' : ''}.png`,
        })
      }
    } catch {
      setShareError(true)
    } finally {
      setSharing(false)
    }
  }

  // Encabezado de la entrada según el género. La confesión con sección propia
  // ("Capítulo 1, párrafos 1–5") la usa como ubicación; el resto, su número.
  const kicker = entry && (genre === 'confession' && entry.section ? entry.section : entryOfLabel(t, slug, entry.number, total, locale))
  const kickerSub = entry && genre !== 'devotional' && !entry.section ? entry.blockTitle : null
  const bodySize = genre === 'catechism' ? 'lg' : 'md'
  const dropCap = genre !== 'catechism' || (entry?.answer.length ?? 0) >= CATECHISM_DROPCAP_MIN
  // "Volver a la pregunta 12" / "Volver al artículo 12" / "Volver a donde ibas"
  // (los materiales por 'item' no numeran igual que el marcador).
  const backToLabel = calendar ? null : t(`materialReader.backTo.${unit}`, { n: Math.min(pos, total) })

  return (
    <div className="book relative isolate flex min-h-[calc(100dvh-120px)] flex-col pt-2" style={bookAccentVars(slug)}>
      {/* El devocional es de la mañana: la misma luz cálida de Hoy a esa hora. */}
      {calendar && <div aria-hidden="true" className="day-light morning" />}
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
              onClick={openShare}
              disabled={sharing}
              aria-label={t('materialReader.share')}
              className="flex h-11 w-11 items-center justify-center text-ink-soft transition-colors hover:text-accent-ink disabled:opacity-50"
            >
              <ShareIcon size={16} />
            </button>
          )}
          <button
            type="button"
            onClick={() => setIndexOpen(true)}
            className="-mr-2 flex min-h-11 items-center gap-1.5 px-2 text-[0.8125rem] font-medium text-ink-soft transition-colors hover:text-accent-ink"
          >
            <ListIcon size={16} />
            {t('materialReader.index')}
          </button>
        </div>
      </div>

      {/* La entrada como página de libro (ubicación, título, texto, citas al pie).
          key={n} + screen-enter: al cambiar de entrada la página entra con la
          misma transición que las pantallas de la app (reduced-motion ya cubierto). */}
      {/* Anuncia la ficha nueva al marcar leída (el foco se queda en el botón). Fuera
          de la ficha con key: esa se remonta y un aviso recién montado no se lee. */}
      <p role="status" className="sr-only">
        {!isIntro && entry
          ? `${justMarked ? `${t('materialReader.markedNote')} ` : ''}${entryOfLabel(t, slug, entry.number, total, locale)}${entry.question ? ` · ${entry.question}` : ''}`
          : ''}
      </p>

      {isIntro ? (
        /* Ficha 0 — portada: contexto histórico. No es una pregunta: no se marca,
           no mueve el marcador. Acá vive el nombre completo del material. */
        <div key="intro" className="screen-enter mt-5">
          {/* La tapa grande, como al abrir un libro de la colección. */}
          <BookCover slug={slug} size="hero" meta={coverByline} className="mx-auto w-[196px]" />
          <div className="mt-7 text-center">
            <h1 className="text-[1.75rem] font-medium leading-[1.1] tracking-[-0.01em] text-ink" style={{ fontFamily: BRAND_SERIF }}>
              {content.name}
            </h1>
            {content.author && <p className="mt-1.5 text-[0.9375rem] text-ink-soft">{content.author}</p>}
            {coverCount && <p className="mt-1 text-[0.8125rem] text-ink-soft">{coverCount}</p>}
            {locale !== 'es' && <p className="mt-1 text-[0.75rem] text-ink-soft">{t('materiales.inSpanish')}</p>}
            <BookOrnament className="mt-5" />
          </div>
          <p className="sr-only">{t('materialReader.intro')}</p>
          <BookText text={content.intro.join('\n\n')} small className="mt-5" />
        </div>
      ) : (
      <div key={n} className="screen-enter mt-5">
        {/* Una línea de ubicación arriba (la fecha, la pregunta, el capítulo) y,
            si hace falta, el bloque debajo. El estado leída/actual NO va acá: ya
            lo comunica la barra de abajo. Cada estado se dice una sola vez. */}
        <div className="px-1 text-center">
          <p className="book-kicker">{kicker}</p>
          {kickerSub && <p className="mt-1 text-[0.8125rem] text-ink-soft">{kickerSub}</p>}
          {genre === 'devotional' ? (
            /* El versículo como epígrafe, la cita debajo. */
            <>
              <h1
                lang="es"
                className="mt-3.5 text-[1.5625rem] italic leading-[1.25] tracking-[-0.01em] text-ink"
                style={{ fontFamily: BRAND_SERIF, fontWeight: 400, textWrap: 'balance' }}
              >
                {entry.question}
              </h1>
              {headingRef && (
                <p className="mt-1.5 flex min-h-9 items-center justify-center">
                  <RefLink refItem={headingRef} locale={locale} bibleProvider={bibleProvider} />
                </p>
              )}
            </>
          ) : genre === 'catechism' ? (
            <h1
              lang="es"
              className="mt-4 text-[1.625rem] leading-[1.22] tracking-[-0.01em] text-ink"
              style={{ fontFamily: BRAND_SERIF, fontWeight: 600, textWrap: 'balance' }}
            >
              {entry.question}
            </h1>
          ) : (
            <h1
              lang="es"
              className="mt-3 text-[1.875rem] leading-[1.15] tracking-[-0.015em] text-ink"
              style={{ fontFamily: BRAND_SERIF, fontWeight: 500, textWrap: 'balance' }}
            >
              {stripRange(entry.question)}
            </h1>
          )}
          <BookOrnament className={genre === 'devotional' ? 'mt-2' : 'mt-4'} />
        </div>

        {pick ? (
          // Modo "Elegir una frase": cada oración se toca; el rango elegido se
          // resalta con el tinte del acento. Los párrafos conservan su aire.
          <div className={`book-text book-text-${bodySize} mt-6`}>
            {[...new Set(sentences.map((x) => x.para))].map((para) => (
              <p key={para}>
                {sentences.map((x, i) => {
                  if (x.para !== para) return null
                  const lo = Math.min(pick.start ?? -1, pick.end ?? -1)
                  const hi = Math.max(pick.start ?? -1, pick.end ?? -1)
                  const on = pick.start != null && i >= lo && i <= hi
                  return (
                    // En línea (no <button>, que corta el renglón): el texto fluye
                    // como al leer; el resaltado sigue los renglones.
                    <span key={i}>
                      <span
                        role="button"
                        tabIndex={0}
                        aria-pressed={on}
                        onClick={() => tapSentence(i)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            tapSentence(i)
                          }
                        }}
                        className="cursor-pointer rounded-[4px] transition-colors"
                        style={{
                          backgroundColor: on ? 'var(--accent-tint)' : 'transparent',
                          boxDecorationBreak: 'clone',
                          WebkitBoxDecorationBreak: 'clone',
                          padding: '2px 0',
                        }}
                      >
                        {x.text}
                      </span>{' '}
                    </span>
                  )
                })}
              </p>
            ))}
          </div>
        ) : (
          <BookText text={entry.answer} size={bodySize} dropCap={dropCap} className="mt-6" />
        )}

        {content.author && (
          /* La firma al pie, como en el libro. Provisoria en texto: va a ser la
             firma manuscrita de Spurgeon (dominio público) cuando esté el escaneo. */
          <div className="mt-6 flex flex-col items-end pr-1">
            <p className="text-[1.5rem] italic leading-none text-ink" style={{ fontFamily: BRAND_SERIF }}>
              {content.author}
            </p>
            <p className="mt-2 text-[0.625rem] font-bold uppercase tracking-[0.2em] text-ink-soft">
              {[getMaterial(slug)?.shortName, th.year].filter(Boolean).join(' · ')}
            </p>
          </div>
        )}

        {/* Citas de apoyo como nota al pie de la ficha: filete hairline arriba
            (como en un catecismo impreso), sin etiqueta ni cromo. El color acento
            ya dice "tocables"; cada una abre su capítulo en la Biblia. Si la
            entrada junta varios párrafos (p. ej. un capítulo de la 1689), cada
            cita trae su párrafo (`p`) y van en un renglón por párrafo, con su
            número delante, como las notas de una confesión impresa. */}
        {footRefs.length > 0 && (
          <div className="mt-5 space-y-1 border-t border-hairline pt-4">
            {refGroups(footRefs).map((g, gi) => (
              <p key={gi} className="leading-relaxed">
                {g.p != null && (
                  <span className="mr-2 text-[0.8125rem] font-medium tabular-nums text-ink-soft">{g.p}</span>
                )}
                {g.refs.map((ref, i) => {
                  const url = passageUrl(ref, locale, bibleProvider)
                  const last = i === g.refs.length - 1
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
                            className="inline-block py-1 text-[0.9375rem] font-medium transition-opacity active:opacity-50"
                            style={{ color: 'var(--accent-ink)' }}
                          >
                            {bookLabel(ref, locale)}
                          </a>
                        ) : (
                          <span className="text-[0.9375rem] text-ink">{bookLabel(ref, locale)}</span>
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
            ))}
          </div>
        )}
        {/* Devocional: cierre con ornamento y lo que viene mañana. */}
        {tomorrow && !pick && (
          <>
            <BookOrnament className="mt-8" />
            <p className="mb-6 mt-3.5 text-center text-[0.8125rem] leading-snug text-ink-soft">
              {t('materialReader.tomorrow', { title: tomorrow.question })}
            </p>
          </>
        )}
      </div>
      )}

      {completed && !isIntro && (
        <p className="mt-6 text-[0.875rem] text-ink-soft">
          <span aria-hidden="true" style={{ color: 'var(--accent-ink)' }}>✓ </span>
          {t('materialReader.completed')}
        </p>
      )}

      {/* En móvil crece para empujar la barra sticky al fondo; en desktop no crece,
          así la acción queda pegada a la ficha en vez de vararse abajo del viewport. */}
      <div className="flex-1 lg:hidden" />

      {/* Zona de acción (sticky, como en Hoy), en una sola fila ‹ · acción · ›:
          — frontera: marcar como leído
          — repaso: volver al marcador
          — completado: volver a empezar
          — por fecha: marcar la de hoy / leída hoy / ir a la de hoy */}
      <div className="action-bar space-y-1">
        {saveError && (
          <p className="pb-1 text-[0.75rem]" role="alert" style={{ color: 'var(--danger)' }}>
            {t('materialReader.saveError')}
          </p>
        )}
        {shareError && <InlineError message={t('materialReader.shareError')} className="pb-1" />}
        {pick ? (
          <>
            <p className="pb-1 text-center text-[0.8125rem] text-ink-soft">{t('share.pickHint')}</p>
            <button
              type="button"
              onClick={sharePhrase}
              disabled={pick.start == null}
              className="btn btn-primary"
            >
              {t('share.sharePhrase')}
            </button>
            <button
              type="button"
              onClick={() => setPick(null)}
              className="block w-full py-2 text-center text-[0.9375rem] font-medium text-ink-soft"
            >
              {t('common.cancel')}
            </button>
          </>
        ) : calendar && isIntro ? (
          /* Por fecha, la portada siempre lleva a la lectura de hoy. */
          <button type="button" onClick={() => setN(today)} className="btn btn-primary">
            {t('materialReader.startToday', { date: entryOfLabel(t, slug, today, total, locale) })}
          </button>
        ) : isIntro && pos === 1 ? (
          /* Primera visita (nada leído): la portada invita a arrancar. */
          <button type="button" onClick={() => setN(1)} className="btn btn-primary">
            {t('materialReader.start')}
          </button>
        ) : (
          /* UNA fila — ‹ · acción · › — para que la barra no se coma la lectura.
             La acción del centro cambia con el estado; las flechas guardan su
             lugar aunque no haya adónde ir (en la frontera de un catecismo no hay
             ›: avanzar es marcar). */
          <>
            {justMarked && atFrontier && (
              <p className="moment-in pb-1.5 text-center text-[0.8125rem] font-medium text-ink-soft">
                <span aria-hidden="true" style={{ color: 'var(--accent-ink)' }}>✓ </span>
                {t('materialReader.markedNote')}
              </p>
            )}
            <div className="-mx-3 flex items-center gap-1">
              {canPrev ? (
                <button
                  type="button"
                  onClick={() => setN(n - 1)}
                  aria-label={n === 1 && hasIntro ? t('materialReader.intro') : t('materialReader.previous')}
                  className="flex h-12 w-11 shrink-0 items-center justify-center transition-opacity active:opacity-50"
                  style={{ color: 'var(--accent-ink)' }}
                >
                  <ChevronRight size={22} style={{ transform: 'scaleX(-1)' }} />
                </button>
              ) : (
                <span className="w-11 shrink-0" />
              )}
              {atFrontier ? (
                <button
                  type="button"
                  onClick={calendar ? () => setTodayRead(true) : markRead}
                  className="btn btn-primary min-w-0 flex-1"
                >
                  {t('hoy.markRead')}
                </button>
              ) : calendar && n === today ? (
                /* Ya leída hoy: el estado ocupa el lugar del botón; tocarlo pregunta
                   si desmarcar (un toque al pasar no la desmarca). */
                <button
                  type="button"
                  onClick={() => setConfirmUnmark(true)}
                  aria-label={t('materialReader.readTodayAria')}
                  className="btn btn-done flex min-w-0 flex-1 items-center justify-center gap-2"
                  style={{ color: 'var(--accent-ink)' }}
                >
                  <CheckIcon size={18} strokeWidth={2.4} />
                  {t('materialReader.readToday')}
                </button>
              ) : calendar ? (
                <button type="button" onClick={() => setN(today)} className="btn btn-secondary min-w-0 flex-1">
                  {t('materialReader.goToday')}
                </button>
              ) : completed ? (
                <button type="button" onClick={() => setConfirmRestart(true)} className="btn btn-secondary min-w-0 flex-1">
                  {t('materialReader.restart')}
                </button>
              ) : (
                /* Repasando una anterior: volver directo al marcador. */
                <button type="button" onClick={() => setN(Math.min(pos, total))} className="btn btn-secondary min-w-0 flex-1">
                  {backToLabel}
                </button>
              )}
              {canNext ? (
                <button
                  type="button"
                  onClick={() => setN(n + 1)}
                  aria-label={t('materialReader.next')}
                  className="flex h-12 w-11 shrink-0 items-center justify-center transition-opacity active:opacity-50"
                  style={{ color: 'var(--accent-ink)' }}
                >
                  <ChevronRight size={22} />
                </button>
              ) : (
                <span className="w-11 shrink-0" />
              )}
            </div>
          </>
        )}
      </div>

      {/* Hoja de compartir: mini-compositor de dos decisiones (estilo y
          formato) con vista previa real — la imagen que ves es la que sale. */}
      {shareSnap && (
        <ShareImageSheet
          data={shareSnap.data}
          carousel={shareSnap.carousel}
          onShare={handleShare}
          onCancel={() => setShareSnap(null)}
          onPickPhrase={entry && splitSentences(entry.answer).length > 1 ? startPicking : null}
          onShareVideo={shareVideo}
        />
      )}

      {indexOpen && (
        <MaterialIndexSheet
          content={content}
          frontier={maxN}
          current={n}
          numberOf={calendar ? (e) => calendarDayOfMonth(e.number) : undefined}
          onPick={(num) => {
            setN(num)
            setIndexOpen(false)
          }}
          onClose={() => setIndexOpen(false)}
          onRemove={() => {
            setIndexOpen(false)
            setConfirmRemove(true)
          }}
        />
      )}
      {/* Quitar del estante borra el marcador (al volver a agregarlo empieza de
          nuevo): se confirma. Al quitarlo, el lector vuelve solo a la Biblioteca. */}
      {confirmRemove && (
        <ConfirmDialog
          title={content.name}
          message={t('materiales.confirmOff')}
          confirmLabel={t('library.removeConfirm')}
          danger
          onConfirm={async () => {
            setConfirmRemove(false)
            const { error } = await updateProfile({ active_materials: withMaterialDeactivated(profile, slug) })
            if (error) setSaveError(true)
          }}
          onCancel={() => setConfirmRemove(false)}
        />
      )}

      {confirmUnmark && (
        <ConfirmDialog
          title={t('materialReader.unmarkTitle')}
          message={t('materialReader.unmarkMsg')}
          confirmLabel={t('hoy.unmarkConfirm')}
          onConfirm={() => {
            setConfirmUnmark(false)
            setTodayRead(false)
          }}
          onCancel={() => setConfirmUnmark(false)}
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
