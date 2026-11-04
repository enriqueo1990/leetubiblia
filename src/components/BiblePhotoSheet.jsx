import { useEffect, useRef, useState } from 'react'
import Sheet from './Sheet.jsx'
import Segmented from './Segmented.jsx'
import InlineError from './InlineError.jsx'
import { usePreferences } from '../lib/preferences.jsx'
import { buildBiblePhoto, decodePhoto } from '../lib/biblePhotoImage.js'
import { shareOrDownload, shareUrl } from '../lib/canvasKit.js'

const LAYER_KEY = 'ltb:photoLayer'
const POSITION_KEY = 'ltb:photoPosition'
const read = (key, allowed, fallback) => {
  try {
    const v = localStorage.getItem(key)
    return allowed.includes(v) ? v : fallback
  } catch {
    return fallback
  }
}

// "Tu Biblia, hoy": compartir la lectura con una foto de tu Biblia de papel. La
// persona saca (o elige) la foto; la app le pone una capa encima — el dato del
// día, una versión mínima, o su nota — del lado que no tapa la Biblia. Todo se
// arma en el teléfono: la foto no se sube a ningún lado (se dice en la hoja).
// `data`: { passage, day, daysRead, streak, note } ya resueltos.
export default function BiblePhotoSheet({ data, onClose }) {
  const { t, locale } = usePreferences()
  const inputRef = useRef(null)
  const [photo, setPhoto] = useState(null)
  const [photoError, setPhotoError] = useState(false)
  const layers = ['dato', 'minimo', ...(data.note ? ['nota'] : [])]
  const [layer, setLayer] = useState(() => read(LAYER_KEY, layers, 'dato'))
  const [format, setFormat] = useState('story')
  const [position, setPosition] = useState(() => read(POSITION_KEY, ['top', 'bottom'], 'top'))
  const [preview, setPreview] = useState(null)
  const [sharing, setSharing] = useState(false)
  const [shareError, setShareError] = useState(false)

  const now = new Date()
  const imageData = {
    passage: data.passage,
    dateLabel: capitalize(now.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })),
    timeLabel: now.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' }),
    note: data.note,
    daysRead: data.daysRead,
    streak: data.streak,
    labels: {
      kicker: t('photo.kicker'),
      daysRead: t('photo.daysRead', { count: data.daysRead }),
      streak: t('photo.streak', { count: data.streak }),
      noteKicker: t('photo.noteKicker'),
      dayN: t('planes.dayN', { n: data.day }),
    },
  }
  // La fecha y la hora se fijan al abrir (no cambian mientras elegís).
  const [frozen] = useState(imageData)

  useEffect(() => {
    if (!photo) return
    let on = true
    buildBiblePhoto({ photo, layer, format, position, data: frozen, scale: 0.5 })
      .then((blob) => {
        if (!on) return
        const url = URL.createObjectURL(blob)
        setPreview((prev) => {
          if (prev) URL.revokeObjectURL(prev)
          return url
        })
      })
      .catch(() => {})
    return () => {
      on = false
    }
  }, [photo, layer, format, position, frozen])
  useEffect(
    () => () =>
      setPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      }),
    []
  )

  async function onFile(e) {
    const file = e.target.files?.[0]
    e.target.value = '' // elegir la misma foto de nuevo vuelve a disparar
    if (!file) return
    setPhotoError(false)
    try {
      setPhoto(await decodePhoto(file))
    } catch {
      setPhotoError(true)
    }
  }

  async function share() {
    if (!photo || sharing) return
    try {
      localStorage.setItem(LAYER_KEY, layer)
      localStorage.setItem(POSITION_KEY, position)
    } catch {
      /* sin almacenamiento: se comparte igual */
    }
    setSharing(true)
    setShareError(false)
    try {
      const blob = await buildBiblePhoto({ photo, layer, format, position, data: frozen })
      await shareOrDownload(
        [{ blob, filename: `mi-biblia-hoy${format === 'story' ? '-historia' : ''}.jpg` }],
        t('shareImage.fromApp', { url: shareUrl('biblia') }),
      )
    } catch {
      setShareError(true)
    } finally {
      setSharing(false)
    }
  }

  const picker = (
    <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onFile} aria-hidden="true" tabIndex={-1} />
  )

  return (
    <Sheet
      title={t('photo.title')}
      onCancel={onClose}
      footer={
        photo ? (
          <button type="button" onClick={share} disabled={sharing} className="btn btn-primary" style={{ opacity: sharing ? 0.6 : 1 }}>
            {sharing ? t('hoy.generatingImage') : t('materialReader.shareAction')}
          </button>
        ) : (
          <button type="button" onClick={() => inputRef.current?.click()} className="btn btn-primary">
            {t('photo.pick')}
          </button>
        )
      }
    >
      {picker}
      {!photo ? (
        <div className="pb-1 text-center">
          <p className="mx-auto max-w-[32ch] text-[16px] leading-snug text-ink">{t('photo.intro')}</p>
          <p className="mx-auto mt-3 max-w-[34ch] text-[13px] leading-snug text-ink-soft">{t('photo.privacy')}</p>
          {photoError && <InlineError message={t('photo.error')} className="mt-3" />}
        </div>
      ) : (
        <div className="space-y-4 pb-1">
          <div className="flex h-[42dvh] items-center justify-center">
            {preview && (
              <img src={preview} alt="" className="max-h-full max-w-full rounded-[10px]" style={{ boxShadow: 'var(--shadow-overlay)' }} />
            )}
          </div>
          <Segmented
            value={layer}
            onChange={setLayer}
            label={t('photo.layer')}
            options={layers.map((l) => ({ key: l, label: t(`photo.layer.${l}`) }))}
          />
          <Segmented
            value={format}
            onChange={setFormat}
            options={[
              { key: 'post', label: t('materialReader.sharePost') },
              { key: 'story', label: t('materialReader.shareStory') },
            ]}
          />
          <Segmented
            value={position}
            onChange={setPosition}
            label={t('photo.position')}
            options={[
              { key: 'top', label: t('photo.top') },
              { key: 'bottom', label: t('photo.bottom') },
            ]}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex min-h-11 w-full items-center justify-center text-[15px] font-semibold"
            style={{ color: 'var(--accent-ink)' }}
          >
            {t('photo.change')}
          </button>
          {shareError && <InlineError message={t('materialReader.shareError')} />}
        </div>
      )}
    </Sheet>
  )
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}
