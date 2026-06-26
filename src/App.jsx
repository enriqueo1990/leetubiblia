import { Routes, Route, Link } from 'react-router-dom'
import Gate from './components/Gate.jsx'
import ProfilePrefSync from './components/ProfilePrefSync.jsx'
import Layout from './components/Layout.jsx'
import Hoy from './screens/Hoy.jsx'
import Progreso from './screens/Progreso.jsx'
import Planes from './screens/Planes.jsx'
import PlanDetail from './screens/PlanDetail.jsx'
import Oracion from './screens/Oracion.jsx'
import PrayerDetail from './screens/PrayerDetail.jsx'
import Grupos from './screens/Grupos.jsx'
import GroupDetail from './screens/GroupDetail.jsx'
import GroupTestimonies from './screens/GroupTestimonies.jsx'
import Join from './screens/Join.jsx'
import Ajustes from './screens/Ajustes.jsx'

// Gate decide onboarding vs app. Una vez dentro, las rutas con tab bar/sidebar.
export default function App() {
  return (
    <Gate>
      <ProfilePrefSync />
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Hoy />} />
          <Route path="progreso" element={<Progreso />} />
          <Route path="planes" element={<Planes />} />
          <Route path="planes/:id" element={<PlanDetail />} />
          <Route path="oracion" element={<Oracion />} />
          <Route path="oracion/:id" element={<PrayerDetail />} />
          <Route path="grupos" element={<Grupos />} />
          <Route path="grupos/:id" element={<GroupDetail />} />
          <Route path="grupos/:id/testimonios" element={<GroupTestimonies />} />
          <Route path="join" element={<Join />} />
          <Route path="ajustes" element={<Ajustes />} />
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
    </Gate>
  )
}
