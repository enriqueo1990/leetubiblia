// Elección de plan hecha ANTES de crear la cuenta (bienvenida → explorar).
// Vive en localStorage hasta que el registro termina: ChoosePlanOnboarding la
// consume y la aplica sin volver a preguntar, y el Gate la descarta si la sesión
// resulta ser de una cuenta que ya tiene plan activo (login en otro dispositivo:
// jamás pisamos un plan en curso). Formas posibles:
//   { planId, resumeDay, name }  → plan elegido (name solo para el copy del form)
//   { skipped: true }            → exploró y prefirió decidir después
const KEY = 'ltb.pendingPlan'

export function readPendingPlan() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY))
    if (!parsed || typeof parsed !== 'object') return null
    if (parsed.skipped === true) return { skipped: true }
    if (typeof parsed.planId === 'number') return parsed
    return null
  } catch {
    return null
  }
}

export function savePendingPlan(pending) {
  localStorage.setItem(KEY, JSON.stringify(pending))
}

export function clearPendingPlan() {
  localStorage.removeItem(KEY)
}
