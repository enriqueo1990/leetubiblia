import { lazy, Suspense } from 'react'
import { Routes, Route, Link } from 'react-router-dom'
import Gate from './components/Gate.jsx'
import ProfilePrefSync from './components/ProfilePrefSync.jsx'
import Layout from './components/Layout.jsx'

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

function RouteFallback() {
  return (
    <div
      className="mx-auto flex min-h-[60vh] w-full max-w-[620px] flex-col bg-app px-7 pt-6"
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

// Gate decide onboarding vs app. Una vez dentro, las rutas con tab bar/sidebar.
export default function App() {
  return (
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
  )
}
