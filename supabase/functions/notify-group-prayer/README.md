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
supabase functions deploy notify-group-prayer --project-ref jugddsluulcdhplyjwou
```

## 3. Trigger en la base (SQL Editor)
Dispara la función en cada INSERT de un pedido compartido. Reemplazá
`<TU_SERVICE_ROLE_KEY>` por la **legacy `service_role` (empieza con `eyJ`)** — la
misma que usás en el cron de send-reminders. **No la pegues en el chat**, va directo
acá:
```sql
create or replace function public.notify_group_prayer()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.visibility = 'shared' and new.shared_group_id is not null then
    perform net.http_post(
      url     := 'https://jugddsluulcdhplyjwou.supabase.co/functions/v1/notify-group-prayer',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer <TU_SERVICE_ROLE_KEY>'
      ),
      body    := jsonb_build_object('record', to_jsonb(new))
    );
  end if;
  return new;
end $$;

drop trigger if exists prayer_shared_notify on public.prayer_requests;
create trigger prayer_shared_notify
  after insert on public.prayer_requests
  for each row execute function public.notify_group_prayer();
```
`pg_net` ya está habilitado (lo usa el cron). Más seguro: guardar el service role en
**Supabase Vault** y leerlo en la función del trigger en vez de incrustarlo.

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
