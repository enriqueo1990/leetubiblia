# Handoff: PWA Lectura Bíblica & Oración

## Overview
PWA estilo Apple, minimalista, multiusuario, para **trackear lectura bíblica** según un plan y **gestionar pedidos de oración** privados o compartidos en grupos cerrados. Modo claro/oscuro automáticos. Acento único sepia. Este paquete cubre el diseño completo de **Fase 1** (lanzamiento) más las funciones diferidas a **Fase 2**, y la especificación responsive.

**Principio de producto:** "Lee Tu Biblia" significa leé *tu* Biblia física. La app es un **compañero de hábito** (plan, racha, oración, grupos) que acompaña la lectura en papel — **no** es un lector de Escritura como YouVersion, y el texto bíblico no se muestra dentro de la app a propósito.

La fuente de verdad del producto es `APP_LECTURA_ORACION_MASTER.md` (incluido). Define decisiones cerradas, modelo de datos, reglas RLS y alcance. **Leerlo primero.** Este README traduce el diseño visual a especificación de implementación.

## About the Design Files
Los archivos `.dc.html` de este bundle son **referencias de diseño creadas en HTML** — prototipos que muestran el look y el comportamiento buscados, **no** código de producción para copiar tal cual. La tarea es **recrear estos diseños en el entorno del codebase** definido por el documento maestro: **React + Vite + Tailwind CSS, PWA (service worker + manifest), backend Supabase** (Postgres + Auth + RLS). Usar los patrones y librerías que se establezcan en ese stack. Los `.dc.html` usan un runtime propio de prototipado (etiquetas `x-dc`, `sc-if`) que **no** debe portarse — interesa el HTML/CSS resultante (estructura, tokens, medidas), visible inspeccionando el DOM renderizado.

## Fidelity
**Alta fidelidad (hifi).** Colores, tipografía, espaciado, radios e interacciones son finales. Recrear la UI pixel-perfect con las librerías/patrones del codebase. Todos los valores hex, tamaños y pesos de este README son los definitivos.

---

## Design Tokens

Implementar como CSS variables en `:root`, conmutables por modo (auto vía `prefers-color-scheme`, con override `.light`/`.dark`) y por acento (`data-accent` en `:root`).

### Acento sepia — 6 tonos elegibles (Ajustes)
Es el **único color** fuera de la escala de grises en toda la app. El usuario elige uno; default `sepia_base`. En oscuro cada tono se aclara ~15%.

> **Actualización (2026-06):** además de los 6 sepia, se sumaron **6 acentos pastel** elegibles (lavanda, rosa, menta, cielo, coral, turquesa; migración `0008`). Decisión de producto consciente para un público más joven: el acento sigue siendo el único color de la app, pero ya no se limita a la escala sepia. Default sigue siendo `sepia_base`.

| Clave | Claro | Oscuro |
|---|---|---|
| `sepia_base` (default) | `#A88B6A` | `#C2A57E` |
| `sepia_clay` | `#B08968` | `#CBA585` |
| `sepia_olive` | `#8C8A5E` | `#ABA876` |
| `sepia_stone` | `#9C9080` | `#BBB0A0` |
| `sepia_rose` | `#B08A86` | `#CBA7A2` |
| `sepia_slate` | `#7E8A8C` | `#9CAAAC` |

Tintes de acento (fondos suaves de badges/pills): claro `rgba(168,139,106,0.13)`, oscuro `rgba(194,165,126,0.16)`. Para sidebar activo: claro `rgba(168,139,106,0.12)`, oscuro `rgba(194,165,126,0.16)`.

### Neutros

**Modo claro**
- Fondo app: `#FBFBFA`
- Superficie / tarjetas: `#FFFFFF`
- Superficie alterna: `#F2F1EE` (variante de segmented track: `#EFEDE8`)
- Texto principal: `#1C1C1E`
- Texto suave: `#8A8A8E`
- Hairline / bordes: `#EAE8E3`
- Placeholder de input: `#B9B7B2`
- Gris muy tenue (chevrons inactivos, dots de ventana): `#C9C7C2` / `#D8D5CF`

**Modo oscuro**
- Fondo app: `#000000` (negro puro OLED)
- Superficie / tarjetas: `#1C1C1E`
- Superficie alterna: `#2C2C2E` (segmented activo: `#3A3A3C`)
- Texto principal: `#F2F2F7`
- Texto suave: `#8E8E93`
- Hairline / bordes: `#2C2C2E`
- Gris medio (chevrons/dots): `#3A3A3C` / `#5A5A5E`

### Tipografía
- Familia: `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", system-ui, sans-serif`
- **Display (referencia protagonista):** 38px / 600 / `letter-spacing:-0.8px` / `line-height:1.18`
- **Título grande de pantalla:** 26px / 700 / `letter-spacing:-0.6px`
- **Título de sección/tarjeta:** 18–22px / 600
- **Cuerpo:** 16px / 400–500 (`line-height:1.5` en párrafos)
- **Etiqueta / metadato:** 13–14px / 500–600, a veces uppercase con `letter-spacing:0.4–0.6px`
- **Caption:** 12px / 500–600
- Números de stat: 30–34px / 700 / `letter-spacing:-1px`, en acento

### Espaciado y forma
- Base de espaciado: múltiplos de 4. Generoso — la app "respira".
- **Radios:** botones y tarjetas **16px**; inputs 14px; contenedores grandes 18–24px; pills/badges 8px; tab-bar pills internos 8–10px.
- **Botón primario:** relleno acento, texto blanco (en claro) / `#1C1C1E` (en oscuro, por contraste sobre sepia claro), `padding:17px` vertical, 17px/600.
- **Botón secundario:** transparente, borde hairline 1px, texto principal, `padding:16px`, 17px/500.
- **Sombras:** casi nulas. Tarjetas en claro usan borde hairline (sin sombra); en oscuro, elevación por color de superficie (sin borde, sin sombra). Sombra solo en elementos flotantes (modales/sheets) y bezel del prototipo.
- **Transiciones:** 0.3–0.4s ease en tema, estados de botón y navegación. Respetar `prefers-reduced-motion`. El movimiento confirma, no entretiene.

### Navegación
- **Móvil/tablet:** tab bar inferior translúcida (`backdrop-filter: blur(20px)`; fondo claro `rgba(251,251,250,0.72)`, oscuro `rgba(0,0,0,0.62)`), borde superior hairline. 4 ítems: **Hoy · Oración · Grupos · Ajustes**. Ítem activo en acento (icono + label 600); resto en texto suave (label 500). Iconos ~24–25px, stroke 1.7.
- **Desktop (≥1024px):** la tab bar se reemplaza por **sidebar izquierdo** (~250px, superficie, borde derecho hairline) con marca + nav vertical (mismos 4 ítems, activo en acento con fondo tinte sutil y radio 12px).

---

## Responsive Behavior
Principio rector: **el contenido nunca supera su ancho de lectura cómodo (~600px). En pantallas grandes crece el aire alrededor, NO el contenido.** No estirar listas ni referencias a todo el ancho. Tipografía, radios, colores y aire **idénticos** entre breakpoints. La única transformación estructural es **tab bar → sidebar** en desktop.

- **Móvil (≤640px):** una columna, tab bar abajo. Padding lateral ~26px.
- **Tablet (641–1024px):** contenido en **columna centrada de ~600px**; los márgenes laterales son aire. Tab bar abajo, **centrada bajo la columna** (su hairline abarca solo el ancho de la columna, no toda la pantalla).
- **Desktop (≥1024px):** **sidebar de navegación** a la izquierda; contenido en columna centrada (~620px) a la derecha sobre el fondo de app. En desktop, los dos botones de acción de Hoy pueden ir en fila (acotados, ~max 440px) en lugar de apilados a todo el ancho.

Ver `Responsive — Hoy y Oración.dc.html` para Hoy y Oración en los tres anchos, claro y oscuro.

---

## Screens / Views

> Estructura común de cada pantalla principal: status bar iOS (44–54px) → contenido (`flex:1`, scroll) → tab bar (móvil/tablet) o sidebar (desktop). Modales/sheets: grabber 36×5px arriba + nav (Cancelar / título / acción) → contenido → botón primario al fondo. Detalles "pushed": fila de back (chevron + label en acento) arriba.

### 1. Hoy (pestaña 1 — la cara de la app)
**Propósito:** lo que el usuario ve cada mañana; una sola pantalla, sin ruido.
**Layout (de arriba a abajo, padding lateral ~30px):**
1. Fecha actual — 13px/500, **uppercase**, texto suave, `letter-spacing:0.6px` (ej. "JUEVES 25 DE JUNIO"). Computar de la fecha real con `toLocaleDateString('es-ES', {weekday,day,month})`.
2. Plan + día — 15px/600, **acento** (ej. "Plan M'Cheyne · Día 176"). `margin-top:7px`.
3. Etiqueta "Lectura de hoy" — 14px/500, texto suave, `margin-top:~42px`.
4. **Referencias del día** (protagonistas) — Display 38px/600/`-0.8px`/`1.18`, **una por línea**, todas las del día (ej. "Jeremías 33", "Salmos 5–6", "Mateo 7"; pueden ser largas como "1 Crónicas 20"). `margin-top:18px`.
5. Empuje al fondo (`flex:1` spacer), luego:
   - Botón primario **"Marcar como leído"** (acento). Al tocar → estado **"✓ Leído hoy"**: fondo superficie alterna (`#F2F1EE`/`#2C2C2E`), texto suave. Idempotente.
   - Botón secundario **"Abrir en mi app de Biblia ↗"** (borde hairline). **Universal link de YouVersion al capítulo exacto** del día, versión **NBLA** (id 103): `https://www.bible.com/bible/103/{book_usfm}.{chapter}.NBLA` (ej. `.../103/JER.33.NBLA`) — abre la app si está instalada, la web si no. Si hay varias referencias, abre la primera. (Elegir otro proveedor/versión = Fase 2.)

**Estados:**
- **Sin plan activo (vacío):** centrado — círculo `#F2F1EE`/`#1C1C1E` 84px con icono libro en acento; título 24px/700 "Elegí un plan para empezar"; subtítulo 16px texto suave; botón primario "Ver planes" al fondo.
- **Atrasado:** dato neutro, **sin culpa**. Banner superficie-alterna (radio 14): "Te atrasaste 3 días" (texto principal) + "Reprogramar" (acento). Debajo, la lectura de hoy normal. "Reprogramar" mueve `plan_start_date`.

### 2. Progreso (sub-vista de Hoy)
**Propósito:** ver avance sin culpa.
**Layout:** fila de back "Hoy" (acento) → título "Progreso" → **dos stat cards** en fila (racha: número grande en acento + "días de racha"; completado: "48%" en texto principal + "176 de 365 días") → "ÚLTIMAS 5 SEMANAS" → **heatmap** grid `repeat(7,1fr)` con header L M M J V S D y 35 celdas (`aspect-ratio:1`, radio 8): días leídos en acento, no leídos en superficie alterna, días futuros más tenues. **Interactivo:** tocar una celda de un día **pasado** lo marca/desmarca como leído (insert/delete en `reading_progress`) — único lugar para registrar días atrasados ya leídos; las celdas de días futuros no son tocables. → nota neutra: "Te atrasaste 2 días. Sin apuro — podés reprogramar y seguir." (texto suave, "podés reprogramar" en acento). Tab bar con Hoy activo.
**Lógica:** `día_de_hoy = (hoy − plan_start_date) + 1` (regla canónica — lo que Hoy muestra lo dicta siempre el calendario; los saltados quedan sin marcar y se tildan acá). Racha = días consecutivos con fila en `reading_progress` hasta hoy/ayer; % = completados / `duration_days`. El atraso es informativo, nunca regaño.

### 3. Selección / cambio de plan
**Layout:** fila back "Hoy" → título "Planes" → "Un plan activo a la vez." → tarjetas de plan (radio 16). Activa: borde **1.5px acento** + badge "Plan activo" (texto acento, fondo tinte). Resto: borde hairline (claro) / superficie sin borde (oscuro). Cada tarjeta: nombre 18px/600, descripción 14px texto suave, duración 13px texto suave.
Planes seed de lanzamiento (3): M'Cheyne (365 días, "Toda la Biblia en un año, cuatro pasajes por día." — activo), Cronológico (365), Proverbios en 31 días (31). (Nuevo Testamento en 90 días = más adelante.)

> **Actualización (2026-06):** el catálogo se amplió a **8 planes** (decisión de producto, no revertir): además de la terna, se sembraron Antiguo y Nuevo Testamento (365), De Génesis a Apocalipsis (365), NT en 24 semanas (168), 40 días con Dios (40) y Oficio Diario del Libro de Oración Común (861). El orden de la lista es **curado y determinista** (la terna de lanzamiento primero), no por duración — ver `PLAN_ORDER` en `src/lib/db.js`.
**Confirmación al cambiar:** alert centrado (radio 22, sombra) sobre el listado atenuado+scrim (`rgba(28,28,30,0.32)` / `rgba(0,0,0,0.6)`): título "¿Cambiar a {plan}?", cuerpo "El plan nuevo arranca desde el día 1. Tu progreso de M'Cheyne queda guardado, pero no se transfiere.", botones "Cancelar" (borde) / "Cambiar" (acento). Set `active_plan_id` + `plan_start_date = hoy`; no borra histórico anterior.

### 4. Oración (pestaña 2)
**Layout:** título "Oración" (26px/700) + botón **+** circular acento (34px) arriba a la derecha (en desktop puede ser pill "+ Nuevo pedido" con label) → **segmented control** "Míos" / "De mis grupos" (track superficie alterna, segmento activo superficie blanca con sombra sutil en claro / `#3A3A3C` en oscuro; 14px, activo 600) → lista.
**Ítem de pedido** (tarjeta radio 16, padding ~14–16): izquierda = título 16px/600 + fecha 13px texto suave (en "De mis grupos", "Autor · fecha"); derecha = icono de visibilidad (candado = privado / personas = compartido, ~14–15px texto suave) + badge de estado. **Activo**: pill texto suave sobre superficie alterna. **Respondido**: pill **texto acento sobre tinte de acento**.
- **Míos:** activos primero (por fecha desc), luego subsección "Respondidos" con ítems a `opacity:~0.55`.
- **De mis grupos:** agrupados por nombre de grupo (header de grupo: 12px/600 uppercase texto suave). Activos primero; respondidos atenuados al final.

### 5. Crear / Editar pedido
**Crear (sheet):** nav Cancelar / "Nuevo pedido" → campo **Título** (label uppercase 12px + asterisco/punto acento; input superficie radio 14) → **Descripción** (label "(opcional)"; textarea multilínea) → **Visibilidad** segmented "Privado" / "Compartir con grupo". Si comparte → aparece **selector de grupo** (lista en tarjeta con separadores hairline; grupo elegido con check acento) → botón primario "Guardar pedido". Si `visibility='shared'`, `shared_group_id` obligatorio.
**Editar (sheet):** igual con campos precargados + sección **Estado** segmented "Activo" / "Respondido" (al marcar Respondido, en oscuro el segmento activo usa texto acento; mostrar caption "✓ Respondida el {fecha}" en acento; set `answered_at`) + botón texto-suave **"Eliminar pedido"** al fondo (solo el autor edita/borra).

### 6. Grupos (pestaña 3)
**Lista:** título "Grupos" → fila de acciones: **"Crear grupo"** (primario acento, con icono +) + **"Unirme por código"** (secundario borde), `flex:1` cada uno → "MIS GRUPOS" → tarjetas (radio 16): avatar circular 42px superficie-alterna con icono personas, nombre 16px/600 + "N miembros · {rol}" 13px texto suave, chevron derecho tenue.
Grupos seed: Célula Norte (8 · Owner), Matrimonios (14 · Miembro), Jóvenes Domo (23 · Miembro).
**Detalle de grupo:** fila back "Grupos" → título grupo 26px/700 + "N miembros · Sos el owner" → **tarjeta código de invitación** (radio 16): label "CÓDIGO DE INVITACIÓN" + código grande 26px/700 `letter-spacing:2px` (acento en oscuro) + botones "Copiar" (icono) y "Regenerar" (icono refresh) → "MIEMBROS · N" → filas de miembro: avatar iniciales 38px, nombre 16px/500; el owner ("Vos") con avatar en acento + pill "Owner" (texto acento/tinte); los demás con un control de "quitar" tenue (círculo con guion) visible solo para el owner.
**Crear grupo (sheet):** icono personas en círculo superficie-alterna → campo "Nombre del grupo" → nota "Vas a ser el owner. Después podrás invitar con un código que generamos automáticamente." → "Crear grupo". Genera `invite_code` único corto; creador = owner.
**Unirme por código (sheet):** icono QR → campo "Código de invitación" (texto centrado 24px/700 `letter-spacing:3px`, ej. "CN-7K9Q") → nota "Pedile el código a quien administra el grupo." → "Unirme al grupo". Valida e inserta `group_members` como member.

### 7. Ajustes (pestaña 4) — estilo lista iOS con agrupaciones y hairlines
- **Color de acento:** 6 muestras circulares 44px en fila (`justify-content:space-between`), seleccionable. La activa lleva doble ring: `box-shadow: 0 0 0 2px {bgApp}, 0 0 0 4px {acento}` + check. Usar los hex claro/oscuro de la tabla de tokens. Cambia toda la app en vivo vía CSS var + persiste en `profiles.accent_color`.
- **Tema:** segmented Auto / Claro / Oscuro (persiste `theme_pref`; "Auto" sigue `prefers-color-scheme`).
- **Recordatorio diario:** tarjeta con fila "Activar" + **switch** (track 48×29 radio 15, knob 24px; on = acento) y fila "Hora" + valor "07:00". Pide permiso; en Android registra la notificación local a la hora elegida. En iOS es **best-effort**: requiere PWA instalada (muestra aviso si no lo está) y **no garantiza hora fija** sin servidor de push (Fase 2) — el copy no promete una hora exacta en iOS.
- **Cuenta:** tarjeta con "Nombre" + email, fila "Cerrar sesión", y fila **"Eliminar cuenta"** (texto destructivo). Confirma con alert; **borra en cascada** el perfil y todos los datos del usuario: `reading_progress`, sus `prayer_requests` (privados **y los compartidos a grupos** — se borran, no se anonimizan) y sus `group_members`; si era owner, reasigna owner al miembro más antiguo o borra el grupo si queda vacío.
- "Versión 1.0" al fondo, texto suave.

### 8. Onboarding / Auth
- **Bienvenida:** centrada — mark 88px radio 24 en acento con icono libro; wordmark **"Lee Tu Biblia"** 24px/700; tagline 17px texto suave; botón primario "Crear cuenta" + botón texto-acento "Ya tengo cuenta".
- **Auth (solo magic link, sin contraseña):** fila back → título 28px/700 ("Creá tu cuenta" / "Ingresá") → campo Email → botón primario "Enviarme el enlace de acceso" → nota texto suave "Te mandamos un enlace a tu correo para entrar sin contraseña." → footer con link de cambio (Crear ↔ Ingresar). Sin campo de contraseña → sin flujo de recuperación. Supabase Auth magic link.
- **¿Cómo te llamás? (solo primera entrada):** título 24px/700 → campo "Tu nombre" → botón primario "Continuar". Set `profiles.display_name`. Necesario porque el magic link no captura nombre y aparece en Grupos y pedidos compartidos.
- **Agregá a la pantalla de inicio (iOS):** icono compartir en cuadro superficie-alterna → título 24px/700 → cuerpo "Así recibís el recordatorio diario y podés leer sin conexión." → dos pasos numerados (círculo acento con número + texto + icono): 1) "Tocá el botón Compartir" 2) "Elegí Agregar a inicio" → botón primario "Entendido" + texto-suave "Más tarde".

---

## Fase 2 (diferido — ver `Fase 2.dc.html`)
Tratar con dignidad; sin gamificar; el acento sigue siendo lo único con color.
- **"Estoy orando por esto":** en el detalle de un pedido compartido, fila de avatares (apilados, borde del color de fondo) + conteo + botón toggle. Default: contorno acento "Estoy orando por esto" (icono corazón). Activado: relleno acento "Estás orando por esto" (icono check) + caption "Le avisamos a {autor} que estás orando." Notifica al autor.
- **Compartir respondida como testimonio (sheet):** al marcar respondida una compartida → círculo check en tinte de acento, título "Oración respondida", tarjeta con switch "Compartir con {grupo}" + campo "Unas palabras (opcional)" → "Compartir testimonio" / "Ahora no".
- **Testimonios del grupo:** lista de respondidas compartidas. Tarjeta: marca "✓ Respondida · {fecha}" (12px uppercase en acento), título 18px/600, cita 15px entre comillas, autor 13px texto suave.
- **Stats pastorales (solo owner):** tarjeta "Resumen · solo vos lo ves" (icono candado) con 3 métricas (números en acento): Pedidos activos, Respondidos, Orando esta semana; barra de proporción respondidos (alto 8px, radio 4); nota "Un pulso del grupo para acompañar mejor. No es para medir a nadie."
- **Referencia del día en Hoy (opcional):** tarjeta discreta entre el plan y "Lectura de hoy": label "VERSÍCULO DEL DÍA" + referencia (ej. "Salmo 46:10") + "Abrir ↗" en acento. **Solo referencia, sin texto bíblico** (evita licencias). Riesgo de inflar: mantener contenido.

---

## Interactions & Behavior
- **Marcar como leído:** insert idempotente en `reading_progress`; el botón pasa a estado completado (superficie alterna + texto suave). Al recargar, si ya está leído hoy, aparece completado. Transición 0.3s.
- **Marcar días atrasados:** desde el heatmap de Progreso, tocar una celda pasada inserta/borra la fila en `reading_progress` de ese día. El historial refleja lo realmente leído.
- **Abrir en Biblia:** universal link de YouVersion al capítulo exacto, versión NBLA (`bible.com/bible/103/{USFM}.{chapter}.NBLA`, primera referencia del día); app si está instalada, web si no.
- **Eliminar cuenta:** confirmar (alert); borrado en cascada de perfil + datos propios, incluidos pedidos compartidos a grupos (se borran, no se anonimizan); reasignar/borrar grupos si era owner.
- **Selector de acento:** aplica en vivo cambiando la CSS var; persiste en `profiles.accent_color`.
- **Tema:** Auto sigue `prefers-color-scheme`; override manual `.light`/`.dark`; `theme_color` del manifest acompaña el modo.
- **Cambiar de plan / Eliminar pedido / Quitar miembro / Regenerar código:** confirmar antes (alert).
- **"Estoy orando":** toggle optimista; notifica al autor.
- **Responsive:** ver sección arriba. Targets táctiles ≥44px en todos los tamaños.
- **Movimiento:** 0.3–0.4s ease; respetar `prefers-reduced-motion`.

## State Management
Refleja `profiles` y las tablas del documento maestro (sección 3):
- `accent_color` (enum 6 sepia), `theme_pref` ('auto'|'light'|'dark'), `reminder_enabled` + `reminder_time`, `active_plan_id` + `plan_start_date`.
- **`day_number` (regla canónica única):** `(hoy − plan_start_date) + 1`. Lo que "Hoy" muestra lo dicta **siempre el calendario**; los días saltados quedan sin marcar y se tildan después desde el heatmap de Progreso. Reprogramar: `plan_start_date = hoy − (primer_día_no_leído − 1)`.
- `reading_progress` UNIQUE(user_id, plan_id, day_number); racha y % derivados.
- `prayer_requests`: visibility 'private'|'shared' (+ `shared_group_id` si shared), status 'active'|'answered' (+ `answered_at`).
- `groups` / `group_members` (role 'owner'|'member', invite_code).
- **RLS** (esencia): progress solo del usuario; pedidos privados solo autor; compartidos visibles a miembros del grupo, edita/borra solo el autor; grupos visibles a miembros, administra solo el owner.

## Assets
- **Iconos:** todos son SVG inline stroke (1.7–2.4), estilo SF Symbols-like: libro (Hoy), corazón (Oración), personas (Grupos), sliders (Ajustes), candado, chevron, +, check, copiar, refresh, compartir, QR. Reemplazar por el set de iconos del codebase (p.ej. SF Symbols nativos o una librería como Lucide) manteniendo el peso de línea fino y consistente.
- **Sin imágenes ni logos** provistos. El wordmark es solo texto. No hay assets de marca de terceros.
- **Fuente:** San Francisco nativa en iOS vía `-apple-system`; Inter como fallback web.

## Files
- `APP_LECTURA_ORACION_MASTER.md` — documento maestro (fuente de verdad: decisiones, datos, RLS, alcance, prompts de build).
- `Hoy.dc.html` — canvas con **todas** las pantallas/estados de Fase 1 en claro y oscuro (Hoy + estados sin-plan/atrasado/✓leído, Oración, Nuevo/Editar pedido, Grupos + detalle, Crear grupo, Unirme por código, Ajustes, Progreso, Planes + confirmación, Bienvenida, Agregá a inicio, Auth).
- `Responsive — Hoy y Oración.dc.html` — Hoy y Oración en móvil/tablet/desktop, claro y oscuro (incluye el sidebar de desktop).
- `Fase 2.dc.html` — funciones diferidas (estoy orando, testimonios, stats pastorales, referencia del día).

Para inspeccionar medidas/colores exactos: abrir cualquier `.dc.html` en el navegador y usar las DevTools sobre el DOM renderizado.
