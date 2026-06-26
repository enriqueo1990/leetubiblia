# Revisión de producto — Lee Tu Biblia

> Revisión como Product Owner · 2026-06-26 · Fase 1 completa + Fase 2 (parte 1) iniciada.
> Metodología: 12 superficies de producto evaluadas en paralelo, cada hallazgo verificado
> adversarialmente contra el código, más una pasada de crítica de completitud.

## Veredicto

El **núcleo está construido y, en sesión caliente y online, funciona** y es fiel al brief pastoral:
bucle diario de Hoy (día canónico, marcado idempotente, deep-link YouVersion, reprogramar sin culpa),
progreso con heatmap, oración privada/compartida, grupos por código, e incluso Fase 2 (intercesión y
testimonios) cableada con RLS coherente.

Pero **no entrega aún su promesa de retención ni su garantía de confianza en un deploy real.** Tres
eslabones no cierran (push, arranque offline, contenido sucio) y hay *drift* spec↔código.

**Readiness: Casi.** No lanzar hasta cerrar los P0 y poner fricción a la transición privado→compartido.

## Salud por área

| Área | Salud | En una línea |
|---|:---:|---|
| Notificaciones / push | 🔴 30 | Cadena cliente+edge existe, pero cron y trigger no versionados: en deploy real no llega nada |
| PWA / offline | 🔴 45 | Instalable y con cola de sync, pero el arranque offline en frío cuelga la app entera |
| Estrategia / retención | 🟠 48 | Diferenciador pastoral fuerte pero invisible: push roto, racha escondida, sin re-engagement |
| Conformidad con el máster | 🟠 50 | 8 planes vs 3, 12 acentos vs sepia único, cron/trigger fuera de migraciones |
| Planes y contenido | 🟠 55 | Días completos, pero basura de scraping en el día 365 del Cronológico y versículos imposibles |
| Privacidad y confianza | 🟠 58 | RLS correcta, pero frontera privado→compartido sin fricción y service_role key en texto plano |
| Grupos cerrados | 🟠 60 | Crear/unir/admin funcionan, pero sin enlace de invitación, sin "salir del grupo" |
| Activación / onboarding | 🟡 62 | Flujo cuidado, pero login crea cuenta en silencio y el recordatorio promete 07:00 que no garantiza |
| UX / microcopy / estados | 🟡 64 | Diseño delicado, pero varias pantallas fallan mudas sin reintentar |
| Progreso y motivación | 🟡 68 | Heatmap y racha funcionan, pero flash de ceros al cargar y racha que puede caer a 0 offline |
| Bucle diario de lectura | 🟢 70 | Núcleo sólido online; reprogramar falla en silencio y offline degrada a pantallas rotas |
| Vida de oración | 🟢 72 | CRUD, intercesión y testimonios implementados; falta fricción al cambiar visibilidad |

## Fortalezas a preservar

- Bucle diario fiel a la spec, con la salida "sin culpa" (reprogramar) que pedía el brief.
- Vida de oración va más allá de Fase 1: intercesión + testimonios + stats pastorales ya construidos.
- RLS bien diseñada para privado/compartido/grupos cerrados; `profiles` no engorda con datos sensibles.
- Borrado de cuenta **correcto** por SQL versionado (`ON DELETE CASCADE`, verificado).
- Estética minimalista coherente con la promesa "estilo Apple" (empty states, heatmap accesible, `role=switch`).
- Offline cubre el caso caliente clave: snapshot de Hoy + cola de marcado con sync al reconectar.

---

## Decisiones de producto tomadas (2026-06-26)

- **Planes: mantener los 8 sembrados.** No se revierte a 3. Acción derivada: documentar la ampliación
  en máster + README y dar orden curado/desempate determinista (ver #17).
- **Acentos: mantener los 6 pastel.** No se revierte a sepia único. Acción derivada: actualizar
  máster + README para que dejen de contradecir al código (ver #18).

---

## Backlog priorizado

Severidad: **P0** rompe el valor central o compromete datos/privacidad · **P1** daña una tarea clave
o la activación/retención · **P2** fricción/pulido notable · **P3** menor. Esfuerzo: S/M/L.

### AHORA (bloqueantes de lanzamiento)

**#1 · P0 · M · Notificaciones —** Versionar en migraciones el cron de `send-reminders` y el trigger
`AFTER INSERT/UPDATE` de `notify-group-prayer`; **incluir la 0010 en `_apply_pending.sql`** (hoy la
omite y la query filtra por `group_prayer_notifications_enabled`); llave en Vault, sin project-ref
hardcodeado. *Hoy viven solo como SQL en READMEs → en deploy limpio no se dispara ningún push y la UI
(`Ajustes.jsx:262`) promete entrega que no ocurre.*

**#2 · P0 · M · PWA/offline —** Arreglar arranque offline en frío: cachear perfil + timeout/reintento/
estado de error en `Gate.jsx:32` / `auth.jsx:36-41` (`getSession().then` sin `.catch`; `loadProfile`
lanza offline → `setLoading(false)` nunca corre). *La PWA instalada se cuelga en "Cargando…" para
siempre; la misma raíz cuelga online ante fallo de RLS/red al cargar perfil.*

**#3 · P0 · M · Planes/contenido —** Limpiar el plan Cronológico (basura de scraping en el **día 365**
+ versículos imposibles: `Salmos 117:1-29` cuando tiene 2 vv., `Salmos 118:1-176`) y hacer que
`scripts/seed.mjs` **aborte** ante mismatch/basura en vez de `console.warn` y seguir. *Texto de
scraping mostrado como pasaje al cerrar el plan; erosiona credibilidad bíblica.*

**#4 · P0/P1 · S · Seguridad —** Rotar el `service_role` key ya expuesto (omite RLS sobre TODOS los
pedidos privados), moverlo a Vault, verificar que no esté en el historial de git, sacar `.env` y
`.vapid-keys.txt` del árbol. *Documentado en texto plano en SQL pegable con project-ref real
`jugddsluulcdhplyjwou`.*

**#5 · P1 · S · Notificaciones —** Desacoplar push: apagar el recordatorio diario llama
`unsubscribeFromPush` y **borra la fila de `push_subscriptions`**, matando también los avisos de grupo
aunque su switch siga en ON (`Ajustes.jsx:100`). Separar suscripción de recordatorio vs avisos.

**#6 · P1 · M · Privacidad —** Confirmación/fricción al cambiar visibilidad de oración a "compartido"
+ trigger `AFTER UPDATE` que notifique al grupo + limpiar intercesiones huérfanas + guard
`status==='active'` en el botón "estoy orando" (`PrayerDetail.jsx`). *`0002_rls.sql:128` permite el
cambio sin restricción ni aviso; compartir por edición no notifica; quedan intercesiones contando en
stats pastorales.*

**#7 · P1 · S · Lectura —** `reprogramar()` (`useReading.js:184`): capturar el `{error}` de
`updateProfile`, estado busy/disabled, feedback de éxito/fallo (online y offline). *La acción "volver
sin culpa" falla en silencio y deja al usuario atascado en el atraso.*

### SIGUIENTE

**#8 · P1 · S · Onboarding —** Login con `shouldCreateUser:false` (`auth.jsx:58`) + copy "revisá spam /
usar otro correo" en la pantalla de código. *"Ya tengo cuenta" con email mal tipeado crea cuenta nueva
en silencio.*

**#9 · P1 · M · Notificaciones —** Switches sinceros: gatear por `isPushSupported()` (existe, nunca se
usa en `Ajustes.jsx`), respetar el resultado de permiso/suscripción, no dejar `reminder_enabled=true`
si el push falla (Ajustes + `OnboardingExtras.jsx:35`).

**#10 · P1 · S · Notificaciones —** Persistir `profiles.timezone` al activar el recordatorio,
independiente de la suscripción push (hoy solo se setea en `push.js:60`). *`send-reminders` excluye a
todo perfil sin timezone → el recordatorio nunca llega (iOS, onboarding).*

**#11 · P1 · M · UX/estados —** Estado de carga/error/sin-conexión con **Reintentar** en `Grupos.jsx`,
`GroupDetail.jsx`, `PrayerDetail.jsx`, `GroupTestimonies.jsx` y `Progreso.jsx` (replicar el patrón ya
existente en Oración/Planes). *`Grupos.jsx:148` hace `setGroups(await ...)` sin try/catch → "Cargando…"
eterno si falla la red.*

**#12 · P1 · S · Progreso —** Regresión de racha offline: `rebuildCompletedMap` (`useReading.js:41`)
hidrata el snapshot viejo con `completed_at=null` → la racha puede mostrar **0 offline aunque el usuario
haya leído**. Arreglar eso + el flash de ceros (`Progreso.jsx` no consulta `r.loading`).

**#13 · P1 · S · Retención —** Mostrar la racha en **Hoy** (hoy solo vive en Progreso) y dar
confirmación/recompensa al marcar leído.

### DESPUÉS

**#14 · P2 · S · Grupos —** Acción "Salir del grupo" para no-owner (UI + helper `leaveGroup`; la RLS ya
lo permite). *Hoy el único escape es borrar la cuenta.*

**#15 · P2 · M · Grupos —** Enlace de invitación `app/join?code=XXXX` (ruta `/join` + `navigator.share`).
*El máster lo pide; hoy solo se copia un código de 6 chars a tipear a mano.*

**#16 · P2 · S · Privacidad —** `getGroupPrayers` (`db.js:258`): filtrar por `status='active'`; hoy
mezcla pedidos respondidos íntimos con activos, acumulándose sin curaduría.

**#17 · P2 · S · Catálogo (decisión: mantener 8) —** Documentar la ampliación a 8 planes en máster +
README y dar orden curado + **desempate determinista** en `getPlans` (`db.js:9`, ordena solo por
`duration_days`; 4 planes de 365 días quedan en orden indefinido).

**#18 · P2 · S · Acentos (decisión: mantener pastel) —** Actualizar máster + README para documentar los
6 acentos pastel como decisión consciente (`useAccent.js:14` / migración 0008). Opcional: re-tintar a
saturación más baja para no romper del todo el minimalismo.

**#19 · P2 · M · Lectura —** Recomputar día/refs offline cuando pasa la fecha + avisar que las lecturas
pueden ser de la última sync. *Offline al día siguiente, el header muestra la fecha de hoy sobre un
"Día N" y refs viejas del snapshot.*

**#20 · P2 · M · Retención —** Empty-states y onboarding que expongan el diferenciador (oración
compartida / grupos) + CTA en Oración vacía hacia Grupos. *Hoy el onboarding vende solo lectura.*

**#21 · P2 · M · Retención —** Push de intercesión ("alguien empezó a orar por tu pedido") — disparador
de retorno del modelo pull (`addIntercession`, `db.js:381`, no dispara nada).

**#22 · P2 · S · Oración —** Usar `answered_at` en la lista de respondidos (hoy muestra `created_at`).

**#23 · P3 · M · Pulidos —** Target "+" ≥44px, 404/catch-all, `aria-live` en estados, transición de
cierre de plan, status-bar OLED en iOS, microcopy divergente, `aria-label` en `Avatars.jsx`, y no
commitear `dist/` (sirve SW/precache viejo).
