import { useEffect, useState } from 'react'
import { getDonationGoal } from '../lib/db.js'
import { isStoreApp } from '../lib/platform.js'

// Meta de donación vigente (migración 0036): "USD 30 de 124" para costear las
// tiendas. Se pide una vez por sesión y se comparte entre Hoy y Ajustes.
// Devuelve null mientras carga, si falla, si está apagada, si ya se cumplió o si
// la app corre desde una tienda (ahí no se piden donaciones, ver isStoreApp).

let cached // undefined = sin pedir; null = sin meta; objeto = meta
let inflight = null

function load() {
  if (!inflight) {
    inflight = getDonationGoal('stores')
      .then((g) => (cached = g))
      .catch(() => (cached = null))
  }
  return inflight
}

function visible(goal) {
  return goal && goal.active && goal.raised < goal.target ? goal : null
}

// Para que /admin refleje al instante lo que el dueño acaba de guardar.
export function setCachedDonationGoal(goal) {
  cached = goal
  inflight = Promise.resolve(goal)
}

export function useDonationGoal() {
  const storeApp = isStoreApp()
  const [goal, setGoal] = useState(() => (cached === undefined ? null : visible(cached)))

  useEffect(() => {
    if (storeApp) return
    let alive = true
    load().then((g) => alive && setGoal(visible(g)))
    return () => {
      alive = false
    }
  }, [storeApp])

  return storeApp ? null : goal
}
