import { NavLink } from 'react-router-dom'
import { NAV_ITEMS } from './nav.js'

// Sidebar de navegación (desktop ≥1024px) — reemplaza la tab bar inferior.
// ~250px, superficie con borde derecho hairline, marca + nav vertical.
// Ítem activo: texto en acento sobre tinte sutil, radio 12px.
export default function Sidebar() {
  return (
    <aside
      className="hidden lg:flex fixed inset-y-0 left-0 w-[250px] flex-col border-r border-hairline bg-surface px-4 py-7"
      aria-label="Navegación principal"
    >
      <div className="px-3 pb-6">
        <span className="text-[19px] font-bold tracking-tight text-ink">
          Lee Tu Biblia
        </span>
      </div>
      <nav>
        <ul className="flex flex-col gap-1">
          {NAV_ITEMS.map(({ to, label, Icon, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className="flex items-center gap-3 rounded-[12px] px-3 py-2.5 transition-colors duration-300 ease-soft"
                style={({ isActive }) => ({
                  color: isActive ? 'var(--accent)' : 'var(--text-soft)',
                  backgroundColor: isActive ? 'var(--accent-tint-nav)' : 'transparent',
                })}
              >
                {({ isActive }) => (
                  <>
                    <Icon size={22} />
                    <span
                      className="text-[15px]"
                      style={{ fontWeight: isActive ? 600 : 500 }}
                    >
                      {label}
                    </span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  )
}
