import { createClient } from '@supabase/supabase-js'

// Cliente de Supabase. Las credenciales vienen de variables de entorno (.env local
// y variables de Cloudflare Pages) — nunca hardcodeadas (documento maestro §10.6).
// La anon key es segura para el frontend: la protege la RLS (migración 0002).
const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  // Aviso temprano en dev si falta configurar el .env (ver .env.example).
  console.warn(
    '[supabase] Falta VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. Copiá .env.example a .env y completá.'
  )
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true, // necesario para el magic link (Tarea 3)
  },
})
