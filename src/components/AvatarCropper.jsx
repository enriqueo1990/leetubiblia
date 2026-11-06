import { useEffect, useRef, useState } from 'react'
import Sheet from './Sheet.jsx'
import InlineError from './InlineError.jsx'
import { usePreferences } from '../lib/preferences.jsx'
import { clampOffset, clampZoom, cropRect, displayBox, MAX_ZOOM, MIN_ZOOM } from '../lib/avatarMath.js'

const VIEW = 280 // lado del visor, en px

// Encuadrar la foto de perfil antes de subirla: la foto dentro de un círculo,
// se arrastra para moverla y se acerca con dos dedos, la rueda o la barra.
// Nunca queda hueco (ver avatarMath). "Usar foto" devuelve el cuadrado elegido
// en píxeles de la imagen original.
export default function AvatarCropper({ file, busy, error = null, onCancel, onConfirm }) {
  const { t } = usePreferences()
  const [url, setUrl] = useState(null)
  const [dims, setDims] = useState(null) // { w, h } de la imagen
  const [zoom, setZoom] = useState(1)
  const [off, setOff] = useState({ x: 0, y: 0 })
  const pointers = useRef(new Map())
  const gesture = useRef(null)

  useEffect(() => {
    const u = URL.createObjectURL(file)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [file])

  const apply = (z, x, y) => {
    if (!dims) return
    const zz = clampZoom(z)
    setZoom(zz)
    setOff(clampOffset(dims.w, dims.h, VIEW, zz, x, y))
  }

  function onPointerDown(e) {
    e.currentTarget.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    gesture.current = snapshot()
  }
  function onPointerMove(e) {
    if (!pointers.current.has(e.pointerId) || !gesture.current) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const g = gesture.current
    const pts = [...pointers.current.values()]
    if (pts.length >= 2 && g.dist) {
      // Pellizcar: el zoom sigue la distancia entre los dedos.
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      apply(g.zoom * (d / g.dist), g.off.x, g.off.y)
    } else if (pts.length === 1) {
      apply(g.zoom, g.off.x + (pts[0].x - g.start.x), g.off.y + (pts[0].y - g.start.y))
    }
  }
  function onPointerUp(e) {
    pointers.current.delete(e.pointerId)
    gesture.current = pointers.current.size ? snapshot() : null
  }
  function snapshot() {
    const pts = [...pointers.current.values()]
    return {
      zoom,
      off,
      start: pts[0],
      dist: pts.length >= 2 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : null,
    }
  }

  const box = dims ? displayBox(dims.w, dims.h, VIEW, zoom, off.x, off.y) : null

  return (
    <Sheet
      title={t('ajustes.photo.cropTitle')}
      onCancel={onCancel}
      footer={
        <>
          <InlineError message={error} className="mb-2 text-center" />
          <button
            type="button"
            className="btn btn-primary"
            disabled={!dims || busy}
            style={{ opacity: !dims || busy ? 0.6 : 1 }}
            onClick={() => onConfirm(cropRect(dims.w, dims.h, VIEW, zoom, off.x, off.y))}
          >
            {busy ? t('ajustes.photo.saving') : t('ajustes.photo.use')}
          </button>
        </>
      }
    >
      <div className="flex flex-col items-center">
        <div
          className="relative touch-none select-none overflow-hidden rounded-[20px]"
          style={{ width: VIEW, height: VIEW, backgroundColor: 'var(--surface-alt)', cursor: 'grab' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={(e) => apply(zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08), off.x, off.y)}
        >
          {url && (
            <img
              src={url}
              alt=""
              draggable={false}
              onLoad={(e) => setDims({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
              className="pointer-events-none absolute max-w-none"
              style={box ? { width: box.width, height: box.height, left: box.left, top: box.top } : { opacity: 0 }}
            />
          )}
          {/* Lo de afuera del círculo, velado, con un filete blanco en el borde:
              así se ve cómo va a quedar. (70% del radio al rincón ≈ el círculo
              inscripto en el visor.) */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(circle at center, transparent 69.2%, rgba(255,255,255,.9) 69.5%, rgba(255,255,255,.9) 70.1%, rgba(0,0,0,.45) 70.4%)',
            }}
          />
        </div>
        <p className="mt-3 text-center text-[0.8125rem] text-ink-soft">{t('ajustes.photo.cropHint')}</p>
        <label className="mt-3 flex w-full max-w-[280px] items-center gap-3">
          <span aria-hidden="true" className="text-[0.8125rem] text-ink-soft">−</span>
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step="0.01"
            value={zoom}
            onChange={(e) => apply(Number(e.target.value), off.x, off.y)}
            aria-label={t('ajustes.photo.zoom')}
            className="w-full"
            style={{ accentColor: 'var(--accent-action)' }}
          />
          <span aria-hidden="true" className="text-[1rem] text-ink-soft">+</span>
        </label>
      </div>
    </Sheet>
  )
}
