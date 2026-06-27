# Plan Fase 3 — Lee Tu Biblia

> Plan paso a paso de las funcionalidades nuevas + arreglo de onboarding.
> Redactado 2026-06-27. Principio rector: **la app acompaña la lectura en Biblia
> física; nunca trae el texto bíblico adentro.** Todo lo de abajo lo respeta.
>
> Convenciones del repo a seguir en cada paso:
> - Migración nueva = archivo `supabase/migrations/00NN_*.sql` (próximo libre: **0015**),
>   luego `node scripts/bundle-migrations.mjs` y aplicar `_apply_pending.sql`.
> - RLS con helpers security-definer (`is_group_member`, `is_group_owner`, `can_see_prayer`).
> - Lógica de datos en `src/lib/db.js` (una función por operación, lanza en error).
> - Componentes reutilizables ya existentes: `Sheet`, `ConfirmDialog`, `Switch`,
>   `Segmented`, `RetryError`, `Skeleton`, `Avatars`.
> - Verificar en preview (config `dev-preview`, puerto 5180) antes de cerrar cada paso.

---

## Orden recomendado

| Orden | Pieza | Esfuerzo | Por qué ahí |
|------:|-------|:--------:|-------------|
| 0 | Fix de onboarding (#1) | S | Desbloquea a usuarios nuevos; cae justo en la activación. |
| 1 | Reflexión de una línea | M | Profundiza el acto central; mayor sentido/retención. |
| 2 | Racha de gracia (3a) | S | Puro cálculo, sin esquema; encarna el "sin culpa". |
| 3 | Seguimiento de oración (#4) | M+M | Refuerza el diferenciador (loop pedido→testimonio). |
| 4 | Presencia del grupo (#2) | M | Social; requiere opt-in y cuidado de timezone. |
| 5 | Cierre de plan + resumen (3b) | M | Deleite; rinde más cuando ya hay historial que resumir. |

Cada pieza es independiente y se puede mover. Abajo, el plan detallado de cada una.

---

## Paso 0 — Fix de errores de onboarding (#1)

**Problema.** Dos pantallas del onboarding tragan errores:
- `AskName.jsx:20` — si `updateProfile` falla, solo hace `console.error`; el botón se
  des-deshabilita y no pasa nada visible. El usuario queda trabado sin saber por qué.
- `ChoosePlanOnboarding.jsx:72-73` — si `getPlans()` falla, muestra el error **pero**
  `plans` queda `null`, así que "Cargando planes…" persiste para siempre y no hay reintentar.

**Pasos.**
1. `AskName.jsx`: agregar estado `error`; en el `if (error)` del `handleContinue`, setear
   un mensaje (`'No se pudo guardar. Probá de nuevo.'`) y mostrarlo inline con `var(--danger)`
   (mismo patrón que ChoosePlan). Re-habilitar el botón (ya lo hace con `saving=false`).
2. `ChoosePlanOnboarding.jsx`: separar los tres estados (cargando / error / cargado).
   Cuando `getPlans()` falla, NO dejar "Cargando planes…"; renderizar `RetryError`
   (componente existente) con un callback que re-dispara la carga. Extraer la carga a una
   función `loadPlans()` reutilizable por el efecto y el botón.
3. Verificar en preview forzando un fallo (cortar red / tirar error en `getPlans`).

**Esfuerzo:** S (~30 min). **Sin migración. Sin RLS.**

---

## Feature 1 — Reflexión de una línea ("Mi camino")

**Objetivo.** Al marcar leído, ofrecer (opcional) anotar *"¿Qué te habló hoy?"*. Con el
tiempo arma un diario devocional propio. **Captura el fruto, no el texto** — el usuario
escribe sus palabras; la Escritura sigue en el papel. ✔ Respeta el principio.

**Modelo de datos — migración `0015_reading_reflections.sql`.**
```sql
create table if not exists public.reading_reflections (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  plan_id     bigint not null references public.reading_plans(id) on delete cascade,
  day_number  integer not null check (day_number >= 1),
  body        text not null check (char_length(body) between 1 and 1000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, plan_id, day_number)   -- una reflexión por día de plan
);
create index if not exists reflections_user_idx
  on public.reading_reflections(user_id, created_at desc);

-- Toggle del diario (opt-in, OFF por defecto).
alter table public.profiles
  add column if not exists reflections_enabled boolean not null default false;
```
Tabla aparte (no columna en `reading_progress`) para: mantener liviano el camino crítico
de racha/heatmap, permitir el diario cronológico cross-plan, y editar/borrar sin tocar el
marcado idempotente.

**RLS.**
```sql
alter table public.reading_reflections enable row level security;
create policy "own reflections" on public.reading_reflections
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
```

**`db.js`.**
- `getReflection(userId, planId, dayNumber)` → `maybeSingle()`.
- `upsertReflection(userId, planId, dayNumber, body)` → `upsert` on `user_id,plan_id,day_number`,
  setea `body` + `updated_at = now()`.
- `deleteReflection(userId, planId, dayNumber)`.
- `getReflectionJournal(userId, { limit = 30, before = null })` → lista cross-plan ordenada
  por `created_at desc`, con `join reading_plans(name)` para mostrar "Plan · Día N".

**Decisiones cerradas (2026-06-27).**
- **Se anota al marcar leído** (no hay creación de notas sueltas).
- **Ventana de edición "tipo WhatsApp":** la nota es editable/borrable **solo hasta la
  medianoche local del día en que se escribió** (`localDateISO(created_at) === todayLocalISO()`).
  Pasado ese día queda **sellada** (solo lectura). Es una regla de **UX aplicada en el cliente**;
  no necesita backend porque la nota es privada del propio usuario (sin riesgo de datos). Si en
  el futuro se quiere inmutabilidad real, un trigger que valide la ventana contra `profiles.timezone`.
- **Toggle "Diario de reflexión" OFF por defecto** (opt-in).

**UI.**
1. `Ajustes.jsx` — toggle **"Diario de reflexión"** (`Switch`), **off por defecto**, persiste en
   `profiles.reflections_enabled` (vía `updateProfile`). Off → oculta el affordance en Hoy y el
   acceso a "Mi camino"; **no borra** las notas existentes. Incluir una línea descriptiva en el
   toggle (al estar off por defecto, es el único punto de descubrimiento de la feature).
2. `Hoy.jsx` — solo si el toggle está on: al marcar leído, el **botón secundario "Abrir en mi
   app de Biblia" se transforma** en "Anotá lo que te habló Dios hoy" (ya leíste → ese botón no
   hace falta), que abre el `ReflectionSheet`. Si ya hay nota: "Editar tu nota" / "Ver tu nota"
   (sellada). Sin elemento suelto extra. Con el diario OFF, el botón queda como "Abrir en mi app
   de Biblia". Placeholder que protege el principio: *"Una idea, una frase… lo que te quedó"*.
3. Nueva pantalla **`/diario`** ("Mi camino"): tarjetas { fecha, Plan · Día N, cuerpo },
   "Cargar más" (paginación con `before`). Las notas **de hoy** se editan/borran (mismo `Sheet`);
   las **pasadas** son solo lectura. Empty state + `RetryError`. Acceso desde Progreso
   ("Mi camino ›") y secundario desde Hoy tras anotar.

**Offline.** MVP online-only para reflexiones (la cola offline se reserva al marcado, el acto
central). Sin red al guardar: "se guarda cuando vuelvas a tener conexión" y Guardar deshabilitado.

**Edge cases.** `body` vacío al guardar (dentro de la ventana de hoy) = borrar la nota. Marcar
hoy un día atrasado crea una nota editable hoy (la ventana cuenta desde que se escribió, no desde
el día del plan). Editar desde el heatmap de Progreso queda descartado por la regla de sellado.

**Esfuerzo:** M. **Futuro natural:** "compartir esta reflexión con mi grupo" (enlaza con grupos).

---

## Feature 2 — Racha de gracia (sin culpa)  *(3a)*

**Objetivo.** Faltar un día no mata la racha. Operacionaliza el ADN "sin apuro": en vez de
caer a 0 y generar culpa, se tolera un hueco con presupuesto acotado.

**Decisión de diseño.** Implementarlo como **cálculo puro, sin esquema** (funciona offline,
no agrega estado). Nueva función en `db.js`:
```
computeDateStreakWithGrace(dateSet, todayISO, { graceWindow = 7, gracePerWindow = 1 })
```
Camina hacia atrás como `computeDateStreak`, pero al toparse con una fecha faltante, si hay
un "comodín" disponible (ninguno usado en los últimos `graceWindow` días) lo consume y sigue;
si no, corta. Mantener `computeDateStreak` (estricta) por si se necesita en algún cómputo;
cambiar **solo la racha mostrada** (Hoy + Progreso + snapshot offline) a la versión con gracia.

**`db.js` / `useReading.js`.**
- Agregar `computeDateStreakWithGrace`.
- En `useReading.js`, `streakLive` pasa a usar la versión con gracia; el `streak` guardado en
  el snapshot (`persistSnapshot`) también.
- **Tests:** agregar/extender los unit tests de la regla canónica (localizar el harness de
  tests del día/racha; si no existe ya como archivo, crear uno mínimo para esta función:
  casos sin hueco, un hueco dentro de ventana, dos huecos seguidos, hueco fuera de ventana).

**UI.** Opcional y sutil: cuando la racha se sostuvo gracias a un comodín, un hint discreto
("🛟 usaste tu comodín de la semana"). MVP: gracia silenciosa (la racha simplemente no cae).

**Esfuerzo:** S. **Sin migración. Sin RLS.** ✔ Respeta el principio (no toca contenido).

---

## Feature 3 — Seguimiento de oración ("¿cómo va aquel pedido?")  *(#4)*

**Objetivo.** Empujar suavemente a revisar pedidos `active` viejos → impulsa la conversión
pedido → respondido → **testimonio**, que es el diferenciador relacional de la app.

**Modelo de datos — migración `0016_prayer_followup.sql`.**
```sql
alter table public.prayer_requests
  add column if not exists last_reviewed_at timestamptz;   -- "lo revisé / sigue igual"

alter table public.profiles
  add column if not exists prayer_followup_enabled boolean not null default true,
  add column if not exists prayer_followup_last_sent date;  -- dedupe semanal del push
```
"Antigüedad" de un pedido = `greatest(created_at, coalesce(last_reviewed_at, created_at))`.

**RLS.** Ninguna nueva: `prayer_requests` ya tiene RLS por dueño/visibilidad; `last_reviewed_at`
queda cubierta por las políticas de update existentes (solo el autor).

**`db.js`.**
- `getPrayersToReview(userId, days = 30)` → `prayer_requests` del usuario, `status='active'`,
  antigüedad > `days`, orden por antigüedad asc.
- `markPrayerReviewed(id)` → `update { last_reviewed_at: now() }` ("sigue igual" reinicia el reloj).

**UI (in-app, primero).**
- En `Oracion.jsx`, sección **"Para revisar"** arriba (cuando no está vacía): cada pedido con
  acciones rápidas — *Sigue igual* (bump → `markPrayerReviewed`), *Respondida* (abre el flujo
  de testimonio existente en `PrayerSheet`), *Editar*. Reusar `ConfirmDialog` donde aplique.

**Push (segundo) — Edge Function `prayer-followup` + cron `0017_prayer_followup_cron.sql`.**
- Función Deno (patrón de `send-reminders`): para perfiles con `prayer_followup_enabled=true`,
  contar sus pedidos revisables; si ≥1 y no se envió esta semana, mandar **un** push digest
  ("Tenés N pedidos para revisar 🙏", `tag: 'prayer-followup'` para colapsar). Sellar
  `prayer_followup_last_sent` con la fecha local (dedupe semanal, como `reminder_last_sent`).
- Cron semanal vía pg_cron + pg_net leyendo URL+service_role del **Vault** (idéntico a 0013/0014).
- `Ajustes.jsx`: toggle "Avisarme de pedidos para revisar" (mismo patrón honesto que el
  recordatorio: el switch refleja el estado real).

**Esfuerzo:** M (in-app) + M (push). Enviar primero el in-app; el push después.
✔ Respeta el principio (es sobre oración, no sobre el texto bíblico).

---

## Feature 4 — Presencia del grupo en la lectura  *(#2)*

**Objetivo.** En un grupo, ver cuántos miembros ya leyeron hoy ("3 de 5 leyeron hoy").
Convierte el hábito solitario en un ritmo comunitario silencioso. **Solo conteos/identidad
opt-in, jamás contenido.** ✔ Respeta el principio.

**Privacidad — modelo recíproco.** Compartir es **opt-in** (`profiles.share_reading`,
default `false`) y **recíproco**: para *ver* la presencia del grupo hay que *compartir* la
propia. Justo y simple.

**Definición de "leyó hoy".** Igual que la racha: tener al menos una marca con `completed_at`
cuya fecha **en la timezone del miembro** sea su día actual. Se calcula server-side desde
`reading_progress` (no hace falta columna nueva ni escritura del cliente).

**Modelo de datos — migración `0018_group_reading_presence.sql`.**
```sql
alter table public.profiles
  add column if not exists share_reading boolean not null default false;

-- "Leyeron hoy" entre los miembros opt-in del grupo (recíproco: el caller debe ser miembro).
create or replace function public.group_reading_today(p_group_id bigint)
returns table (read_count int, member_count int)
language sql security definer stable set search_path = public as $$
  with members as (
    select p.id, coalesce(p.timezone, 'UTC') as tz
    from public.group_members gm
    join public.profiles p on p.id = gm.user_id
    where gm.group_id = p_group_id
      and p.share_reading = true
      and public.is_group_member(p_group_id)   -- gate: caller debe ser miembro
  )
  select
    count(*) filter (where exists (
      select 1 from public.reading_progress rp
      where rp.user_id = m.id
        and (rp.completed_at at time zone m.tz)::date = (now() at time zone m.tz)::date
    ))::int as read_count,
    count(*)::int as member_count
  from members m;
$$;
```
(Nota: el gate `is_group_member` dentro del CTE asegura que un no-miembro reciba 0/0.)

**`db.js`.** `getGroupReadingToday(groupId)` → llama al RPC, devuelve `{ read_count, member_count }`.

**UI.**
- `Ajustes.jsx`: toggle "Compartir mi lectura con mis grupos" (`Switch`), persiste `share_reading`.
- `Hoy.jsx`: si el usuario comparte y tiene grupos, una fila/tarjeta **discreta** debajo de la
  lectura — "En [grupo]: 3 de 5 leyeron hoy". Con varios grupos, una línea por grupo (o el
  más activo). Reusar `Avatars` si más adelante se muestra *quién* leyó (fase 2 de la feature).
- Opcional: misma señal en `GroupDetail.jsx`.

**Edge cases.** `timezone` null → fallback `'UTC'` (señal "suave", error de borde aceptable;
documentar). Si nadie opta-in, mostrar `member_count=0` → ocultar la tarjeta.

**Esfuerzo:** M. **Escala:** un RPC por grupo visible; suficiente a la escala actual.

---

## Feature 5 — Cierre de plan + "Tu año en la Palabra"  *(3b)*

**Objetivo.** Celebrar terminar un plan (momento que casi ninguna app de hábito marca) y dar
un resumen periódico que haga **visible** el progreso. Deleite + retención. ✔ Respeta el
principio (resume el hábito, no muestra Escritura).

**Datos.** Casi todo es derivable de tablas existentes — **sin esquema nuevo** en el MVP:
- Días leídos / % en término: `reading_progress` del plan vs `duration_days`.
- Racha más larga (histórica): computar client-side sobre todas las fechas `completed_at` del
  usuario (cross-plan) con un helper `longestStreak(dateSet)` en `db.js`.
- Planes completados: `(distinct day_number para user+plan) == duration_days`.
- Pedidos respondidos / testimonios: `prayer_requests` (`status='answered'`, `testimony_shared`).
- (Si la racha histórica resulta cara client-side a futuro, mover a un RPC `user_year_stats`.)

**`db.js`.**
- `getCompletedPlans(userId)` → planes cuyo progreso llega a `duration_days`.
- `getYearStats(userId, { from, to })` → agrega días leídos, racha más larga, planes
  completados, pedidos respondidos, testimonios compartidos.
- `longestStreak(dateSet)` (helper puro, testeable).

**UI.**
1. **Cierre de plan** — enriquecer el estado `planFinished` de `Hoy.jsx` (hoy es un texto +
   🎉): tarjeta de cierre con stats del plan (días leídos, racha más larga, fechas
   inicio→fin), botón "Elegir nuevo plan" y "Compartir" (`navigator.share` de un resumen de
   texto). Transición de cierre suave (ya hay tokens de motion).
2. **Resumen** — pantalla **`/resumen`** ("Tu camino en la Palabra"): tarjetas con los
   agregados de `getYearStats`, planes completados, y un mini-heatmap del período. Acceso
   desde Progreso y desde la tarjeta de cierre. Empty state + `RetryError`.

**Esfuerzo:** M. **Edge cases.** Usuario nuevo sin historial → empty state alentador, no ceros fríos.

---

## Notas transversales

- **Navegación.** `/diario` y `/resumen` se enganchan desde Progreso (y Hoy donde aplique)
  para no agregar pestañas y mantener limpia la tab-bar/sidebar (`components/nav.js`).
- **A11y.** Mantener el estándar ya logrado: `Switch`/`Segmented` accesibles, `RetryError`
  con `role=alert`, focus visible. (Pendiente menor preexistente: `aria-pressed` en el botón
  "Marcar como leído" de `Hoy.jsx` — conviene cerrarlo al tocar esa pantalla en Feature 1.)
- **Migraciones.** Tras agregar cada `00NN`, correr `node scripts/bundle-migrations.mjs` y
  aplicar `_apply_pending.sql`. Las Edge Functions nuevas requieren `supabase functions deploy`.
- **Verificación.** Cada paso se cierra con una pasada en preview (`dev-preview`, 5180) y,
  donde toque push, una prueba en dispositivo (la cadena ya está verificada en prod).
