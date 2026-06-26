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

## 6. Cron cada minuto (pg_cron + pg_net)
En el SQL Editor, reemplazando `<PROJECT_REF>` y `<SERVICE_ROLE_KEY>`:
```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'send-reminders-every-minute',
  '* * * * *',
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
    ),
    body    := '{}'::jsonb
  );
  $$
);
```
Más seguro: guardar el service role en **Supabase Vault** y leerlo en el job en
vez de incrustarlo. Para desactivar: `select cron.unschedule('send-reminders-every-minute');`

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
