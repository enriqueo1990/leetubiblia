import { lazy, Suspense, useState, useEffect } from 'react'
import { Routes, Route, Link, useLocation } from 'react-router-dom'
import Gate from './components/Gate.jsx'
import ProfilePrefSync from './components/ProfilePrefSync.jsx'
import Layout from './components/Layout.jsx'

const Info = lazy(() => import('./screens/Info.jsx'))
const Ayuda = lazy(() => import('./screens/Ayuda.jsx'))
const Lideres = lazy(() => import('./screens/Lideres.jsx'))
const Privacidad = lazy(() => import('./screens/Privacidad.jsx'))
const Hoy = lazy(() => import('./screens/Hoy.jsx'))
const TodayExtrasView = lazy(() => import('./screens/TodayExtrasView.jsx'))
const Progreso = lazy(() => import('./screens/Progreso.jsx'))
const Recorrido = lazy(() => import('./screens/Recorrido.jsx'))
const Planes = lazy(() => import('./screens/Planes.jsx'))
const PlanDetail = lazy(() => import('./screens/PlanDetail.jsx'))
const Oracion = lazy(() => import('./screens/Oracion.jsx'))
const OrarAhora = lazy(() => import('./screens/OrarAhora.jsx'))
const PrayerDetail = lazy(() => import('./screens/PrayerDetail.jsx'))
const Grupos = lazy(() => import('./screens/Grupos.jsx'))
const GroupDetail = lazy(() => import('./screens/GroupDetail.jsx'))
const GroupTestimonies = lazy(() => import('./screens/GroupTestimonies.jsx'))
const GroupReading = lazy(() => import('./screens/GroupReading.jsx'))
const Join = lazy(() => import('./screens/Join.jsx'))
const Ajustes = lazy(() => import('./screens/Ajustes.jsx'))
const Materiales = lazy(() => import('./screens/Materiales.jsx'))
const MaterialReader = lazy(() => import('./screens/MaterialReader.jsx'))
const Admin = lazy(() => import('./screens/Admin.jsx'))

function RouteFallback({ full = false }) {
  return (
    <div
      className={`mx-auto flex w-full max-w-[620px] flex-col bg-app px-7 pt-6 ${
        full ? 'min-h-[100dvh]' : 'min-h-[60vh]'
      }`}
      aria-hidden="true"
    >
      <div className="animate-pulse">
        <div className="flex items-center justify-between">
          <div className="rounded-pill" style={{ width: 136, height: 14, backgroundColor: 'var(--surface-alt)' }} />
          <div className="rounded-full" style={{ width: 36, height: 36, backgroundColor: 'var(--surface-alt)' }} />
        </div>
        <div className="mt-8 space-y-2">
          <div className="rounded-pill" style={{ width: '68%', height: 28, backgroundColor: 'var(--surface-alt)' }} />
          <div className="rounded-pill" style={{ width: '44%', height: 28, backgroundColor: 'var(--surface-alt)' }} />
        </div>
        <div className="card mt-8 space-y-3 p-4">
          <div className="rounded-pill" style={{ width: '42%', height: 12, backgroundColor: 'var(--surface-alt)' }} />
          <div className="rounded-pill" style={{ width: '74%', height: 14, backgroundColor: 'var(--surface-alt)' }} />
        </div>
      </div>
    </div>
  )
}

function LazyPage({ children, full = false }) {
  return <Suspense fallback={<RouteFallback full={full} />}>{children}</Suspense>
}

// Splash "frontispicio", segunda escena del estático de index.html (mismo
// layout pixel a pixel): el libro y el pie de imprenta ya estaban; al montar
// React, el versículo llega escalonado (.splash-* en index.css) — la palabra
// aparece cuando la app está lista. Cubre la app sin bloquear que Gate y sus
// hijos monten y carguen datos por debajo; se despide con un fade suave.
function LaunchOverlay() {
  const [phase, setPhase] = useState('shown') // shown → fading → gone
  useEffect(() => {
    const t1 = setTimeout(() => setPhase('fading'), 1400)
    const t2 = setTimeout(() => setPhase('gone'), 1800)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])
  if (phase === 'gone') return null
  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-app transition-opacity duration-[400ms] ease-soft ${
        phase === 'fading' ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
      aria-hidden="true"
    >
      <div className="flex -translate-y-3 flex-col items-center px-10 text-center">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="6 10 52 44" width="96" height="81">
          <g fill="none" stroke="var(--accent)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M32 20C28 16.7 22.2 16 12 16v28c10.2 0 16 .7 20 4 4-3.3 9.8-4 20-4V16c-10.2 0-16 .7-20 4Z"/>
            <path d="M32 20v28"/>
          </g>
        </svg>
        <p className="splash-verse mt-10 text-[length:clamp(19px,5.5vw,21px)] italic leading-[1.5] text-ink">
          Santifícalos en la verdad;<br />Tu palabra es verdad.
        </p>
        <div className="splash-rule mt-6 h-px w-8 bg-accent" />
        <span className="splash-ref mt-[18px] text-[11px] font-medium uppercase tracking-[0.14em] text-placeholder">
          Juan 17:17 · NBLA
        </span>
      </div>
      <span className="absolute bottom-[calc(40px+env(safe-area-inset-bottom))] pl-[0.28em] text-[12px] font-medium uppercase tracking-[0.28em] text-accent-ink">
        Lee Tu Biblia
      </span>
    </div>
  )
}

// Gate decide onboarding vs app. Una vez dentro, las rutas con tab bar/sidebar.
export default function App() {
  const { pathname } = useLocation()

  // Páginas PÚBLICAS: viven fuera del Gate y del splash, para que quien llega en
  // frío (redes, un pastor pasando el link) vea de qué se trata sin caer en el
  // login. Todas comparten el footer global (landingKit → LandingFooter) que las
  // conecta entre sí; sus CTA llevan a "/" y ahí sí entra el Gate → AuthFlow.
  // Arquitectura hub-y-radios: /info es la puerta; las demás, hermanas planas.
  if (pathname === '/info') return <LazyPage full><Info /></LazyPage> // la puerta
  if (pathname === '/lideres') return <LazyPage full><Lideres /></LazyPage> // página del líder de grupo
  if (pathname === '/ayuda') return <LazyPage full><Ayuda /></LazyPage> // manual/referencia (entra desde Ajustes)
  if (pathname === '/privacidad') return <LazyPage full><Privacidad /></LazyPage> // capa de confianza
  // Rutas antiguas → nuevas. El 301 real lo hace Netlify (public/_redirects) para
  // los links que se comparten; esto cubre la navegación client-side ya cacheada.
  if (pathname === '/guia') return <LazyPage full><Ayuda /></LazyPage>
  if (pathname === '/grupos-de-discipulado' || pathname === '/guia-lideres') {
    return <LazyPage full><Lideres /></LazyPage>
  }

  return (
    <>
      <LaunchOverlay />
      <Gate>
        <ProfilePrefSync />
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            {/* Panel privado del dueño: fuera del Layout (sin tab bar), por URL directa. */}
            <Route path="admin" element={<Admin />} />
            <Route element={<Layout />}>
              <Route index element={<Hoy />} />
              <Route path="hoy/lecturas" element={<TodayExtrasView />} />
              <Route path="progreso" element={<Progreso />} />
              <Route path="recorrido" element={<Recorrido />} />
              <Route path="planes" element={<Planes />} />
              <Route path="planes/:id" element={<PlanDetail />} />
              <Route path="oracion" element={<Oracion />} />
              <Route path="orar" element={<OrarAhora />} />
              <Route path="oracion/:id" element={<PrayerDetail />} />
              <Route path="grupos" element={<Grupos />} />
              <Route path="grupos/:id" element={<GroupDetail />} />
              <Route path="grupos/:id/testimonios" element={<GroupTestimonies />} />
              <Route path="grupos/:id/lectura" element={<GroupReading />} />
              <Route path="join" element={<Join />} />
              <Route path="ajustes" element={<Ajustes />} />
              <Route path="materiales" element={<Materiales />} />
              <Route path="materiales/:slug" element={<MaterialReader />} />
              <Route
                path="*"
                element={
                  <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
                    <p className="text-[17px] text-ink">Esta página no existe.</p>
                    <Link to="/" className="btn btn-primary mt-6 inline-block px-8">
                      Ir a Hoy
                    </Link>
                  </div>
                }
              />
            </Route>
          </Routes>
        </Suspense>
      </Gate>
    </>
  )
}
