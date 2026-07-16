import { lazy, Suspense } from 'react'
import { useLocation } from 'react-router-dom'

const PrivateRoot = lazy(() => import('./PrivateRoot.jsx'))
const Info = lazy(() => import('./screens/Info.jsx'))
const Ayuda = lazy(() => import('./screens/Ayuda.jsx'))
const Lideres = lazy(() => import('./screens/Lideres.jsx'))
const Privacidad = lazy(() => import('./screens/Privacidad.jsx'))

const PUBLIC_ROUTES = {
  '/info': Info,
  '/lideres': Lideres,
  '/ayuda': Ayuda,
  '/privacidad': Privacidad,
  // Compatibilidad client-side; Netlify hace el 301 cuando la navegación es fría.
  '/guia': Ayuda,
  '/grupos-de-discipulado': Lideres,
  '/guia-lideres': Lideres,
}

function PublicFallback() {
  return (
    <div className="min-h-[100dvh] bg-app px-6 pt-12" aria-hidden="true">
      <div className="mx-auto max-w-[680px] animate-pulse">
        <div className="h-4 w-32 rounded-pill bg-surface-alt" />
        <div className="mt-14 h-10 w-4/5 rounded-pill bg-surface-alt" />
        <div className="mt-3 h-10 w-3/5 rounded-pill bg-surface-alt" />
        <div className="mt-8 h-4 w-full rounded-pill bg-surface-alt" />
        <div className="mt-2 h-4 w-5/6 rounded-pill bg-surface-alt" />
      </div>
    </div>
  )
}

// Router de frontera: las landings no importan AuthProvider, Supabase ni la app
// privada. Al navegar a "/" se descarga ese árbol recién entonces.
export default function Root() {
  const { pathname } = useLocation()
  const normalizedPath = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  const PublicPage = PUBLIC_ROUTES[normalizedPath]

  return (
    <Suspense fallback={<PublicFallback />}>
      {PublicPage ? <PublicPage /> : <PrivateRoot />}
    </Suspense>
  )
}
