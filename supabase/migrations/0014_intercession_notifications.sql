-- ============================================================================
-- Lee Tu Biblia — Aviso push al autor cuando alguien ora por su pedido (F2).
-- Migración 0014. Aplicar DESPUÉS de 0007 (prayer_intercessions) y 0013 (Vault).
--
-- Trigger AFTER INSERT en prayer_intercessions → llama a la Edge Function
-- `notify-intercession`, que avisa al autor del pedido ("alguien está orando por
-- vos"). Lee la URL del proyecto y el service role desde Supabase Vault (mismos
-- secrets que 0013, no se incrustan acá). Si los secrets no están, no envía.
--
-- Requiere desplegar la función:  supabase functions deploy notify-intercession
-- ============================================================================

create or replace function public.notify_intercession()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_key text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'service_role_key';
  if v_url is null or v_key is null then
    return new; -- sin provisión de Vault: no enviar (no romper la intercesión)
  end if;

  perform net.http_post(
    url     := v_url || '/functions/v1/notify-intercession',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := jsonb_build_object('record', to_jsonb(new))
  );
  return new;
end $$;

drop trigger if exists intercession_notify on public.prayer_intercessions;
create trigger intercession_notify
  after insert on public.prayer_intercessions
  for each row execute function public.notify_intercession();
