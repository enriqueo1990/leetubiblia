import { usePreferences } from '../lib/preferences.jsx'
import { inputStyle } from './formStyles.js'

// Campo «Tu nombre»: el nombre que ven tu grupo y los pedidos compartidos. Se usa
// al crear o unirse a un grupo (Grupos.jsx) y en Ajustes › Cuenta › Cambiar nombre.
export default function MyNameField({ value, onChange, id = 'my-name', autoFocus = false }) {
  const { t } = usePreferences()
  return (
    <div className="mb-5">
      <label htmlFor={id} className="mb-2 block text-[14px] font-medium text-ink">
        {t('onboarding.askName.label')}
      </label>
      <input
        id={id}
        type="text"
        autoComplete="name"
        autoFocus={autoFocus}
        placeholder={t('ajustes.tuNombre')}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-input px-4 py-3 text-[16px] outline-none"
        style={inputStyle}
      />
      <p className="mt-2 text-[13px] text-ink-soft">{t('onboarding.askName.subtitle')}</p>
    </div>
  )
}
