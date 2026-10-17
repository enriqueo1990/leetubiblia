# Plan: corregir los hallazgos de la revisión de vistas

Plan de ejecución para un agente. Cubre los 83 hallazgos de
`REVISION_VISTAS_2026-10-13.md`, agrupados por tema en 26 tareas y 7 fases. Está
pensado para hacerse de punta a punta sin preguntar: cada tarea dice qué cambiar,
dónde, con qué criterio y cómo verificarlo. Las decisiones de producto ya están
tomadas y marcadas como **Decisión**. Si algo del código no coincide con lo descrito,
el código manda: leé el archivo real antes de editar.

Leé primero `REVISION_VISTAS_2026-10-13.md` completo: ahí está el porqué de cada
cambio y la línea exacta. Este plan dice el cómo.

## 1. Reglas del juego

### Principios que no se negocian

1. **Biblia física.** Nunca mostrar texto bíblico dentro de la app. Referencias sí.
2. **Canon de diseño.** Reusar `EmptyState`, `RetryError`, `Skeleton*`, `BackLink`,
   `Sheet`, `ConfirmDialog`, `Segmented`, `Switch`, la clase `.card`, `.btn`,
   `divide-y divide-hairline`, los tokens (`var(--accent-ink)`, `text-ink`,
   `text-ink-soft`, `var(--danger)`). Un solo acento. Sans del sistema. Una acción
   primaria por estado. Targets de 44 px (`min-h-11`). Miga honesta con `state.from`.
3. **Secciones etiquetadas.** Cada bloque con encabezado y sus botones dentro de su
   contexto. La confirmación de una acción aparece donde ocurrió el toque.
4. **Optimista pero honesto.** La interfaz avanza ya; si el guardado falla, se
   revierte y se avisa con `role="alert"` junto al control. Nunca navegar ni cerrar un
   diálogo como si hubiera salido bien cuando no se guardó.
5. **i18n en los tres idiomas siempre.** Toda clave nueva va en `src/i18n/es.json`,
   `en.json` y `pt.json`. Tono cercano, sin culpa. Español con voseo ("Podés", "Vas
   en"). Portugués sin marcas de género (nada de "o primeiro", "o administrador":
   reformular con verbos o sustantivos neutros).
6. **Comentarios en español**, breves, explicando el porqué.
7. **Base de datos.** La única migración nueva de este plan es la de T9 y se llama
   `supabase/migrations/0033_reflection_cycles.sql` (la última existente es 0032).
   Después de escribirla, regenerá los agregados con `node scripts/bundle-migrations.mjs`
   (leé el script antes para confirmar qué produce: `_apply_all.sql` y
   `_apply_pending.sql`). **Nunca aplicar una migración a producción desde el
   agente.** El código que depende de una columna
   nueva debe tolerar que todavía no exista, con el mismo patrón que
   `missingCompletedOn` en `src/lib/db.js`: si el error dice que la columna no
   existe, caer al comportamiento anterior.

### Verificación

Después de cada tarea, las tres tienen que pasar:

```bash
npm run lint
```

```bash
npm test
```

```bash
npm run build
```

Lint tiene 3 advertencias históricas de `react-refresh/only-export-components`; no
sumar errores ni advertencias nuevas. Cuando una tarea toque lógica pura (fechas,
racha, filas, catálogo), agregá un test en `tests/*.test.mjs` con `node:test`,
siguiendo `tests/today-extras.test.mjs`. La lógica que se quiera testear tiene que
vivir en un módulo sin React ni JSX.

No podés iniciar sesión en la app, así que no hay verificación visual con datos.
Verificá leyendo el código que tocaste y con las tres herramientas. Si el usuario
dejó una sesión abierta en el panel del navegador, sacá una captura; si no, no
insistas.

### Commits

Un commit por tarea, mensaje en inglés en imperativo, con un cuerpo corto si hace
falta. Terminá cada mensaje con la línea `Co-Authored-By` que indique la
configuración de tu sesión. **No hacer push.** Al terminar todo, reportá la lista de
commits, qué se verificó y qué quedó sin hacer y por qué.

### Orden

Las fases van en orden: las primeras tocan confianza y datos, las últimas pulido.
Dentro de una fase, las tareas son independientes salvo que se diga lo contrario.
Si una tarea se traba, dejala documentada en el reporte final y seguí con la
siguiente; no frenes el resto.

---

## 2. Fase 1: guardados honestos

Patrón A de la revisión. El objetivo es que ningún guardado falle mudo.

### T1. Un helper de guardado con reversión

Crear `src/lib/saveWithRevert.js` con una función pura y un hook:

```js
// Ejecuta un guardado que devuelve { error } (como updateProfile). Si falla,
// corre `revert` y devuelve false; si sale bien devuelve true.
export async function saveOrRevert(save, revert) { ... }
```

y en `src/hooks/useSaveState.js` un hook `useSaveState()` que devuelve
`{ saving, error, run }` donde `run(save, revert)` marca `saving` mientras corre,
guarda `error` si falla y lo limpia al próximo intento. Con esto las pantallas
muestran el error junto al control sin repetir la lógica.

Crear también `src/components/InlineError.jsx`: un `<p role="alert">` en 13 px con
`color: var(--danger)` y `mt-1`, que recibe `message`. Es el único estilo de error
inline a partir de ahora.

**Aceptación.** Módulos creados, con test del helper puro en `tests/save.test.mjs`
(éxito, fallo con reversión).

### T2. PlanDetail: activar o cambiar plan sin mentir

Archivo: `src/screens/PlanDetail.jsx:88-103`.

- Leer `{ error }` de `updateProfile`. Si hay error: no navegar, no cerrar el
  diálogo, mostrar `InlineError` con `common.saveError` dentro del diálogo o bajo el
  botón, y volver a habilitar el botón.
- Si `markDaysRead` falla al engancharse en el día N, no tragarlo: mostrar un aviso
  con reintento en Hoy no es viable desde acá, así que mostrar en PlanDetail un
  `InlineError` con la clave nueva `planes.markPreviousError` ("Tu plan quedó
  activo, pero no pudimos marcar los días anteriores. Podés marcarlos desde
  Progreso.") y recién entonces navegar al tocar un botón "Ir a Hoy".
- Línea 190: `days === null && !loadError && <SkeletonRows />` para que el skeleton
  no conviva con el error.

**i18n nuevo.** `planes.markPreviousError` en los tres idiomas.

### T3. Ajustes: cada guardado revierte y avisa donde ocurrió

Archivo: `src/screens/Ajustes.jsx`.

- Todos los `updateProfile(...)` (líneas ~113, 137-152, 182, 334, 525 y los que
  encuentres) pasan por `useSaveState().run`. Para acento, tema, idioma y proveedor,
  el `revert` vuelve al valor anterior con el mismo setter que lo aplicó.
- El control afectado se deshabilita mientras `saving`.
- El error se muestra como segunda línea de la `Row` afectada con `InlineError`, no
  al pie de la tarjeta.
- Lo mismo para las notas de resultado del push: `pushNote` ya guarda `target`;
  renderizar la nota en la fila que corresponde a ese `target`. `exportNote` va bajo
  "Descargar mi camino".
- En iOS no instalado, la nota del recordatorio enlaza a los pasos de instalación
  (hoy la fila "Instalar" nunca aparece en iOS). Reusar el texto de
  `onboarding.extras.addToHome*`.

**Aceptación.** `grep -n "updateProfile" src/screens/Ajustes.jsx` muestra solo
llamadas dentro de `run(...)`. Ninguna nota se renderiza fuera de su fila.

### T4. GroupDetail: acciones del líder con error visible

Archivo: `src/screens/GroupDetail.jsx:322-340` y `src/screens/groupDetail/`.

- `runConfirm` suma un `catch` que guarda `confirmError` y lo muestra con
  `InlineError` dentro del `ConfirmDialog` (si el componente no acepta hijos, agregar
  prop `error` a `ConfirmDialog` y renderizarla bajo el mensaje). El diálogo queda
  abierto para reintentar.
- `GroupPlanSheet.jsx:42-43`: reemplazar el texto plano por `RetryError` con
  `onRetry` que vuelva a llamar `getPlans`.
- `GroupPlanCard.jsx:24, 97-112`: recibir `hasPlan = !!group.plan_id`. Si
  `hasPlan && !planInfo`, mostrar un estado de error con reintento (no el vacío con
  "Elegí un plan").

### T5. Hoy: volver a leer el plan sin perder datos

Archivo: `src/screens/Hoy.jsx:206-226`, `src/lib/auth.jsx:217-231`.

- Invertir el orden: primero `updateProfile({ plan_start_date: hoy })` y leer
  `{ error }`; solo si salió bien, `clearPlanProgress`. Lo recuperable va primero.
- Si `updateProfile` falla: no cerrar el diálogo, `InlineError` con
  `common.saveError`. Si `clearPlanProgress` falla después: cerrar el diálogo y
  mostrar un aviso con reintento en Hoy (`RetryError` compacto o `InlineError` con
  botón "Reintentar").
- Mover el `role="status"` de `hoy.reprogramado` fuera del bloque condicionado a
  `showBehind`, con autoapagado a los 4 segundos. Evitar que `load()` vuelva a
  mostrar `SkeletonHoy` cuando el plan ya está cargado: solo en la carga inicial.
- Línea 624: agregar `readingUnavailable` a la salida temprana para no renderizar la
  barra de acción vacía.

### T6. Materiales: apagar con cuidado y errores en su fila

Archivo: `src/screens/Materiales.jsx:48-55, 98-109`.

- Si el material está activo y `position > 1` o tiene `readOn`, apagar pide
  `ConfirmDialog` con la clave nueva `materiales.confirmOff` ("Si lo apagás, el
  marcador vuelve al principio. ¿Seguimos?"). **Decisión:** se conserva el
  comportamiento de reiniciar al reactivar; solo se agrega la confirmación.
- El `Switch` se deshabilita mientras guarda; el error va con `InlineError` dentro de
  la tarjeta afectada, no al pie.
- Si `locale !== 'es'`, mostrar bajo el nombre una etiqueta corta
  `materiales.inSpanish` ("En español" / "In Spanish" / "Em espanhol"). Lo mismo en
  la portada del lector (`MaterialReader.jsx`, ficha 0).

**i18n nuevo.** `materiales.confirmOff`, `materiales.inSpanish`.

### T7. Cargas que no se cuelgan: "También hoy" y el lector

Archivos: `src/lib/todayExtras.js`, `src/screens/TodayExtrasView.jsx`,
`src/components/TodayExtras.jsx`, `src/screens/MaterialReader.jsx:95-105`,
`src/lib/materials.js:5`.

- En el hook, cada `loadMaterialContent(slug)` lleva `.catch(() => null)`; el
  `filter(Boolean)` ya tolera nulos. La carga de grupos guarda `error: true` en vez
  de disfrazarse de lista vacía. El hook devuelve `error` y `retry`.
- `TodayExtrasView`: si `error`, `RetryError` con `onRetry={retry}`. Si no, lo de
  siempre. Cambiar el skeleton a `SkeletonRows count={3} twoLine`.
- `TodayExtras` en Hoy: si `error`, no mostrar la pista de materiales; mostrar la
  etiqueta y una fila `RetryError` compacta.
- `MaterialReader`: `.catch(() => setLoadError(true))` y `RetryError` con reintento.
  Corregir el comentario de `materials.js:5`: los JSON no están precacheados, se
  cachean al usarse.

**Aceptación.** `grep -n "\.then(" src/lib/todayExtras.js src/screens/MaterialReader.jsx`
no muestra ningún `.then` sin `.catch` sobre un `import()` o consulta.

---

## 3. Fase 2: datos que no mienten

Patrón B. Son las tareas más delicadas; leé las funciones completas antes de tocar.

### T8. Racha y acumulados sobre todas las fechas del usuario

Archivos: `src/lib/db.js:139-159, 317-338`, `src/hooks/useReading.js:119-122, 274`,
`src/screens/Progreso.jsx`, `src/screens/Recorrido.jsx`.

- Nueva función `getAllReadDates(userId)` en `db.js`: todas las `completed_on`
  distintas de `reading_progress` del usuario, sin filtrar por plan. Tolerar la
  columna faltante con el patrón `missingCompletedOn`.
- `readDates` y la racha en `useReading` salen de ahí. `completed`, `percent` y el
  heatmap de días del plan siguen por plan. El heatmap de los últimos 35 días pinta
  `readDates` (todas las fechas), igual que la racha, para que número y cuadrados
  coincidan.
- El snapshot offline guarda también estas fechas.
- `getYearStats`: `totalDaysRead` = fechas vivas distintas + suma de
  `plan_completions.days_read` de los ciclos cerrados. Así renovar nunca baja el
  acumulado. Si una fecha viva pudiera superponerse con un ciclo cerrado del mismo
  día, no importa: el usuario leyó ese día.
- `useReading.js:270`: `Math.floor` para el porcentaje, y 100 solo si
  `planFinished`.
- Test: mover `computeDateStreak` (si no es ya puro) a un módulo sin React y cubrir
  racha con hueco, racha con "hoy todavía no", y suma de acumulados.

**Decisión.** La racha es del usuario, no del plan. El diálogo de cambio de plan ya
no necesita avisar nada sobre la racha; revisar su copy para no prometer de más.

### T9. Diario que sobrevive a renovar el plan

Archivos: `supabase/migrations/`, `src/lib/db.js:982-1030`, `src/screens/Hoy.jsx:146-148`,
`src/lib/auth.jsx`.

**Decisión.** Se introduce un "ciclo" del plan que cambia solo al activar o renovar,
nunca al reprogramar ni al fijar "¿En qué día vas?".

- Migración nueva: `alter table profiles add column plan_cycle integer not null default 0;`
  y `alter table reading_reflections add column cycle integer not null default 0;`
  Soltar la unique `(user_id, plan_id, day_number)` y crear
  `(user_id, plan_id, day_number, cycle)`. Reflejar en `_apply_all.sql`.
- `handleRenew` en Hoy y `activate` en PlanDetail: `plan_cycle: (profile.plan_cycle ?? 0) + 1`
  en el mismo `updateProfile`.
- `getReflection` filtra por `cycle = profile.plan_cycle`. `upsertReflection` incluye
  `cycle` y usa `onConflict: 'user_id,plan_id,day_number,cycle'`. `deleteReflection`
  también filtra por `cycle`. `getReflectionJournal` no filtra: el diario muestra
  todo, y para entradas de ciclos anteriores agrega una línea discreta con la fecha.
- Tolerancia: si el error dice que la columna `cycle` no existe, caer a la consulta
  anterior sin `cycle` (patrón `missingCompletedOn`).
- Hoy: con la nota del ciclo vigente ausente, la hoja abre en modo escritura.

**Aceptación.** Con la migración aplicada, renovar un plan deja las notas viejas en
el diario y permite escribir nuevas en los mismos días. Sin la migración, la app sigue
funcionando como hoy.

### T10. Lectura de grupo que comparte tu plan

Archivos: `src/screens/GroupReading.jsx`, `src/lib/todayExtrasRows.js`.

**Decisión.** A corto plazo se avisa; la clave propia del progreso de grupo queda
para más adelante y no entra en este plan.

- En `GroupReading`, si `data.planId === profile.active_plan_id` y la fecha de
  inicio difiere, mostrar bajo el header una línea `groupReading.samePlanNote`
  ("Este grupo lee tu mismo plan. Marcar acá también marca ese día en tu plan.").
  Corregir el comentario del archivo (líneas 14-16), que hoy promete lo contrario.
- `buildExtraRows`: agregar `samePlan: boolean` a las filas de grupo para que la fila
  pueda mostrar un punto de meta ("· tu plan") si se quiere; no es obligatorio
  pintarlo.
- Pasar `provider={bibleProvider}` y `externalHint={t('hoy.externalBibleHint')}` a
  `PassageList` en `GroupReading.jsx:110`, extrayendo `bibleProvider` de
  `usePreferences()`.
- `role="alert"` en el error de guardado de `GroupReading.jsx:120-124`.

**i18n nuevo.** `groupReading.samePlanNote`.

### T11. Grupos: cambiar plan con aviso, salida para el líder, pulso honesto

Archivos: `src/screens/GroupDetail.jsx`, `src/screens/groupDetail/*`, `src/lib/db.js`.

- **Cambiar el plan del grupo** cuando ya hay uno: `ConfirmDialog` con
  `groupDetail.changePlanConfirm` ("Quienes lo seguían en Hoy dejarán de verlo hasta
  que se sumen de nuevo. Quienes lo adoptaron como plan propio siguen con el
  anterior."). Reflejar lo mismo en `planPickerHelp`.
- **Eliminar grupo** para el owner: nueva `deleteGroup(groupId)` en `db.js`
  (la policy `groups owner delete` ya existe y `group_members` y
  `prayer_requests.shared_group_id` tienen `on delete cascade`; verificá que no haya
  otra tabla con FK a `groups` sin cascade antes de habilitarlo). Botón en la zona de
  Cuenta del grupo, `ConfirmDialog` `danger` con `groupDetail.deleteGroupConfirm`
  que nombre al grupo y diga que los pedidos compartidos ahí se van con él. Al
  confirmar, `navigate('/grupos', { replace: true })`. **Decisión:** no se agrega
  "pasar la administración" en este plan.
- **Pulso "N leyeron hoy":** excluir el propio `user_id` del conteo. Si el RPC
  devuelve ids, filtrar en cliente; si devuelve solo un número, cambiar el copy a
  "vos y N más" cuando el usuario comparte y leyó.
- **Miembros:** línea de ayuda bajo el encabezado cuando `iShare`:
  `groupDetail.membersShareHint` ("Solo se ve la lectura de quienes la comparten.").
- **"Ver todos"** en `GroupPrayers.jsx:57, 130`: expandir en el lugar con
  `groupDetail.seeRemaining` ("Ver los {n} restantes") en vez de ir a `/oracion`.
- `GroupMembers.jsx:36`: reemplazar "admin" por `groupDetail.adminShort` con texto
  "Administra el grupo" / "Runs the group" / "Administra o grupo". En pt también
  `grupos.createHelp` → "Você vai administrar o grupo", `groupDetail.adminSuffix` →
  "você administra o grupo", `grupos.admin` → "Administra", `groupDetail.weekHint`
  → "Só aparece quem compartilha".
- `GroupPrivateStats.jsx:78`: usar `t('groupDetail.youParen')`.
- `GroupHeader.jsx:26-37`: `aria-label={t('grupos.nameLabel')}` en el input.
- Targets: `min-h-11` en "Cambiar", el toggle de seguir y el enlace del pulso
  (`GroupPlanCard.jsx:33-41, 76-83`, `GroupPulse.jsx:33`).

**i18n nuevo.** `groupDetail.changePlanConfirm`, `groupDetail.deleteGroup`,
`groupDetail.deleteGroupConfirm`, `groupDetail.membersShareHint`,
`groupDetail.seeRemaining`, y revisar `groupDetail.adminShort`.

### T12. Progreso que no inventa ceros

Archivos: `src/screens/Progreso.jsx`, `src/hooks/useReading.js:177-188`,
`src/screens/Recorrido.jsx`.

- Si `offline && !plan`: estado propio con `EmptyState` sin ícono y texto
  `progreso.offlineNoData` ("Sin conexión. Tu progreso aparece cuando vuelva la
  red."). Nada de números.
- La nota de atraso usa la misma regla que Hoy (`showBehind` / `!anchoredAhead`).
- "Cargando…" solo en la primera carga, con `SkeletonCards count={2}`; en recargas la
  pantalla se queda como está. El `role="status"` de reprogramar va fuera del bloque
  de atraso, con autoapagado.
- Con `streak === 0`, en lugar del "0" héroe mostrar `progreso.noStreakYet` ("Hoy
  puede empezar una racha") en 15 px `text-ink-soft`, y debajo la racha máxima si es
  mayor a 0.
- Encabezados de sección: `h2` de 13 px uppercase tracking-wide `text-ink-soft`
  (igual que la etiqueta de "También hoy") sobre las tarjetas de números en Progreso
  (`progreso.sectionConstancy`: "Tu constancia") y sobre la grilla de Recorrido
  (`recorrido.sectionNumbers`: "Tus números"). Unificar el estilo de número con
  `.stat-num`.
- Leyenda del heatmap como pie visible, y un `sr-only` con
  `progreso.heatmapSummary` ("{read} de los últimos {total} días con lectura").
- Si `reflections_enabled` está apagado pero hay entradas, mantener el segmento "Mi
  camino". El texto de ayuda en Ajustes aclara que las notas se conservan.
- Recorrido: usar `EmptyState`. Diario: la tarjeta deja de ser `<button>` con
  bloques adentro (usar `<span class="block">`), y tras guardar o borrar se actualiza
  la entrada en el array en vez de recargar y perder "Cargar más".

**i18n nuevo.** `progreso.offlineNoData`, `progreso.noStreakYet`,
`progreso.sectionConstancy`, `recorrido.sectionNumbers`, `progreso.heatmapSummary`.

---

## 4. Fase 3: acciones con costo

Patrón C.

### T13. Cerrar sesión con cuidado

Archivos: `src/screens/Ajustes.jsx:646-652`, `src/lib/auth.jsx:198-214`,
`src/lib/offline.js`.

- Antes de `signOut`: si `hasPending(uid)`, intentar `flushQueue`. Si queda algo (sin
  red o falló), `ConfirmDialog` `danger` con `ajustes.signOutPending` ("Tenés {n}
  lecturas sin guardar. Si salís ahora se pierden."). Si no queda nada, `ConfirmDialog`
  normal con `ajustes.signOutConfirm` ("¿Cerrar sesión? Para volver a entrar vas a
  necesitar un código por correo."). Estado `busy` mientras corre.
- Separar visualmente "Cerrar sesión" de "Eliminar cuenta": una fila intermedia o
  margen, y "Eliminar cuenta" en texto `danger` sin relleno.
- `signOut` limpia también `ltb.onboarded_extras*` y `ltb.pendingPlan` (ver T18).

**i18n nuevo.** `ajustes.signOutConfirm`, `ajustes.signOutPending`.

### T14. Oración: decir lo que hace cada botón

Archivos: `src/screens/OrarAhora.jsx`, `src/screens/PrayerSheet.jsx`,
`src/screens/Oracion.jsx`, `src/lib/db.js:694-749`.

- **Orar ahora, pedidos ajenos:** el primario pasa a `orar.prayedFor` ("Oré por esto")
  y hace lo que hoy hace "Siguiente pedido" (registra intercesión). Se agrega un
  secundario de texto `orar.skip` ("Pasar") que solo avanza. En el último, el
  primario dice "Oré por esto y terminar".
- **Pedido vencido en revisión:** en `markPrayerReviewed`, si `expires_at` ya pasó,
  recalcular `expires_at` desde ahora según `duration_type` (misma regla que al
  crear). Así "Seguir orando" realmente lo saca de "Para volver a orar".
- **Compartir al crear:** con más de un grupo, `groupId` arranca en `null` y la lista
  no tiene ✓ hasta elegir (`canSave` ya exige grupo). Con un solo grupo se mantiene
  la preselección. Al crear compartido, mostrar el mismo `ConfirmDialog` que al
  editar.
- **Sheet de testimonio:** calcular `dirty` contra el estado inicial real
  (`focusTestimony || prayer.testimony_shared`).
- **"Actualizar" en revisión:** para compartidos, navegar al detalle con el composer
  de novedades abierto (`state: { openUpdate: true }` y leerlo en `PrayerDetail`).
  Ocultar de la lista de activos los pedidos que ya están en el bloque de revisión.
- **Pedido privado:** abrir también `PrayerDetail`, sin la fila de intercesión ni
  "quién ora", con las novedades y "Marcar como respondido". Editar sigue desde el
  lápiz del detalle. **Decisión:** un solo modelo mental para todos los pedidos.
- Oración: el "+" del header pasa a solo ícono en acento sin relleno en móvil;
  "Orar ahora" sigue como primario.
- `PrayerDetail.jsx:379-388`: `aria-label={t('prayerDetail.addUpdate')}` y
  `style={inputStyle}` de `formStyles.js`. Línea 461: `navigate(location.state?.from?.to ?? '/oracion')`.
- `PrayerSheet.jsx:267-279`: `role="radiogroup"` y `role="radio"` con `aria-checked`.
- pt: `prayerDetail.beFirst` → "Seja quem começa a orar por isto";
  `prayerDetail.authorWillKnow` → "{author} vai saber que você está orando por esse
  pedido". Revisar también el es ("Sé el primero" → "Empezá a orar por esto").

**i18n nuevo.** `orar.prayedFor`, `orar.prayedForLast`, `orar.skip`.

---

## 5. Fase 4: PWA sin red

Patrones I y J.

### T15. Precachear el camino crítico a Hoy

Archivo: `vite.config.js:175-196`.

- Correr `npm run build` y mirar los nombres reales de los chunks en `dist/assets/`.
  Sumar a `globPatterns` los del camino crítico: el chunk de `PrivateRoot`,
  `vendor-supabase`, `App`, `Gate`, `Layout`, `Hoy` y lo que `Hoy` importe de forma
  estática. Dejar fuera materiales, capturas y pantallas secundarias.
- Verificar en `dist/sw.js` que el precache suma menos de 1 MB y que los chunks están.
- Documentar en el comentario de `globPatterns` por qué están esos y no otros.

### T16. Arranque sin red con sesión conocida

Archivos: `src/lib/auth.jsx:97-131`, `src/components/Gate.jsx:65-66`,
`src/components/OfflineNotice.jsx`.

- Guardar `ltb.lastUser` (uid) al cargar el perfil con éxito y borrarlo en `signOut`.
- Al arrancar, si `navigator.onLine === false`, hay `ltb.lastUser` y existe
  `ltb.profile.<uid>` en storage: entrar con el perfil cacheado y `user = { id }`
  mínimo, mostrando `OfflineNotice` arriba. No renderizar `AuthFlow`.
- Al volver `online`, reintentar `getSession()`; si la sesión real no existe, recién
  entonces mostrar `AuthFlow` con un aviso `onboarding.auth.sessionExpired` ("Tu
  sesión venció. Ingresá de nuevo.").
- Cuidado: nada de escritura a la base mientras se está en este modo (la cola offline
  ya lo maneja para marcados; verificar que otros botones muestren error honesto).
- Si tras agotar reintentos del perfil no hay fila, poner `profileError = true` y
  reusar `LoadError` con una acción secundaria "Salir" (`signOut`).

**i18n nuevo.** `onboarding.auth.sessionExpired`, `gate.signOut`.

### T17. Flags de onboarding por usuario

Archivos: `src/components/Gate.jsx:49-50, 75, 82`, `src/screens/onboarding/OnboardingExtras.jsx`,
`src/lib/auth.jsx:198-214`.

- `ltb.onboarded_extras` pasa a `ltb.onboarded_extras.<uid>`; leer la clave vieja
  como respaldo solo para el `uid` que la escribió si se puede inferir; si no,
  ignorarla.
- `signOut` borra `ltb.pendingPlan` y la clave de extras del usuario.
- El Gate aplica el plan pendiente aunque `extrasDone` sea `true`.

### T18. Bienvenida más clara

Archivo: `src/screens/onboarding/AuthFlow.jsx`, `src/components/RetryError.jsx`.

- En modo "ingresar", ramificar el error: 422 o `otp_disabled` → "no encontramos una
  cuenta"; 429 → `onboarding.auth.rateLimited` ("Esperá un momento antes de pedir
  otro código."); `!navigator.onLine` o fallo de fetch → `onboarding.auth.offline`
  ("Sin conexión. Probá de nuevo cuando tengas red."); el resto →
  `onboarding.auth.sendError`.
- "Reenviar código": `<p role="status">` con `onboarding.auth.resent` ("Te mandamos
  otro código.") y deshabilitado 30 segundos con cuenta regresiva.
- Al cambiar entre crear e ingresar, `setError(null)`.
- Targets: los tres "Volver", "usar otro correo", "reenviar", el toggle y el
  "Reintentar" de `RetryError` pasan a `min-h-11 px-2 -ml-2 inline-flex items-center`.

**i18n nuevo.** `onboarding.auth.rateLimited`, `onboarding.auth.offline`,
`onboarding.auth.resent`.

---

## 6. Fase 5: contexto y claridad

Patrones D y E, más lo que quedó por vista.

### T19. Ajustes: orden y agrupación

Archivo: `src/screens/Ajustes.jsx:296-486`.

- En una columna, el orden pasa a: Lectura → Avisos → ¿Qué día? → Apariencia e
  idioma (Acento, Tema, Idioma, Proveedor bajo un solo encabezado
  `ajustes.section.apariencia`) → La app → Misión → Cuenta. En `lg:` mantener dos
  columnas pero respetando esa prioridad.
- Quitar el `HeartIcon` duplicado en Misión (líneas ~591, 596).
- Borrar las claves huérfanas `ajustes.section.lecturaGrupos`, `.avisosGrupo`,
  `.seguimiento`, `.compartir`, `.ayuda` y `ajustes.activar` en los tres idiomas,
  verificando con `grep -rn` que no se usan.

**i18n nuevo.** `ajustes.section.apariencia`.

### T20. Planes: catálogo por puerta pastoral y nombres traducidos

Archivos: `src/screens/Planes.jsx:39-42`, `src/lib/planLabels.js`,
`src/components/PlanCatalog.jsx:75, 81`.

- `PlanCatalog` usa `planName` y `planDescription` de `planLabels.js`.
- En `planLabels.js`, un mapa `PLAN_DOORS` de slug → puerta, con estas puertas en
  este orden: `empezar` ("Para empezar"), `temporada` ("Para esta temporada"),
  `libro` ("Un libro a la vez"), `toda` ("Toda la Biblia"), `habito` ("Un hábito
  breve"). Asignación: leé la descripción de cada uno de los 13 planes
  (`plans.<slug>.description` en es.json) y ubicalo. Guía: `semana-santa` y
  `adviento` en temporada; `mcheyne`, `cronologico`, `at-nt`, `bcp-daily-office` en
  toda; `primeros-pasos` y `beginning` en empezar; `marcos`, `evangelios`,
  `proverbios`, `nt-24-week` en libro; `40-dias-con-dios` en hábito. Si una
  descripción contradice la guía, seguí la descripción y anotalo en el reporte.
- `Planes.jsx` agrupa por puerta, en ese orden, y la duración queda como metadato
  de la tarjeta. Las puertas vacías no se muestran.
- Test en `tests/plan-doors.test.mjs`: todos los slugs del catálogo tienen puerta.

**i18n nuevo.** `planes.door.empezar`, `.temporada`, `.libro`, `.toda`, `.habito`.

### T21. Materiales: índice que se explica y tarjeta compartida del devocional

Archivos: `src/components/MaterialIndexSheet.jsx:62-73`, `src/lib/shareImage.js:644-655`,
`src/screens/MaterialReader.jsx:212-222`, `src/components/PlanCatalog.jsx:60-62`.

- Índice: cuando `frontier < total`, línea bajo el título
  `materialReader.indexLockedHint` ("Las siguientes se abren a medida que marcás
  leídas.").
- Compartir un material con `unit: 'day'`: en la tercera etapa de degradación, en
  vez de descartar la respuesta, recortar al primer párrafo (hasta el primer `\n\n`
  o 280 caracteres, lo que llegue antes) y agregar "…". Para catecismos no cambia
  nada.
- `PlanCatalog.jsx:60-62`: `SkeletonCards count={3}` en lugar del texto
  "Cargando planes…". `MaterialReader.jsx:143-149`: `SkeletonDetail`.

**i18n nuevo.** `materialReader.indexLockedHint`.

### T22. Hoy: menú del chip con teclado y skeleton compartido

Archivos: `src/screens/Hoy.jsx:328-370, 560-563`, `src/screens/GroupReading.jsx:56-63`,
`src/components/Skeleton.jsx`.

- Menú del chip "✓ Leído": al abrir, foco en el primer `menuitem`; `onKeyDown` con
  Escape (cerrar y devolver el foco al chip), ArrowUp y ArrowDown. Si resulta más
  simple, bajar la semántica a dos botones sin `role="menu"`; lo que no puede quedar
  es `role="menu"` sin teclado.
- Nuevo `SkeletonPassages` en `Skeleton.jsx` (dos pills de 32 px) usado por Hoy en
  modo "seguir leyendo" y por `GroupReading`.
- `role="alert"` en `hoy.readWriteError` y `hoy.reprogramarError`; en
  `ReflectionSheet.jsx:201` también en el `shareError` del modo vista;
  `aria-label={t('reflectionSheet.titleEdit')}` en el textarea.
- Targets `min-h-11` en: Reprogramar, el link del header "Día N · plan", "Leer el
  día siguiente", "Editar tu nota", "Desmarcar este día" y la pista "Ver materiales".

---

## 7. Fase 6: idioma y accesibilidad transversal

Patrones F y G, lo que no quedó cubierto arriba.

### T23. Nombres de respaldo, acentos y textos fijos

Archivos: `src/lib/db.js:401, 510, 598, 626, 764`, `src/hooks/useAccent.js:7-16`,
`src/screens/Ajustes.jsx:449-451`, `src/App.jsx:82-84`, `src/components/ErrorBoundary.jsx:51, 66`,
`src/lib/bible.js:65`.

- `db.js` devuelve `null` en vez de `'Alguien'` y `'Miembro'`; cada vista resuelve el
  respaldo con `t('common.someone')` y `t('common.member')`.
- Acentos: claves `accent.<key>` en los tres idiomas; `aria-label` y `title` de los
  swatches pasan por `t()`. `ACCENTS[].name` puede quedar como respaldo.
- 404 en `App.jsx`: usar `t('notFound.title')` y `t('notFound.goHome')`.
  `ErrorBoundary` está fuera del provider: leer `ltb.locale` de localStorage y un
  mini diccionario de dos cadenas en los tres idiomas dentro del propio archivo.
- `bibleGatewayUrl`: `BOOKS[ref.book_usfm]?.[locale] ?? BOOKS[ref.book_usfm]?.es`.
- En la fila "Guía de la app" de Ajustes, si `locale !== 'es'`, sufijo
  `ajustes.guideInSpanish` ("(en español)").
- Borrar claves huérfanas `hoy.readingDay`, `hoy.readingTodayWithDay`,
  `hoy.readingToday`, `hoy.openBible` en los tres idiomas tras verificar con `grep`.

**i18n nuevo.** `common.someone`, `common.member`, `accent.*` (8 claves),
`notFound.title`, `notFound.goHome`, `ajustes.guideInSpanish`.

### T24. Navegación: Ajustes encendido en móvil

Archivos: `src/components/nav.js:12`, `src/components/TabBar.jsx`, `src/components/Sidebar.jsx`.

- En móvil, `/ajustes` enciende la pestaña Hoy (agregar `/ajustes` a un `matchMobile`
  que solo use `TabBar`), sin encender dos ítems en el `Sidebar` de desktop, que ya
  tiene su propio ítem de Ajustes.

---

## 8. Fase 7: contenido público

Patrón H.

### T25. Promesas que coinciden con la app

Archivos: `src/screens/Info.jsx:59, 181, 272`, `src/screens/Ayuda.jsx:41, 102-107, 322`,
`src/screens/Privacidad.jsx:179, 204-210`, `src/screens/Lideres.jsx:109, 126`,
`src/screens/landingKit.jsx:29`, `.impeccable.md`.

- Acentos: "8 tonos: 2 sepia y 6 pastel" en /info y /ayuda; o derivar de
  `ACCENTS.length`. Corregir el comentario del kit.
- Ayuda › Ajustes: sumar idioma, proveedor de Biblia, "Descargar mi camino", "¿En qué
  día vas?", compartir lectura con grupos y avisos de grupo. Reemplazar "(NBLA)" por
  "en tu versión según el idioma". Nombrar "También hoy" en el ítem de materiales y
  grupos.
- Privacidad: "Te enviamos un código a tu correo"; en "Tu control", "podés apagar
  cualquiera de los avisos desde Ajustes".
- Anchos: unificar a 880 en /info, /ayuda y /lideres, con `max-w-[560px]` interno
  para la medida de lectura donde hoy hay 720. Verificar leyendo el código que el
  header, el primer bloque y el footer usan el mismo ancho.
- Splash con versículo (`index.html:250-252`). **Decisión:** se conserva como firma
  de marca. Documentar la excepción en `.impeccable.md` bajo "Brand personality":
  "Única excepción al principio: el versículo del splash, en español, como firma."

### T26. Cierre

- Actualizar `CHANGELOG_USUARIOS.md` con una entrada en lenguaje de usuario, con el
  formato de las anteriores, agrupando: lo que ahora avisa cuando algo no se guarda,
  la racha que ya no se corta al cambiar de plan, el diario que sobrevive a releer un
  plan, cerrar sesión con confirmación, grupos (confirmación al cambiar plan, eliminar
  grupo), oración ("Oré por esto" y "Pasar"), planes por puerta, y la app sin red.
  Las correcciones de accesibilidad e idioma van en una línea cada una.
- Reporte final: commits con hash, verificación hecha, tareas no completadas y por
  qué, decisiones que te apartaste del plan y por qué.

---

## 9. Lo que este plan deja afuera a propósito

- Progreso de grupo con clave propia (tabla nueva). Se avisa al usuario (T10) y queda
  para un plan posterior.
- "Pasar la administración" de un grupo a otro miembro.
- Traducir el contenido de los materiales. Se señala "En español" (T6).
- Un modo de exploración sin cuenta más allá del catálogo de planes.
