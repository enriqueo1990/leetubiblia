// Acumulados de lectura (puro, sin Supabase).
//
// "Días en la Palabra" = fechas distintas con lectura viva + los días de ciclos de
// plan ya cerrados y renovados. Renovar un plan borra su progreso, pero el logro
// (plan_completions) conserva `days_read`: se suma para que el acumulado nunca
// retroceda.
//
// Un logro se suma solo si su ciclo ya fue "consumido" por una renovación, es
// decir, si no quedan filas de ese plan con fecha <= la del logro. Mientras el
// progreso sigue ahí (el festejo se guarda antes de renovar), esos días ya están
// en `liveDates` y sumarlos de nuevo duplicaría la cuenta.
export function totalDaysRead({ liveDates, progressRows, completions }) {
  const consumed = (completions ?? []).filter(
    (c) =>
      !(progressRows ?? []).some(
        (r) => r.plan_id === c.plan_id && r.completed_on <= c.completed_on
      )
  )
  const closed = consumed.reduce((sum, c) => sum + (c.days_read ?? 0), 0)
  return liveDates.size + closed
}
