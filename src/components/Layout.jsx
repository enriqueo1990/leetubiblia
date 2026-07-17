import { Outlet, useLocation } from 'react-router-dom'
import TabBar from './TabBar.jsx'
import Sidebar from './Sidebar.jsx'
import OfflineNotice from './OfflineNotice.jsx'
import { useOnlineStatus } from '../hooks/useOnlineStatus.js'

// Cascarón responsive (documento maestro §4.7 / README — Responsive):
//  - El contenido vive SIEMPRE en una columna centrada de ancho acotado (~600px).
//    En pantallas grandes crece el aire alrededor, nunca el contenido.
//  - Móvil/tablet: tab bar inferior (deja hueco al fondo para no taparla).
//  - Desktop ≥1024px: sidebar a la izquierda; el contenido se desplaza tras él.
export default function Layout() {
  const { pathname } = useLocation()
  const online = useOnlineStatus()
  const focusMode = pathname === '/orar'
  const networkDependent =
    pathname === '/oracion' ||
    pathname === '/orar' ||
    pathname.startsWith('/oracion/') ||
    pathname === '/grupos' ||
    pathname.startsWith('/grupos/')
  const managementWide =
    pathname === '/ajustes' ||
    pathname === '/progreso' ||
    pathname === '/recorrido' ||
    /^\/grupos\/[^/]+$/.test(pathname)

  return (
    <div className="min-h-full bg-app">
      {!focusMode && <Sidebar />}

      {/* En desktop el contenido arranca después del sidebar (250px) */}
      <div className={focusMode ? '' : 'lg:pl-[250px]'}>
        <main
          key={pathname}
          className={`screen-enter mx-auto w-full max-w-content px-6 ${managementWide ? 'lg:max-w-[1040px]' : 'lg:max-w-content-wide'}`}
          style={{
            paddingTop: 'max(env(safe-area-inset-top), 16px)',
            // Espacio para no quedar bajo la tab bar en móvil/tablet
            paddingBottom: focusMode ? '24px' : 'calc(72px + env(safe-area-inset-bottom))',
          }}
        >
          {!online && networkDependent && <OfflineNotice />}
          <Outlet />
        </main>
      </div>

      {!focusMode && <TabBar />}
    </div>
  )
}
