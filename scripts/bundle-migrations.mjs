// ============================================================================
// Genera los dos bundles SQL que se pegan en el SQL Editor de Supabase, a partir
// de los archivos numerados supabase/migrations/00NN_*.sql (fuente de verdad):
//
//   _apply_all.sql      → TODAS las migraciones, en orden. Para un proyecto NUEVO
//                         o un re-deploy desde cero. Idempotente.
//   _apply_pending.sql  → se RESETEA a un placeholder vacío. Cuando agregues una
//                         migración nueva y todavía no la aplicaste, pegá acá su
//                         contenido (o regenerá _apply_all y usá ese).
//
// Uso:  node scripts/bundle-migrations.mjs
// ============================================================================

import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const migDir = join(__dirname, '..', 'supabase', 'migrations')

// Solo archivos NNNN_*.sql (excluye _apply_all / _apply_pending y cualquier otro).
const files = readdirSync(migDir)
  .filter((f) => /^\d{4}_.*\.sql$/.test(f))
  .sort() // el prefijo numérico de 4 dígitos ordena correctamente

const out = [
  '-- ============================================================',
  '-- Lee Tu Biblia — APLICAR TODO (todas las migraciones, en orden).',
  '-- GENERADO por scripts/bundle-migrations.mjs — no editar a mano.',
  '-- Pegá este archivo COMPLETO en el SQL Editor de Supabase y Run.',
  '-- Idempotente: se puede reejecutar sin romper nada.',
  '--',
  '-- Para que el push (0013) entregue, una sola vez con valores reales:',
  "--   select vault.create_secret('https://<TU_PROJECT_REF>.supabase.co', 'project_url');",
  "--   select vault.create_secret('<SERVICE_ROLE_KEY>',                    'service_role_key');",
  '-- y desplegar las Edge Functions send-reminders y notify-group-prayer.',
  '-- ============================================================',
  '',
]

for (const f of files) {
  const body = readFileSync(join(migDir, f), 'utf8').trim()
  out.push(`-- ===== ${f} =====`)
  out.push(body)
  out.push('')
}

writeFileSync(join(migDir, '_apply_all.sql'), out.join('\n') + '\n')

// Reset del staging incremental: ya aplicado, no queda nada pendiente.
const pending = [
  '-- ============================================================',
  '-- Lee Tu Biblia — MIGRACIONES PENDIENTES (staging incremental).',
  '-- Vacío: no hay migraciones sin aplicar.',
  '--',
  '-- Cuando agregues una migración nueva y todavía no la corriste, pegá acá su',
  '-- contenido y aplicalo en el SQL Editor. Después volvé a vaciar este archivo',
  '-- (o regenerá todo con: node scripts/bundle-migrations.mjs).',
  '-- Para un deploy desde cero usá _apply_all.sql.',
  '-- ============================================================',
  '',
]
writeFileSync(join(migDir, '_apply_pending.sql'), pending.join('\n') + '\n')

console.log(`✓ _apply_all.sql generado con ${files.length} migraciones:`)
console.log('  ' + files.join('\n  '))
console.log('✓ _apply_pending.sql reseteado a vacío')
