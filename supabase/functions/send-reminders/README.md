# Recordatorio diario por push (función 7) — runbook de despliegue

Pasos manuales (una vez) para que el recordatorio se envíe a hora fija aunque la
app esté cerrada. El código ya está en el repo; falta provisionar Supabase.

## 1. Generar las claves VAPID
```bash
npx web-push generate-vapid-keys
```
Guardás la **Public Key** y la **Private Key**.

## 2. Clave pública en el cliente
En `.env` (y en las env vars de Cloudflare Pages):
```
VITE_VAPID_PUBLIC_KEY=<public key>
```
Rebuild/redeploy del frontend para que tome la variable.

## 3. Aplicar la migración 0009
Pegá `supabase/migrations/_apply_pending.sql` en el SQL Editor de Supabase y Run
(incluye `push_subscriptions`, `profiles.timezone` y `reminder_last_sent`).

## 4. Secrets de la Edge Function
```bash
supabase secrets set \
  VAPID_PUBLIC_KEY=<public key> \
  VAPID_PRIVATE_KEY=<private key> \
  VAPID_SUBJECT=mailto:tu-email@dominio.com
```
`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` ya existen en el runtime.

## 5. Deploy de la función
```bash
supabase functions deploy send-reminders
```
Se deja el `verify_jwt` por defecto: el cron la llama con el **service role** como
Bearer (un JWT válido del proyecto), así nadie sin esa clave puede dispararla.

## 6. Cron cada minuto (ya versionado en la migración 0012)
El cron `send-reminders-every-minute` **ya está en `0013_push_automation.sql`**
(incluido en `_apply_pending.sql`). No se pega SQL a mano ni se incrusta la llave:
el job lee la URL del proyecto y el service role desde **Supabase Vault**.

Provisión por única vez, en el SQL Editor, con los valores reales (no committear):
```sql
select vault.create_secret('https://<TU_PROJECT_REF>.supabase.co', 'project_url');
select vault.create_secret('<SERVICE_ROLE_KEY>',                    'service_role_key');
```
Mientras los secrets no existan, el cron no envía (no rompe nada). Para desactivar:
`select cron.unschedule('send-reminders-every-minute');`

## 7. Probar
- En la app (PWA instalada en iOS / cualquier navegador en Android-desktop):
  Ajustes → Recordatorio diario → Activar (aceptar el permiso). Eso crea la fila
  en `push_subscriptions` y guarda tu `timezone`.
- Poné la hora del recordatorio 1–2 minutos en el futuro y esperá el tick del cron.
- Para forzar una corrida sin esperar:
  ```bash
  curl -i -X POST 'https://<PROJECT_REF>.supabase.co/functions/v1/send-reminders' \
    -H 'Authorization: Bearer <SERVICE_ROLE_KEY>'
  ```
  Devuelve `{ "due": N, "sent": N, "removed": N }`.

## Notas
- **iOS**: Web Push solo llega si la PWA está **agregada a la pantalla de inicio**
  (iOS 16.4+) y el permiso se pidió desde adentro de la PWA instalada.
- La entrega exacta depende del sistema operativo; puede demorar algunos minutos.
- `reminder_last_sent` evita doble envío el mismo día (en la fecha local del usuario).
