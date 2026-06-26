# Aviso de pedido de oración nuevo en el grupo — runbook de despliegue

Cuando alguien comparte un pedido a un grupo, avisa por Web Push a los demás
miembros que tengan el aviso activado. Reusa la infra de push de `send-reminders`
(mismas claves VAPID, mismo service worker).

## 1. Migración 0010
Aplicá `supabase/migrations/0010_group_prayer_notifications.sql` en el SQL Editor
(agrega `profiles.group_prayer_notifications_enabled`, default true).

## 2. Deploy de la función
No necesita secrets nuevos: los VAPID ya están a nivel proyecto (de send-reminders).
```bash
supabase functions deploy notify-group-prayer --project-ref <TU_PROJECT_REF>
```

## 3. Trigger en la base (ya versionado en la migración 0012)
El trigger `prayer_shared_notify` y su función `notify_group_prayer()` **ya están en
`0013_push_automation.sql`** (incluido en `_apply_pending.sql`). No se pega SQL con
la llave a mano: la función lee la URL del proyecto y el service role desde
**Supabase Vault** (`vault.decrypted_secrets`), así no queda nada en texto plano en
el cuerpo de la función ni en el repo.

Provisión por única vez (los mismos secrets que usa el cron de send-reminders; si ya
los creaste, no hace falta repetir), en el SQL Editor con los valores reales:
```sql
select vault.create_secret('https://<TU_PROJECT_REF>.supabase.co', 'project_url');
select vault.create_secret('<SERVICE_ROLE_KEY>',                    'service_role_key');
```
El trigger dispara al **crear** un pedido compartido y al **editarlo a compartido**
(o cambiarle el grupo); no re-notifica al editar uno que ya estaba compartido al
mismo grupo. Mientras los secrets no existan, no envía (no rompe el insert/update).

Para desactivar: `drop trigger prayer_shared_notify on public.prayer_requests;`

## 4. Probar
- Dos usuarios en un mismo grupo, ambos con notificaciones activadas (Ajustes).
- Uno publica un pedido **compartido** a ese grupo → al otro le llega el push
  "Fulano pidió oración en [Grupo]".
- El autor **no** recibe aviso. Quien tenga el toggle apagado, tampoco.
- Logs: Supabase → Edge Functions → `notify-group-prayer` → Logs. Devuelve
  `{ recipients, sent, removed }`.

## Notas
- Solo llega a miembros con una subscripción push (los que activaron avisos en
  Ajustes). El opt-out vive en `profiles.group_prayer_notifications_enabled`.
- El cuerpo del aviso muestra **autor + grupo**, nunca el título del pedido
  (privacidad: no se expone el contenido en la pantalla bloqueada).
