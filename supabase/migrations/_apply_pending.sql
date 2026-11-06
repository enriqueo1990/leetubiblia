-- ============================================================
-- Lee Tu Biblia — MIGRACIONES PENDIENTES (staging incremental).
-- Pendiente de aplicar: 0038 (acento de fábrica Cielo). NO aplicada todavía.
--
-- Pegá este archivo en el SQL Editor de Supabase y Run. Después volvé a vaciarlo
-- (o regenerá todo con: node scripts/bundle-migrations.mjs).
-- Para un deploy desde cero usá _apply_all.sql.
-- ============================================================

-- ============================================================================
-- Lee Tu Biblia — Acento de fábrica: Cielo.
-- Migración 0038. Aplicar DESPUÉS de 0001 y 0008 (valor 'pastel_sky'). Idempotente.
--
-- La dirección visual «Cielo» (2026-11-04) tiene como acento de fábrica
-- `pastel_sky`, pero el perfil nuevo volvía a poner 'sepia_base' y pisaba el
-- Cielo del navegador (ProfilePrefSync). Solo cambia el DEFAULT: las cuentas
-- existentes NO se tocan (en la base no se distingue a quien eligió Sepia a
-- propósito de quien nunca tocó el color; eso se decide aparte).
-- ============================================================================

alter table public.profiles alter column accent_color set default 'pastel_sky';
