import Sheet from './Sheet.jsx'
import { usePreferences } from '../lib/preferences.jsx'
import { BRAND_SERIF } from '../lib/brandFont.js'

// Hoja "Aa" del lector: A− / A+ con una muestra del propio texto que se está
// leyendo, en vivo. Cambia solo el texto de los libros (ver useReaderScale).
export default function ReaderTextSheet({ step, steps, scale, onSmaller, onLarger, sample, onClose }) {
  const { t } = usePreferences()
  const btn =
    'flex h-12 w-14 shrink-0 items-center justify-center rounded-input text-ink transition-opacity active:opacity-50 disabled:opacity-30'
  return (
    <Sheet title={t('materialReader.textSize')} onCancel={onClose}>
      <div className="flex items-center gap-3" style={{ '--reader-scale': scale }}>
        <button
          type="button"
          onClick={onSmaller}
          disabled={step === 0}
          aria-label={t('materialReader.smaller')}
          className={btn}
          style={{ backgroundColor: 'var(--surface-alt)', fontFamily: BRAND_SERIF }}
        >
          <span className="text-[1rem] font-medium">A</span>
        </button>
        <div className="flex flex-1 items-center justify-center gap-2" aria-hidden="true">
          {Array.from({ length: steps }, (_, i) => (
            <span
              key={i}
              className="rounded-full transition-colors"
              style={{ width: 8, height: 8, backgroundColor: i <= step ? 'var(--accent-ink)' : 'var(--faint-2)' }}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={onLarger}
          disabled={step === steps - 1}
          aria-label={t('materialReader.larger')}
          className={btn}
          style={{ backgroundColor: 'var(--surface-alt)', fontFamily: BRAND_SERIF }}
        >
          <span className="text-[1.5rem] font-medium">A</span>
        </button>
      </div>
      <p role="status" className="sr-only">
        {t('materialReader.textSizeStep', { n: step + 1, total: steps })}
      </p>
      {sample && (
        <p lang="es" className="book-text book-text-md mt-5" style={{ '--reader-scale': scale }}>
          {sample}
        </p>
      )}
      <p className="mt-4 text-[0.8125rem] leading-snug text-ink-soft">{t('materialReader.textSizeNote')}</p>
    </Sheet>
  )
}
