# Aviso de intercesión ("alguien está orando por tu pedido") — runbook

Cuando alguien se suma a orar por un pedido compartido, avisa por Web Push al
**autor** del pedido (modelo de retorno de Fase 2). Reusa la infra de push de
`send-reminders` (mismas claves VAPID, mismo service worker).

## 1. Migración 0014
Aplicá `supabase/migrations/0014_intercession_notifications.sql` (incluido en
`_apply_pending.sql`). Crea el trigger `intercession_notify` en
`prayer_intercessions`, que lee la URL del proyecto y el service role desde
**Supabase Vault** (los mismos secrets `project_url` / `service_role_key` que usa
0013 — si ya los creaste, no hace falta repetir).

## 2. Deploy de la función
No necesita secrets nuevos: los VAPID ya están a nivel proyecto (de send-reminders).
```bash
supabase functions deploy notify-intercession
```

## 3. Probar
- Dos usuarios en un grupo; uno comparte un pedido, el otro lo abre y toca
  "Estoy orando por esto" → al autor le llega "Están orando por vos".
- El aviso usa `tag: intercession-<id>`: si oran varios, el dispositivo **reemplaza**
  el aviso por uno que actualiza el conteo ("Ya son N personas orando…"), no apila.
- No se avisa si el autor tiene los avisos del grupo apagados
  (`profiles.group_prayer_notifications_enabled = false`), ni para pedidos ya
  respondidos, ni al propio autor.
- Logs: Supabase → Edge Functions → `notify-intercession` → Logs.
