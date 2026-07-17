import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const root = new URL('../', import.meta.url)

async function source(path) {
  return readFile(new URL(path, root), 'utf8')
}

test('RLS no permite altas directas de grupos o membresías', async () => {
  const sql = await source('supabase/migrations/0029_security_hardening.sql')
  assert.match(sql, /revoke insert on table public\.group_members from anon, authenticated/i)
  assert.match(sql, /revoke insert on table public\.groups from anon, authenticated/i)
  assert.match(sql, /grant execute on function public\.join_group_by_code\(text\) to authenticated/i)
})

test('RLS exige pertenencia al compartir un pedido', async () => {
  const sql = await source('supabase/migrations/0029_security_hardening.sql')
  assert.match(sql, /visibility = 'shared'[\s\S]*public\.is_group_member\(shared_group_id\)/i)
  assert.match(sql, /create policy "prayers update own"[\s\S]*with check/i)
})

test('las funciones privilegiadas requieren el token service role', async () => {
  const files = [
    'supabase/functions/notify-group-prayer/index.ts',
    'supabase/functions/notify-intercession/index.ts',
    'supabase/functions/send-reminders/index.ts',
  ]
  for (const file of files) {
    const code = await source(file)
    assert.match(code, /requireServiceRole\(req, SERVICE_ROLE\)/)
  }
})

test('las fechas locales de lectura se conservan en la base', async () => {
  const migration = await source('supabase/migrations/0030_reading_completed_on.sql')
  const db = await source('src/lib/db.js')
  assert.match(migration, /add column if not exists completed_on date/i)
  assert.match(migration, /alter column completed_on set not null/i)
  assert.match(db, /select\('day_number, completed_on'\)/)
  assert.match(db, /completed_on: completedOn/)
  assert.match(db, /PGRST204/)
})
