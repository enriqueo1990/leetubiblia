// ============================================================================
// Generador del seed de planes (documento maestro Tarea 2).
// Produce supabase/migrations/0003_seed_plans.sql a partir de:
//   - Proverbios: generado por fórmula (capítulo N = día N). Determinista y correcto.
//   - M'Cheyne y Cronológico: leídos de scripts/data/<slug>.txt si existen.
//     Formato del archivo: una línea por día, en orden (día 1 = primera línea).
//       Referencias separadas por ';'. Ej:
//         Génesis 1; Mateo 1; Esdras 1; Hechos 1
//     El parsing español→USFM lo hace usfm.mjs UNA vez, acá, no en runtime.
//
// Uso:  node scripts/seed.mjs
// Luego: pegar el SQL generado en el SQL Editor de Supabase (o aplicarlo por CLI).
//
// Importante: este script NO inventa contenido bíblico. Si falta el archivo de
// datos de un plan de 365 días, lo omite y avisa — mejor un plan ausente que
// referencias equivocadas.
// ============================================================================

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseDay } from './usfm.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const dataDir = join(__dirname, 'data')
const outFile = join(root, 'supabase', 'migrations', '0003_seed_plans.sql')

// SQL-escape de un string.
const q = (s) => `'${String(s).replace(/'/g, "''")}'`

// Catálogo de lanzamiento (documento maestro Tarea 2 / README pantalla 3).
const PLANS = [
  {
    slug: 'mcheyne',
    name: "M'Cheyne",
    description: 'Toda la Biblia en un año, cuatro pasajes por día.',
    duration_days: 365,
    source: 'file', // requiere scripts/data/mcheyne.txt
  },
  {
    slug: 'cronologico',
    name: 'Cronológico',
    description: 'La Biblia en el orden en que ocurrieron los hechos, en un año.',
    duration_days: 365,
    source: 'file', // requiere scripts/data/cronologico.txt
  },
  {
    slug: 'proverbios',
    name: 'Proverbios en 31 días',
    description: 'Un capítulo de Proverbios por día del mes.',
    duration_days: 31,
    source: 'proverbios', // generado por fórmula
  },
]

// Genera los días de un plan. Devuelve [{ day_number, refs }] o null si falta fuente.
function buildDays(plan) {
  if (plan.source === 'proverbios') {
    return Array.from({ length: 31 }, (_, i) => ({
      day_number: i + 1,
      refs: [{ label: `Proverbios ${i + 1}`, book_usfm: 'PRO', chapter: i + 1 }],
    }))
  }

  if (plan.source === 'file') {
    const path = join(dataDir, `${plan.slug}.txt`)
    if (!existsSync(path)) return null
    const lines = readFileSync(path, 'utf8')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'))

    return lines.map((line, idx) => {
      // Permite prefijo opcional "Día N:" — se ignora, el orden manda.
      const clean = line.replace(/^d[íi]a\s*\d+\s*[:.-]\s*/i, '')
      let refs
      try {
        refs = parseDay(clean)
      } catch (e) {
        throw new Error(`${plan.slug} línea ${idx + 1}: ${e.message}`)
      }
      return { day_number: idx + 1, refs }
    })
  }
  return null
}

function main() {
  const out = []
  out.push('-- ====================================================================')
  out.push('-- Lee Tu Biblia — Seed de planes (GENERADO por scripts/seed.mjs)')
  out.push('-- No editar a mano. Regenerar con: node scripts/seed.mjs')
  out.push('-- ====================================================================\n')

  const seededSlugs = []
  const skipped = []

  for (const plan of PLANS) {
    const days = buildDays(plan)
    if (!days) {
      skipped.push(plan.slug)
      continue
    }
    if (days.length !== plan.duration_days) {
      console.warn(
        `⚠ ${plan.slug}: el archivo tiene ${days.length} días pero duration_days=${plan.duration_days}.`
      )
    }
    seededSlugs.push(plan.slug)

    out.push(`-- ---- Plan: ${plan.name} (${days.length} días) ----`)
    out.push(
      `insert into public.reading_plans (slug, name, description, duration_days, is_active) values`
    )
    out.push(
      `  (${q(plan.slug)}, ${q(plan.name)}, ${q(plan.description)}, ${plan.duration_days}, true)`
    )
    out.push(`on conflict (slug) do update set`)
    out.push(`  name = excluded.name, description = excluded.description,`)
    out.push(`  duration_days = excluded.duration_days, is_active = excluded.is_active;\n`)

    // Re-sembrar limpio: borra los días previos del plan y re-inserta.
    out.push(
      `delete from public.plan_days where plan_id = (select id from public.reading_plans where slug = ${q(plan.slug)});`
    )
    out.push(
      `insert into public.plan_days (plan_id, day_number, refs)\nselect p.id, d.day_number, d.refs from public.reading_plans p`
    )
    out.push(`cross join (values`)
    const rows = days.map(
      (d) => `  (${d.day_number}, ${q(JSON.stringify(d.refs))}::jsonb)`
    )
    out.push(rows.join(',\n'))
    out.push(`) as d(day_number, refs)`)
    out.push(`where p.slug = ${q(plan.slug)};\n`)
  }

  mkdirSync(dirname(outFile), { recursive: true })
  writeFileSync(outFile, out.join('\n'))

  console.log(`✓ Seed generado: ${outFile}`)
  console.log(`  Sembrados: ${seededSlugs.join(', ') || '(ninguno)'}`)
  if (skipped.length) {
    console.log(
      `  ⚠ Omitidos (falta scripts/data/<slug>.txt): ${skipped.join(', ')}`
    )
    console.log(
      `    Creá esos archivos (una línea por día) y reejecutá. No se inventan referencias.`
    )
  }
}

main()
