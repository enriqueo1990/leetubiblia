-- Duración de un pedido de oración: cuánto tiempo se espera que siga activo.
-- duration_type: etiqueta semántica elegida por el usuario.
-- expires_at: timestamp computado al crear/editar (null = Siempre).
-- Cuando expires_at < now(), el pedido aparece en "Para revisar" automáticamente.

alter table public.prayer_requests
  add column if not exists duration_type text not null default 'forever'
    check (duration_type in ('day', 'week', 'month', 'forever')),
  add column if not exists expires_at timestamptz;
