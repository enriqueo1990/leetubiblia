# Plan: mejorar "También hoy" (lecturas adicionales)

Plan de ejecución para un agente. Está pensado para hacerse de punta a punta sin
preguntar: cada tarea dice qué cambiar, dónde, y cómo verificarlo. Si algo del
código no coincide con lo descrito acá, el código manda: leé el archivo real
antes de editar.

## 1. Contexto

"También hoy" es la sección de lecturas secundarias de la pantalla Hoy. Junta dos
tipos de fila en una sola lista:

- **Lecturas de grupos** que el usuario sigue (`group_members.follow_plan = true`),
  con el día calculado desde `groups.plan_start_date`. Se descarta el grupo cuyo
  plan y fecha de inicio coinciden con el plan personal del usuario.
- **Materiales** (catecismos) activados en Ajustes › Materiales, guardados en
  `profiles.active_materials` como `[{ slug, position }]`.

Archivos involucrados:

| Archivo | Rol |
|---|---|
| `src/lib/todayExtras.js` | Hook `useTodayExtras()`: carga datos y arma `rows` |
| `src/components/TodayExtras.jsx` | La sección dentro de Hoy (pista / lista / resumen) |
| `src/components/TodayExtraRows.jsx` | Dibuja las filas (grupo y material) |
| `src/screens/TodayExtrasView.jsx` | Vista completa en `/hoy/lecturas` |
| `src/screens/Hoy.jsx` | Monta `<TodayExtras />` (línea ~603) |
| `src/lib/db.js` | `getFollowedGroupReadings(userId)` (línea ~823) |
| `src/lib/materials.js` | Catálogo y helpers de materiales |
| `src/i18n/es.json`, `en.json`, `pt.json` | Textos. Las claves de esta sección son `hoy.alsoToday`, `hoy.extras*`, `materialsToday.*` |

### Principios que no se negocian

1. **Biblia física.** La app acompaña la lectura en una Biblia de papel. Nunca
   mostrar texto bíblico dentro de la app. Las referencias sí: son el contenido.
2. **Canon de diseño.** Reusar `EmptyState`, `SkeletonRows`/`SkeletonCards`,
   `BackLink`, la clase `.card`, `divide-y divide-hairline`, los tokens de color
   (`var(--accent-ink)`, `text-ink`, `text-ink-soft`). No inventar estilos nuevos.
   Una acción primaria por estado. Targets táctiles de 44px mínimo (`min-h-11`).
3. **Secciones etiquetadas.** El dueño del producto se confunde con minimalismo
   sin etiquetas. Cuando dos cosas distintas comparten una lista, se distinguen
   con etiqueta o ícono, no solo por el texto de la meta.
4. **i18n en los tres idiomas siempre.** Toda clave nueva va en `es`, `en` y `pt`.
   Tono familiar y cercano. En español se usa "vos" ("Podés", "Vas en"). En
   portugués evitar marcas de género.
5. **Optimista pero honesto.** Nunca mostrar como guardado algo que no se guardó.
6. **Comentarios en español**, breves, explicando el porqué, como el resto del código.

### Cómo verificar

No hay forma de loguearse en el navegador desde el agente, así que la verificación
visual con sesión no está disponible. Se verifica con:

```bash
npm run lint
```

```bash
npm test
```

```bash
npm run build
```

Las tres tienen que pasar al final de cada tarea. Si el usuario dejó una sesión
abierta en el panel del navegador, además tomar captura de Hoy; si no, no insistir.

### Commits

Un commit por tarea, mensaje en inglés en imperativo, cuerpo corto en español si
hace falta. Terminar cada mensaje con:

```
Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
```

No hacer push.

---

## 2. Tareas

Ejecutar en este orden. Cada una deja la app funcionando.

### T1. Lógica pura y testeable, usuario sin cuenta, completados fuera del día

**Problema.** `useTodayExtras` hace `if (!user) return` y deja `groupReadings` en
`null`, así que `loading` queda en `true` para siempre: un visitante sin cuenta no
ve la sección ni la pista, y `/hoy/lecturas` muestra un skeleton infinito.
Además, un material terminado aparece todos los días como "✓ Completado" y suma
al contador "N lecturas para hoy".

**Cambios.**

1. Crear `src/lib/todayExtrasRows.js` con una función pura, sin React ni JSX:

   ```js
   export function buildExtraRows({ groupReadings, materials, contents, profile, t })
   ```

   Recibe lo que hoy se calcula dentro del hook y devuelve `rows`. Reglas:
   - Filtra el grupo que duplica el plan personal (misma lógica actual).
   - Materiales con `position > total` se **excluyen** de `rows`. El usuario los
     sigue viendo en Ajustes › Materiales como "Completado · repasar". Borrar el
     campo `done` de las filas de material si queda sin uso.
   - Cada fila lleva `pending: boolean`. Para grupos es `!r.read`. Para materiales
     siempre `true` (si está en la lista es porque falta).
   - Orden: primero pendientes, después hechas; dentro de cada bloque grupos antes
     que materiales, en el orden en que vienen.
   - Mantener `type`, `key`, `item` como hoy para no romper `TodayExtraRows`.
   - Importar `getMaterial` desde `./materials.js` está bien: ese módulo no hace
     imports de JSON a nivel superior, así que Node lo puede cargar en tests.

2. En `src/lib/todayExtras.js`:
   - Cuando no hay `user`, hacer `setGroupReadings([])` en vez de `return`.
   - Reemplazar el armado de `rows` por una llamada a `buildExtraRows`.
   - Devolver además `pendingCount` (filas con `pending`).

3. Tests: crear `tests/today-extras.test.mjs` con `node:test` y `assert/strict`,
   cubriendo: (a) sin grupos ni materiales devuelve `[]`; (b) se descarta el grupo
   que duplica el plan personal; (c) un material con `position > total` no aparece;
   (d) las filas pendientes van antes que las hechas; (e) la meta del material es
   "Pregunta N de M" (pasar un `t` falso que devuelva la clave con los parámetros).
   Cambiar el script `test` de `package.json` a `node --test tests/` para que
   corra todos los archivos de la carpeta.

**Aceptación.** `npm test` pasa con los tests nuevos y el existente. Un perfil sin
usuario deja `loading` en `false` con `rows` vacío.

---

### T2. Mostrar las lecturas, no un contador

**Problema.** Con 1 o 2 filas se ven las lecturas; con 3 o más se reemplazan por
una tarjeta "3 lecturas para hoy · Ver lecturas" que obliga a entrar para saber
cuáles son y cuál falta.

**Cambios en `src/components/TodayExtras.jsx`.**

- Subir `INLINE_LIMIT` a `4`. Hasta 4 filas se muestran todas, con la etiqueta
  TAMBIÉN HOY arriba como hoy.
- Con 5 o más: mostrar la etiqueta, las primeras **3** filas (ya vienen ordenadas
  con pendientes primero) y, como última fila de la misma tarjeta, un `Link` a
  `/hoy/lecturas` con el texto `hoy.extrasSeeAll` y chevrón a la derecha. Misma
  altura y padding que las filas normales (`px-4 py-3`, `min-h-11`).
- Eliminar la tarjeta resumen actual y las claves `hoy.extrasTotalCount` y
  `hoy.extrasOpen` de los tres idiomas si quedan sin uso. Comprobar con `grep`
  antes de borrar.

**i18n nuevo** (los tres idiomas):

| Clave | es | en | pt |
|---|---|---|---|
| `hoy.extrasSeeAll` | `Ver todas ({count})` | `See all ({count})` | `Ver todas ({count})` |

`{count}` es el total de filas.

**Aceptación.** Con 1 a 4 filas no hay resumen. Con 5 o más se ven 3 filas y la
fila "Ver todas (N)". `npm run lint` limpio.

---

### T3. Filas que dicen qué leer y de qué tipo son

**Problema.** Una fila de grupo y una de material se ven idénticas. Y "Día 3 de
40" no dice qué pasaje es; el usuario con la Biblia en la mano tiene que entrar
para saber si son dos versículos o tres capítulos.

**Cambios.**

1. `src/lib/db.js`, en `getFollowedGroupReadings`: traer las referencias del día
   de cada grupo. Después de calcular `days`, hacer **una** consulta a `plan_days`
   con `.in('plan_id', planIds)` y `.in('day_number', [...new Set(days.map(d => d.day))])`,
   seleccionando `plan_id, day_number, refs`. Armar un mapa `"${plan_id}:${day_number}" → refs`
   y agregar `refs: map[...] ?? []` a cada objeto devuelto. Agregar esa consulta
   al `Promise.all` existente para no sumar una ida y vuelta.

2. `src/components/TodayExtraRows.jsx`: pasar a filas de dos líneas, mismo patrón
   que las tarjetas de `src/screens/Materiales.jsx` (título 16px + línea 13px).
   - **Izquierda, línea 1:** un ícono pequeño (16px, `text-ink-soft`) seguido del
     nombre. Para grupos `PeopleIcon` y para materiales `BookIcon`, ambos
     exportados como `const` desde `src/components/icons.jsx` (son los mismos de
     la barra de pestañas, ver `src/components/nav.js`). No crear íconos nuevos.
     El ícono es `aria-hidden`; el tipo se anuncia con un `<span class="sr-only">`
     con `hoy.extrasTypeGroup` o `hoy.extrasTypeMaterial`.
   - **Izquierda, línea 2 (grupo):** las referencias con `bookLabel(ref, locale)`
     de `src/i18n/books.js`, unidas con ` · `. Si hay más de 2, mostrar las 2
     primeras y ` +N`. Una sola línea, `truncate`. Si `refs` viene vacío, omitir
     la línea.
   - **Izquierda, línea 2 (material):** la pregunta actual (`entry.question`)
     en una línea con `truncate`. Para eso `buildExtraRows` debe incluir
     `question: entry.question` en `item` de material.
   - **Derecha:** la meta actual ("Día 3 de 40" / "Pregunta 12 de 107") en 13px
     `tabular-nums`. El ✓ de hecho se mantiene, pero acompañado de un
     `<span class="sr-only">` con `hoy.extrasReadDone`.
   - Las filas con `pending === false` van con `opacity: 0.6` en el bloque de la
     izquierda. Siguen siendo tocables.
   - Quitar `locale` de `usePreferences()` solo si ya no se usa; lo más probable es
     que haga falta para `bookLabel`.

**i18n nuevo** (los tres idiomas):

| Clave | es | en | pt |
|---|---|---|---|
| `hoy.extrasTypeGroup` | `Lectura de grupo` | `Group reading` | `Leitura do grupo` |
| `hoy.extrasTypeMaterial` | `Material` | `Material` | `Material` |
| `hoy.extrasReadDone` | `Ya leído` | `Already read` | `Já lido` |

**Aceptación.** Una fila de grupo muestra nombre, referencias y "Día N de M". Una
de material muestra nombre, pregunta y "Pregunta N de M". Las dos tienen ícono
distinto. Con lector de pantalla se anuncia el tipo y si está leído. `npm run
build` pasa.

---

### T4. Sin salto de layout al cargar

**Problema.** Mientras carga, `TodayExtras` devuelve `null`. Cuando llegan los
datos la sección aparece y empuja hacia abajo la zona de acción de Hoy.

**Cambios en `src/components/TodayExtras.jsx`.**

- Recordar la última cantidad de filas mostradas en `localStorage` bajo
  `ltb.extrasCount.<userId>` (escribir cuando `loading` pasa a `false`). Envolver
  lectura y escritura en `try/catch`.
- Mientras `loading`, calcular `expected = max(profile.active_materials.length, valor guardado)`.
  Si `expected > 0`, renderizar la etiqueta TAMBIÉN HOY y
  `<SkeletonRows count={min(expected, 4)} />` de `src/components/Skeleton.jsx`
  dentro del mismo `mt-8`. Si `expected === 0`, seguir devolviendo `null`.

**Aceptación.** Un usuario con materiales activos ve un skeleton del mismo alto
que la lista final, y la barra de acción no se mueve cuando llegan los datos.

---

### T5. Migas honestas y vacío con salida

**Problema.** Desde `/hoy/lecturas`, al abrir un lector y volver, la miga lleva a
Hoy y no a la lista de donde se salió. Y la vista completa vacía dice "No hay
otras lecturas para hoy" sin ofrecer nada.

**Cambios.**

1. `src/components/TodayExtraRows.jsx`: aceptar prop `from` (`{ to, label }`) y
   usarla en el `state` de cada `Link`. Valor por defecto: `{ to: '/', label: t('nav.hoy') }`.
2. `src/screens/TodayExtrasView.jsx`: pasar
   `from={{ to: '/hoy/lecturas', label: t('hoy.alsoToday') }}`.
3. `src/screens/TodayExtrasView.jsx`, estado vacío: dentro de `EmptyState` pasar
   como `children` un `Link` a `/materiales` con `state={{ from: { to: '/hoy/lecturas', label: t('hoy.alsoToday') } }}`,
   clase `btn btn-secondary inline-block px-8`, texto `materialsToday.hintCta`
   ("Ver materiales"). El patrón exacto está en `src/screens/Oracion.jsx` (~línea
   281) y en `src/screens/Hoy.jsx` (~línea 263): `EmptyState` con un `Link` con
   clases `btn` como hijo.
4. `src/screens/Materiales.jsx` ya usa `BackLink` con `to="/ajustes"`; como
   `BackLink` respeta `state.from`, la vuelta queda correcta sin tocarlo.

**Aceptación.** Entrar a una lectura desde `/hoy/lecturas` y volver con la miga
regresa a `/hoy/lecturas`. La vista vacía ofrece "Ver materiales".

---

### T6. Mostrar la sección también con el plan terminado

**Problema.** En `src/screens/Hoy.jsx` la sección se monta como
`{!r.planFinished && <TodayExtras />}`. Justo cuando la lectura principal ya no
existe, las otras lecturas serían lo único por leer, y se esconden.

**Cambios.**

- Quitar la condición `!r.planFinished` de esa línea. Dejar la sección después de
  la tarjeta de plan completado, manteniendo el `mt-8` para que respire.
- Comprobar que la zona de acción de abajo (que sí depende de `!r.planFinished`)
  no se rompe. Si el certificado y la sección quedan demasiado pegados, ajustar
  solo el margen de la sección.

**Aceptación.** Con el plan terminado, Hoy muestra el certificado y debajo
"También hoy" si hay filas. `npm run lint` y `npm run build` pasan.

---

### T7. Limpieza

- Borrar las claves sin uso en los tres idiomas, verificando antes con `grep -rn`
  que no se usan: `hoy.withGroups`, `materialsToday.otherReadings`, y las que
  quedaron huérfanas en T2.
- La pista "Podés sumar una lectura breve a tu día" se descarta hoy por
  dispositivo (`ltb.materialsHint.dismissed`). Cambiar la clave a
  `ltb.materialsHint.dismissed.<userId>` para que sea por usuario. Mantener la
  lectura de la clave vieja como respaldo para no volver a mostrar la pista a
  quien ya la cerró.
- Actualizar `CHANGELOG_USUARIOS.md` con una entrada corta en lenguaje de usuario
  (no técnico) describiendo: se ven las lecturas y no un contador, cada fila dice
  qué pasaje o pregunta toca, lo terminado deja de aparecer, y la sección sigue
  disponible al terminar el plan. Mirar el formato de las entradas anteriores.

**Aceptación.** `grep -rn` de cada clave borrada devuelve solo nada. Lint, tests
y build pasan.

---

## 3. Cierre

Al terminar, dejar en el mensaje final:

1. Lista de commits con su hash corto.
2. Qué se verificó y cómo (lint, tests, build, captura si la hubo).
3. Cualquier punto del plan que no se pudo hacer, y por qué.

No hacer push ni abrir PR. Eso lo decide el dueño del proyecto.
