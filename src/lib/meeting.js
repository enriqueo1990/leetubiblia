// Cada cuánto se junta un grupo: { every: 1–12, unit: 'week' | 'month' } o null.
// Lo usan MeetingPicker (elegir) y el detalle del grupo (mostrar).

export const MEET_MAX = 12

export const MEETING_PRESETS = [
  { key: 'w1', every: 1, unit: 'week' },
  { key: 'w2', every: 2, unit: 'week' },
  { key: 'w3', every: 3, unit: 'week' },
  { key: 'm1', every: 1, unit: 'month' },
]

// Qué fila está marcada. `custom` fuerza «Otra frecuencia» aunque el valor
// coincida con un preset (si la persona eligió esa fila, se queda ahí).
export function meetingChoice(value, custom) {
  if (!value) return 'none'
  if (custom) return 'custom'
  return MEETING_PRESETS.find((p) => p.every === value.every && p.unit === value.unit)?.key ?? 'custom'
}

// «cada 2 semanas», «una vez al mes»… (en minúscula, para ir dentro de una frase).
export function meetingPhrase(t, value) {
  if (!value?.every || !value?.unit) return ''
  if (value.every === 1) return t(`meeting.once.${value.unit}`)
  return t(`meeting.every.${value.unit}`, { count: value.every })
}

export function meetingFromGroup(group) {
  return group?.meet_every && group?.meet_unit
    ? { every: group.meet_every, unit: group.meet_unit }
    : null
}
