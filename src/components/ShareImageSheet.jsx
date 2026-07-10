import { useEffect, useState } from 'react'
import Sheet from './Sheet.jsx'
import Segmented from './Segmented.jsx'
import { usePreferences } from '../lib/preferences.jsx'
import { buildQuestionImage, QUOTE_STYLES } from '../lib/shareImage.js'

// Último estilo y formato de imagen compartida. Es memoria de flujo, no una
// preferencia del perfil: vive en el dispositivo. Claves compartidas entre todo
// lo que se comparte como imagen (catecismo, reflexiones): una sola memoria.
const SHARE_FORMAT_KEY = 'ltb:shareFormat'
const SHARE_STYLE_KEY = 'ltb:shareStyle'

// Hoja de compartir como imagen: mini-compositor de dos decisiones (estilo y
// formato) con vista previa REAL (generar la imagen tarda ~50ms, así que lo que
// ves es exactamente lo que sale). `data` es el contenido ya resuelto en i18n
// ({ meta, question, answer, refs }); `onShare(style, format)` dispara el share
// en el contenedor. Nació en el lector de catecismos y lo comparten las
// reflexiones de Mi camino.
export default function ShareImageSheet({ data, onShare, onCancel }) {
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

  // Recordar las decisiones del momento en el dispositivo, y compartir.
  function share() {
    try {
      localStorage.setItem(SHARE_FORMAT_KEY, format)
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
