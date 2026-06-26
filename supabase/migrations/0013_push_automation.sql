-- ============================================================================
-- Lee Tu Biblia — Automatización del push (versiona lo que antes vivía suelto
-- en los README de supabase/functions/*).
-- Migración 0013. Aplicar DESPUÉS de 0009 y 0010.
--
-- Deja reproducible, en una migración, las dos piezas de entrega de push:
--   1) Cron (pg_cron + pg_net) que llama a la Edge Function `send-reminders`
--      cada minuto (recordatorio diario a hora local).
--   2) Trigger sobre prayer_requests que llama a `notify-group-prayer` cuando
--      un pedido se comparte a un grupo (al crearse o al pasar a compartido).
--
-- SECRETOS: NO van en este archivo. El cron y el trigger leen el service role y
-- la URL del proyecto desde Supabase Vault (vault.decrypted_secrets), así la
-- llave no queda en texto plano en el cuerpo del job/función ni en el repo.
--
-- Provisión por única vez (en el SQL Editor, con los valores REALES — no
-- committear):
--   select vault.create_secret('https://<TU_PROJECT_REF>.supabase.co', 'project_url');
--   select vault.create_secret('<SERVICE_ROLE_KEY>',                    'service_role_key');
-- Y desplegar las funciones:  supabase functions deploy send-reminders
--                             supabase functions deploy notify-group-prayer
-- Hasta que los secrets existan, el cron/trigger simplemente no envían (no rompen).
-- ============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ---- 1. Trigger: aviso de pedido compartido a un grupo --------------------
-- Lee la URL y el service role desde Vault; no incrusta secretos. Dispara al
-- INSERT de un pedido ya compartido y al UPDATE que lo transiciona a compartido
-- (o le cambia el grupo). No re-notifica ediciones de un pedido que ya estaba
-- compartido al mismo grupo (p.ej. marcarlo respondido o editar el título).
create or replace function public.notify_group_prayer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_key text;
begin
  -- Solo pedidos compartidos a un grupo.
  if not (new.visibility = 'shared' and new.shared_group_id is not null) then
    return new;
  end if;

  -- En UPDATE, no re-notificar si ya estaba compartido al mismo grupo.
  if tg_op = 'UPDATE'
     and old.visibility = 'shared'
     and old.shared_group_id is not distinct from new.shared_group_id then
    return new;
  end if;

  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'service_role_key';
  if v_url is null or v_key is null then
    return new; -- sin provisión de Vault: no enviar (no romper el insert/update)
  end if;

  perform net.http_post(
    url     := v_url || '/functions/v1/notify-group-prayer',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := jsonb_build_object('record', to_jsonb(new))
  );
  return new;
end $$;

drop trigger if exists prayer_shared_notify on public.prayer_requests;
create trigger prayer_shared_notify
  after insert or update on public.prayer_requests
  for each row execute function public.notify_group_prayer();

-- ---- 2. Cron: recordatorio diario cada minuto -----------------------------
-- Idempotente: desagenda el job previo (si existe) antes de re-agendar.
do $$
begin
  perform cron.unschedule('send-reminders-every-minute');
exception when others then
  null; -- no existía: seguir
end $$;

select cron.schedule(
  'send-reminders-every-minute',
  '* * * * *',
  $job$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
               || '/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body    := '{}'::jsonb
  );
  $job$
);
