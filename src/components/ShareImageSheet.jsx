import { useEffect, useState } from 'react'
import Sheet from './Sheet.jsx'
import Segmented from './Segmented.jsx'
import { usePreferences } from '../lib/preferences.jsx'
import { buildCarousel, buildQuestionImage, QUOTE_STYLES } from '../lib/shareImage.js'

// Último estilo y formato de imagen compartida. Es memoria de flujo, no una
// preferencia del perfil: vive en el dispositivo. Claves compartidas entre todo
// lo que se comparte como imagen (catecismo, reflexiones): una sola memoria.
const SHARE_FORMAT_KEY = 'ltb:shareFormat'
const SHARE_STYLE_KEY = 'ltb:shareStyle'

const revokeAll = (urls) => urls.forEach((u) => URL.revokeObjectURL(u))

// Hoja de compartir como imagen: mini-compositor de dos decisiones (estilo y
// formato) con vista previa REAL (generar la imagen tarda ~50ms, así que lo que
// ves es exactamente lo que sale). `data` es el contenido ya resuelto en i18n
// ({ meta, question, answer, refs }); `onShare(style, format)` dispara el share
// en el contenedor. Nació en el lector de catecismos y lo comparten las
// reflexiones de Mi camino.
//
// `carousel` (opcional): los datos de buildCarousel cuando la respuesta NO entra
// entera en una imagen. Suma el formato "Carrusel" y arranca en él — en una
// sola imagen se perdería el texto. No se recuerda: depende de cada entrada.
export default function ShareImageSheet({ data, carousel = null, onShare, onCancel }) {
  const { t } = usePreferences()
  const [style, setStyle] = useState(() => {
    try {
      const s = localStorage.getItem(SHARE_STYLE_KEY)
      return QUOTE_STYLES.includes(s) ? s : QUOTE_STYLES[0]
    } catch {
      return QUOTE_STYLES[0]
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
  const [previews, setPreviews] = useState([])

  // Regenerar la vista previa al cambiar estilo/formato; las URLs anteriores se
  // revocan al reemplazarlas y las últimas al desmontar (efecto de abajo). El
  // carrusel se previsualiza a 1× (es una tira de miniaturas).
  useEffect(() => {
    let on = true
    const build =
      format === 'carousel' && carousel
        ? buildCarousel({ ...carousel, style, scale: 1 })
        : buildQuestionImage({ ...data, style, format }).then((blob) => [blob])
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
  }, [data, carousel, style, format])
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
      localStorage.setItem(SHARE_STYLE_KEY, style)
    } catch {
      /* almacenamiento bloqueado: se comparte igual, sin recordar */
    }
    onShare(style, format)
  }

  // Swatch = el fondo real de cada estilo; el de "ficha" es vivo (tema actual)
  // y los degradés llevan su gradiente real.
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
        <button type="button" onClick={share} className="btn btn-primary">
          {t('materialReader.shareAction')}
        </button>
      }
    >
      <div className="space-y-4 pb-1">
        {/* Vista previa con altura fija: la hoja no salta al pasar de 1:1 a 9:16.
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
            {previews[0] && (
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
            ...(carousel ? [{ key: 'carousel', label: t('materialReader.shareCarousel') }] : []),
            { key: 'post', label: t('materialReader.sharePost') },
            { key: 'story', label: t('materialReader.shareStory') },
          ]}
        />
      </div>
    </Sheet>
  )
}
