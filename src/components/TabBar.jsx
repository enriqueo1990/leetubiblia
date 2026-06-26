import { NavLink } from 'react-router-dom'
import { NAV_ITEMS } from './nav.js'

// Tab bar inferior translúcida (móvil/tablet). En desktop (≥1024px) se oculta y
// la reemplaza el Sidebar. El hairline y el fondo se acotan al ancho de contenido
// para que en tablet quede "centrada bajo la columna" (README — Responsive).
export default function TabBar() {
  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-20"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Navegación principal"
    >
      <div
        className="mx-auto max-w-content border-t border-hairline"
        style={{
          backgroundColor: 'var(--tabbar-bg)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        <ul className="flex">
          {NAV_ITEMS.map(({ to, label, Icon, end }) => (
            <li key={to} className="flex-1">
              <NavLink
                to={to}
                end={end}
                className="flex flex-col items-center justify-center gap-1 py-2"
                style={({ isActive }) => ({
                  color: isActive ? 'var(--accent)' : 'var(--text-soft)',
                  minHeight: 56,
                })}
              >
                {({ isActive }) => (
                  <>
                    <Icon size={25} />
                    <span
                      className="text-[11px]"
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
      </div>
    </nav>
  )
}
