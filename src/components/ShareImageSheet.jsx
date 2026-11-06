import { useEffect, useState } from 'react'
import Sheet from './Sheet.jsx'
import Segmented from './Segmented.jsx'
import Switch from './Switch.jsx'
import { usePreferences } from '../lib/preferences.jsx'
import { buildCoverImage, recordCoverVideo, videoMimeType } from '../lib/coverImage.js'
import { buildCarouselImages } from '../lib/carouselImage.js'
import { materialTheme } from '../lib/materialTheme.js'
import InlineError from './InlineError.jsx'
import SectionLabel from './SectionLabel.jsx'

// Último estilo y formato de imagen compartida. Es memoria de flujo, no una
// preferencia del perfil: vive en el dispositivo. Claves compartidas entre todo
// lo que se comparte como imagen (materiales, notas): una sola memoria. Los
// estilos viejos (ficha, clásico, noche, moderno, vibrante) pasan a 'color'.
const SHARE_FORMAT_KEY = 'ltb:shareFormat'
const SHARE_STYLE_KEY = 'ltb:shareStyle'

const revokeAll = (urls) => urls.forEach((u) => URL.revokeObjectURL(u))

// Hoja de compartir como imagen, con vista previa REAL (lo que ves es lo que
// sale). Dos decisiones: estilo (la portada en el color del material, o Papel)
// y formato; y un interruptor para el dato personal ("Día 23"), que viene puesto.
// `data` es la portada ya resuelta en i18n: { slug, spine, number, sub, quote,
// personal, filename }. `onShare(variant, format, { personal })` comparte en el
// contenedor.
//
// `carousel` (opcional): los datos del carrusel cuando la frase NO entra entera
// en una imagen. Suma el formato "Carrusel" y arranca en él — en una sola imagen
// se perdería el texto. No se recuerda: depende de cada entrada.
// `onPickPhrase` (opcional): suma "Elegir una frase" (el lector entra en modo
// selección y vuelve a esta hoja con la frase elegida).
// `onShareVideo(blob)` (opcional): en Historia, "Animada" graba un video de la
// portada (la frase aparece palabra por palabra). Va en dos pasos — preparar y
// después compartir — porque el navegador solo deja abrir la hoja de compartir
// justo después de un toque, y grabar tarda unos segundos.
export default function ShareImageSheet({ data, carousel = null, onShare, onCancel, onPickPhrase = null, onShareVideo = null }) {
  const { t } = usePreferences()
  const [variant, setVariant] = useState(() => {
    try {
      return localStorage.getItem(SHARE_STYLE_KEY) === 'papel' ? 'papel' : 'color'
    } catch {
      return 'color'
    }
  })
  const [format, setFormat] = useState(() => {
    if (carousel) return 'carousel'
    try {
      return localStorage.getItem(SHARE_FORMAT_KEY) === 'story' ? 'story' : 'post'
    } catch {
      return 'post'
    }
  })
  const [withPersonal, setWithPersonal] = useState(true)
  // Con «reducir movimiento» el video «Animada» no arranca solo: queda con controles.
  const reduceMotion = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const [previews, setPreviews] = useState([])
  const personal = withPersonal ? data.personal : null
  const [animated, setAnimated] = useState(false)
  const [video, setVideo] = useState(null) // { blob, url } ya grabado
  const [recording, setRecording] = useState(null) // progreso 0–1 mientras graba
  const [videoError, setVideoError] = useState(false)
  const canVideo = !!onShareVideo && format === 'story' && !!videoMimeType()
  const wantsVideo = canVideo && animated

  // Cualquier cambio invalida el video ya grabado.
  useEffect(
    () => () =>
      setVideo((v) => {
        if (v) URL.revokeObjectURL(v.url)
        return null
      }),
    [data, personal, variant, format, animated]
  )

  async function prepareVideo() {
    if (recording != null) return
    setVideoError(false)
    setRecording(0)
    try {
      const blob = await recordCoverVideo({ ...data, personal, variant }, { onProgress: setRecording })
      setVideo({ blob, url: URL.createObjectURL(blob) })
    } catch {
      setVideoError(true)
    } finally {
      setRecording(null)
    }
  }

  // Regenerar la vista previa al cambiar algo; las URLs anteriores se revocan al
  // reemplazarlas y las últimas al desmontar (efecto de abajo). El carrusel se
  // previsualiza a 1× (es una tira de miniaturas).
  useEffect(() => {
    let on = true
    const build =
      format === 'carousel' && carousel
        ? buildCarouselImages({ ...carousel, personal, variant, scale: 1 })
        : buildCoverImage({ ...data, personal, variant, format, scale: 1 }).then((blob) => [blob])
    build
      .then((blobs) => {
        if (!on) return
        const urls = blobs.map((b) => URL.createObjectURL(b))
        setPreviews((prev) => {
          revokeAll(prev)
          return urls
        })
      })
      .catch(() => {
        /* la vista previa es adorno: si falla, el botón Compartir sigue vivo */
      })
    return () => {
      on = false
    }
  }, [data, carousel, personal, variant, format])
  useEffect(
    () => () =>
      setPreviews((prev) => {
        revokeAll(prev)
        return []
      }),
    []
  )

  // Recordar las decisiones del momento en el dispositivo, y compartir.
  function share() {
    try {
      if (format !== 'carousel') localStorage.setItem(SHARE_FORMAT_KEY, format)
      localStorage.setItem(SHARE_STYLE_KEY, variant)
    } catch {
      /* almacenamiento bloqueado: se comparte igual, sin recordar */
    }
    onShare(variant, format, { personal: withPersonal })
  }

  // Muestra = el fondo real de cada estilo: el color del material, o el hueso
  // de Papel con el lomo del material.
  const th = materialTheme(data.slug)
  const styles = [
    { id: 'color', label: t('share.styleColor'), swatch: th.c, ring: th.spine },
    { id: 'papel', label: t('share.stylePapel'), swatch: '#F8F7F4', ring: th.papelSpine ?? th.c },
  ]

  return (
    <Sheet
      title={t('materialReader.shareTitle')}
      onCancel={onCancel}
      footer={
        wantsVideo ? (
          video ? (
            <button type="button" onClick={() => onShareVideo(video.blob)} className="btn btn-primary">
              {t('share.shareVideo')}
            </button>
          ) : (
            <button
              type="button"
              onClick={prepareVideo}
              disabled={recording != null}
              className="btn btn-primary"
              style={{ opacity: recording != null ? 0.7 : 1 }}
            >
              {recording != null ? t('share.recording', { percent: Math.round(recording * 100) }) : t('share.prepareVideo')}
            </button>
          )
        ) : (
          <button type="button" onClick={share} className="btn btn-primary">
            {t('materialReader.shareAction')}
          </button>
        )
      }
    >
      <div className="space-y-4 pb-1">
        {/* Vista previa con altura fija: la hoja no salta al pasar de 4:5 a 9:16.
            El carrusel es una tira que se desliza, como en Instagram. */}
        {format === 'carousel' ? (
          <div
            className="-mx-5 flex h-[38dvh] snap-x snap-mandatory gap-3 overflow-x-auto px-5 py-1"
            role="group"
            aria-label={t('materialReader.shareCarouselPreview', { n: previews.length })}
          >
            {previews.map((src, i) => (
              <img
                key={src}
                src={src}
                alt=""
                className="h-full w-auto shrink-0 snap-center rounded-[10px]"
                style={{ boxShadow: 'var(--shadow-overlay)', aspectRatio: '4 / 5' }}
                data-slide={i + 1}
              />
            ))}
          </div>
        ) : (
          <div className="flex h-[38dvh] items-center justify-center">
            {video ? (
              <video
                src={video.url}
                autoPlay={!reduceMotion}
                controls={reduceMotion}
                muted
                loop
                playsInline
                className="max-h-full max-w-full rounded-[10px]"
                style={{ boxShadow: 'var(--shadow-overlay)' }}
              />
            ) : previews[0] && (
              <img
                src={previews[0]}
                alt=""
                className="max-h-full max-w-full rounded-[10px]"
                style={{ boxShadow: 'var(--shadow-overlay)' }}
              />
            )}
          </div>
        )}
        {format === 'carousel' && previews.length > 0 && (
          <p className="-mt-1 text-center text-[13px] text-ink-soft">
            {t('materialReader.shareCarouselCount', { n: previews.length })}
          </p>
        )}

        <div>
          <SectionLabel as="p" inside>{t('share.style')}</SectionLabel>
          <div className="grid grid-cols-2 gap-2">
            {styles.map((s) => {
              const active = s.id === variant
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setVariant(s.id)}
                  aria-pressed={active}
                  className="flex items-center justify-center gap-2 rounded-input border py-2.5 text-[14px] font-medium text-ink transition-colors"
                  style={{
                    borderColor: active ? 'var(--accent)' : 'var(--hairline)',
                    backgroundColor: active ? 'var(--accent-tint)' : 'transparent',
                  }}
                >
                  <span
                    aria-hidden="true"
                    className="h-4 w-4 rounded-full border-2"
                    style={{ backgroundColor: s.swatch, borderColor: s.ring }}
                  />
                  {s.label}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <SectionLabel as="p" inside>{t('photo.format')}</SectionLabel>
          <Segmented
            value={format}
            label={t('photo.format')}
            onChange={setFormat}
            options={[
              ...(carousel ? [{ key: 'carousel', label: t('materialReader.shareCarousel') }] : []),
              { key: 'post', label: t('materialReader.sharePost') },
              { key: 'story', label: t('materialReader.shareStory') },
            ]}
          />
        </div>

        {canVideo && (
          <div className="flex items-center justify-between gap-3 px-1">
            <div className="min-w-0">
              <p className="text-[15px] text-ink">{t('share.animated')}</p>
              <p className="text-[13px] text-ink-soft">{t('share.animatedHelp')}</p>
            </div>
            <Switch on={animated} onChange={() => setAnimated((v) => !v)} label={t('share.animated')} />
          </div>
        )}
        {videoError && <InlineError message={t('share.videoError')} className="px-1" />}

        {data.personal && (
          <div className="flex items-center justify-between gap-3 px-1">
            <div className="min-w-0">
              <p className="text-[15px] text-ink">{t('share.showProgress')}</p>
              <p className="text-[13px] text-ink-soft">{data.personal}</p>
            </div>
            <Switch on={withPersonal} onChange={() => setWithPersonal((v) => !v)} label={t('share.showProgress')} />
          </div>
        )}

        {onPickPhrase && (
          <button
            type="button"
            onClick={onPickPhrase}
            className="flex min-h-11 w-full items-center justify-center text-[15px] font-semibold"
            style={{ color: 'var(--accent-ink)' }}
          >
            {t('share.pickPhrase')}
          </button>
        )}
      </div>
    </Sheet>
  )
}
