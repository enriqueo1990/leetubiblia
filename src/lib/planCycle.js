// Ciclo del plan (migración 0033): sube al activar o renovar un plan, para que las
// notas del diario de un ciclo anterior no bloqueen las del siguiente.

// Ciclo vigente del perfil (0 si la migración todavía no está aplicada).
export const cycleOf = (profile) => profile?.plan_cycle ?? 0

// Parche para sumar al updateProfile de "activar" o "renovar". Solo incluye
// plan_cycle si la columna existe (el perfil la trae): antes de la migración, un
// parche con una columna desconocida haría fallar toda la actualización.
export function nextCyclePatch(profile) {
  return profile && 'plan_cycle' in profile ? { plan_cycle: cycleOf(profile) + 1 } : {}
}
