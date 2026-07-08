// Los planes viven en `reading_plans` (Supabase), sin columna de idioma: el
// nombre/descripción ahí siempre está en español. La traducción vive acá,
// mapeada por slug (ver plans.<slug>.name/description en src/i18n/*.json).
// Si un plan no tiene clave (slug nuevo sin traducir todavía), se muestra el
// valor de la base tal cual — mejor eso que texto vacío.
export function planName(t, plan) {
  if (!plan?.name) return t('common.plan')
  if (!plan.slug) return plan.name
  const key = `plans.${plan.slug}.name`
  const value = t(key)
  return value === key ? plan.name : value
}

export function planDescription(t, plan) {
  if (!plan?.slug) return plan?.description ?? ''
  const key = `plans.${plan.slug}.description`
  const value = t(key)
  return value === key ? (plan.description ?? '') : value
}
