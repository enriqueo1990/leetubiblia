import { NavLink, useLocation } from 'react-router-dom'
import { NAV_ITEMS, matchesExtra } from './nav.js'
import { usePreferences } from '../lib/preferences.jsx'
import { GearIcon } from './icons.jsx'

// Sidebar de navegación (desktop ≥1024px) — reemplaza la tab bar inferior.
// ~250px, superficie con borde derecho hairline, marca + nav vertical.
// Ítem activo: texto en acento sobre tinte sutil, radio 12px.
export default function Sidebar() {
  const { pathname } = useLocation()
  const { t } = usePreferences()
  return (
    <aside
      className="hidden lg:flex fixed inset-y-0 left-0 w-[250px] flex-col border-r border-hairline bg-surface px-4 py-7"
      aria-label={t('nav.main')}
    >
      <div className="px-3 pb-6">
        <span className="text-[18px] font-bold tracking-tight text-ink">
          Lee Tu Biblia
        </span>
      </div>
      <nav>
        <ul className="flex flex-col gap-1">
          {NAV_ITEMS.map(({ to, labelKey, Icon, end, match }) => {
            // Encendido también en el subárbol del ítem (ver nav.js): el
            // usuario nunca desaparece del mapa primario.
            const extra = matchesExtra({ match }, pathname)
            return (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  className="flex min-h-11 items-center gap-3 rounded-[10px] px-3 py-2.5 transition-colors duration-300 ease-soft"
                  style={({ isActive }) => ({
                    color: isActive || extra ? 'var(--accent-ink)' : 'var(--text-soft)',
                    backgroundColor: isActive || extra ? 'var(--accent-tint-nav)' : 'transparent',
                  })}
                >
                  {({ isActive }) => (
                    <>
                      <Icon size={22} />
                      <span
                        className="text-[15px]"
                        style={{ fontWeight: isActive || extra ? 600 : 500 }}
                      >
                        {t(labelKey)}
                      </span>
                    </>
                  )}
                </NavLink>
              </li>
            )
          })}
        </ul>
      </nav>
      <nav className="mt-auto border-t border-hairline pt-3">
        <NavLink
          to="/ajustes"
          className="flex min-h-11 items-center gap-3 rounded-[10px] px-3 py-2.5 transition-colors duration-300 ease-soft"
          style={({ isActive }) => ({
            color: isActive ? 'var(--accent-ink)' : 'var(--text-soft)',
            backgroundColor: isActive ? 'var(--accent-tint-nav)' : 'transparent',
          })}
        >
          {({ isActive }) => (
            <>
              <GearIcon size={22} />
              <span className="text-[15px]" style={{ fontWeight: isActive ? 600 : 500 }}>
                {t('nav.ajustes')}
              </span>
            </>
          )}
        </NavLink>
      </nav>
    </aside>
  )
}
