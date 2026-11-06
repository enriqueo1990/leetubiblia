import { useEffect, useState } from 'react'
import { fetchVisibleDonationGoal } from '../hooks/useDonationGoal.js'
import { recordFunnel } from '../lib/diag.js'
import DonateSheet from '../components/DonateSheet.jsx'

// Hoja de donación del pie de las landings (ver landingKit › FooterDonate). Vive
// en su propio chunk: arrastra Supabase (para la meta vigente) y la hoja modal,
// que una persona que solo lee la landing no necesita.

// Espera máxima por la meta antes de abrir la hoja sin ella (red lenta o caída).
const GOAL_WAIT_MS = 1500

export default function DonateFlow({ onClose }) {
  // La hoja se abre con la meta ya resuelta, no se reacomoda a mitad de lectura.
  const [state, setState] = useState({ ready: false, goal: null })

  useEffect(() => {
    let alive = true
    const done = (goal) => {
      if (!alive) return
      alive = false
      if (goal) recordFunnel('goal_open')
      setState({ ready: true, goal })
    }
    const timer = setTimeout(() => done(null), GOAL_WAIT_MS)
    fetchVisibleDonationGoal().then((goal) => {
      clearTimeout(timer)
      done(goal)
    })
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [])

  if (!state.ready) return null
  return <DonateSheet goal={state.goal} fromGoal={Boolean(state.goal)} onClose={onClose} />
}

// Pide la meta con antelación (la dispara landingKit al acercarse el pie).
DonateFlow.warm = () => fetchVisibleDonationGoal()
