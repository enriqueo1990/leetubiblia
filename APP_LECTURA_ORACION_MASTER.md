# App de Lectura Bíblica y Oración — Documento Maestro

> Documento único de especificación, lógica, diseño y prompts.
> Sirve como fuente de verdad para **Claude Design** (diseño visual) y **Claude Code** (implementación).
> Versión 1.0 — alcance de lanzamiento (Fase 1) + notas de Fase 2.

---

## 0. Resumen ejecutivo

**Nombre:** Lee Tu Biblia · **Dominio:** leetubiblia.com

App **independiente**, multiusuario, instalable como **PWA** (no nativa iOS — sin costo de App Store). Hace dos cosas y nada más: **trackear lectura bíblica** según un plan, y **gestionar pedidos de oración** privados y compartidos en grupos cerrados.

La estética es **estilo Apple**: delicada, minimalista, mucho aire, tipografía sans del sistema, casi monocromática con **un único acento sepia** (elegible entre 6 tonos). Modo claro y oscuro automáticos.

**Principio rector:** el riesgo de esta app no es que le falten funciones, es que se infle. Cada función nueva debe justificar su existencia o queda fuera.

---

## 1. Decisiones cerradas (no reabrir sin razón)

| Tema | Decisión |
|------|----------|
| Plataforma | PWA instalable. No nativa. |
| Texto bíblico | **No se carga.** Solo referencias + enlace para abrir en app de Biblia externa. Evita licencias. |
| Planes de lectura | Catálogo curado de **3–4 planes** a elegir. Uno activo por usuario a la vez. |
| Usuarios | Multiusuario, cada quien con su cuenta. |
| Oraciones | Mixtas: privadas o compartidas con un grupo cerrado. |
| Grupos | Cerrados. Se entra por código/enlace de invitación. |
| Pestañas | Lectura y Oración **separadas** dentro de la misma app. |
| Apertura de Biblia | **YouVersion fijo, versión NBLA** (id 103) (Fase 1). El botón "Abrir en Biblia" arma un *universal link* al **capítulo exacto** del día (`bible.com/bible/103/JER.33.NBLA`): abre la app si está instalada, la web si no. Elegir proveedor/versión = Fase 2. |
| Recordatorio diario | **Fase 1, best-effort.** Notificación local en Android; en iOS **no hay hora-fija garantizada** sin servidor de push — el onboarding no la promete (ver 5.7). Push real desde servidor = Fase 2. |
| Auth | **Magic link** (enlace por email), sin contraseña. Elimina el flujo de recuperación. |
| Acento de color | Sepia, **6 tonos elegibles** en Ajustes. |
| Tema | Claro / oscuro automático (sigue al sistema), con override manual. |

### Fuera de alcance (deliberado)
- Sin chat, comentarios ni hilos en pedidos de oración.
- Sin feed social, likes ni perfiles públicos.
- Sin gamificación más allá de la racha discreta.
- Sin categorías/etiquetas de pedidos.
- Sin adjuntar fotos.
- Sin compartir a redes sociales.
- Sin múltiples planes simultáneos (uno a la vez).
- Sin notas devocionales ni diario.

### Diferido a Fase 2
- "Estoy orando por esto" (toque que notifica a quien pidió).
- Oraciones respondidas compartidas como testimonio al grupo.
- Estadística pastoral para el creador del grupo (activos / respondidos).
- Versículo o referencia del día en portada (opcional, riesgo de inflar).
- **Elegir proveedor de Biblia** (Logos / Bible Gateway / web) en Ajustes. Fase 1 va con YouVersion fijo.
- **Recordatorio por push real desde servidor** (hora fija fiable en iOS, vía Edge Function + cron). Fase 1 es best-effort.

---

## 2. Arquitectura técnica

### Stack
- **Frontend:** React + Vite + Tailwind CSS. PWA (service worker + manifest).
- **Backend / datos:** **Supabase** (Postgres + Auth + Row-Level Security + API autogenerada).
  - Razón: auth, base y permisos resueltos en horas. El RLS resuelve "privado vs compartido con grupo" casi declarativamente, sin escribir un backend a mano.
  - Alternativa considerada: Laravel (consistencia con Domo Iglesia), descartada por peso de mantenimiento para un proyecto que se quiere liviano.
- **Hosting:** Cloudflare Pages (frontend). Supabase gestionado aparte.
- **Notificaciones:** Web Push API + notificaciones locales. En iOS requieren PWA instalada en pantalla de inicio (iOS 16.4+).

### Notas PWA críticas
- El recordatorio diario por notificación **solo funciona si la PWA está instalada** en la pantalla de inicio en iOS (iOS 16.4+). Además, en iOS **no se puede agendar una notificación local a hora fija** sin un servidor de push: en Fase 1 el recordatorio es *best-effort* (fiable en Android, no garantizado en iOS) y el onboarding **no promete una hora exacta**. El push real a hora fija (Edge Function + cron) queda para Fase 2. En el onboarding hay que guiar al usuario a "Agregar a pantalla de inicio".
- Service worker para funcionamiento offline de lectura/marcado (la marca se sincroniza al recuperar conexión).
- `manifest.json` con íconos, `display: standalone`, `theme_color` que cambie según modo.

---

## 3. Modelo de datos

```
users                  (gestionado por Supabase Auth)
  id (uuid, pk)
  email
  display_name
  created_at

profiles
  id (uuid, pk, fk -> users.id)
  display_name
  accent_color        (enum: 6 tonos sepia, default 'sepia_base')
  theme_pref          (enum: 'auto' | 'light' | 'dark', default 'auto')
  reminder_enabled    (bool, default false)
  reminder_time       (time, nullable)
  active_plan_id      (fk -> reading_plans.id, nullable)
  plan_start_date     (date, nullable)

reading_plans         (catálogo curado, no editable por usuario)
  id (pk)
  name                (ej. "M'Cheyne", "Cronológico", "NT en 90 días")
  description
  duration_days       (int)
  is_active           (bool — para habilitar/deshabilitar del catálogo)

plan_days             (qué se lee cada día de cada plan)
  id (pk)
  plan_id (fk -> reading_plans.id)
  day_number          (int, 1..duration_days)
  references          (jsonb — referencia ESTRUCTURADA, no texto suelto.
                       Array de items: { label, book_usfm, chapter, chapter_end? }
                       ej. [{"label":"Jeremías 33","book_usfm":"JER","chapter":33},
                            {"label":"Salmos 5-6","book_usfm":"PSA","chapter":5,"chapter_end":6},
                            {"label":"Mateo 7","book_usfm":"MAT","chapter":7}]
                       label    = lo que se muestra en pantalla (display).
                       book_usfm + chapter = para armar el link a YouVersion.
                       El parsing español→USFM se hace UNA vez, al sembrar, no en runtime.)

reading_progress      (qué marcó cada usuario)
  id (pk)
  user_id (fk)
  plan_id (fk)
  day_number          (int)
  completed_at        (timestamp)
  UNIQUE(user_id, plan_id, day_number)

groups                (grupos cerrados)
  id (pk)
  name
  invite_code         (string único, corto)
  created_by (fk -> users.id)
  created_at

group_members
  id (pk)
  group_id (fk)
  user_id (fk)
  role                (enum: 'owner' | 'member')
  joined_at
  UNIQUE(group_id, user_id)

prayer_requests
  id (pk)
  user_id (fk -> autor)
  title
  description         (text, nullable)
  visibility          (enum: 'private' | 'shared')
  shared_group_id     (fk -> groups.id, nullable — requerido si visibility='shared')
  status              (enum: 'active' | 'answered')
  created_at
  answered_at         (timestamp, nullable)
```

### Reglas RLS (esencia)
- `reading_progress`: el usuario solo ve/escribe sus propias filas.
- `prayer_requests` privados: solo el autor.
- `prayer_requests` compartidos: visibles a los miembros del `shared_group_id`. Solo el autor edita/borra.
- `groups` / `group_members`: visibles a sus miembros. Solo el `owner` administra miembros.

---

## 4. Design System

### 4.1 Acento sepia — 6 tonos elegibles
El usuario elige uno en Ajustes. Es el **único color** fuera de la escala de grises en toda la app.

| Clave | Hex (claro) | Hex (oscuro) | Carácter |
|-------|-------------|--------------|----------|
| `sepia_base`   | `#A88B6A` | `#C2A57E` | Sepia neutro (default) |
| `sepia_clay`   | `#B08968` | `#CBA585` | Más cálido, terracota suave |
| `sepia_olive`  | `#8C8A5E` | `#ABA876` | Oliva apagado |
| `sepia_stone`  | `#9C9080` | `#BBB0A0` | Gris-piedra cálido |
| `sepia_rose`   | `#B08A86` | `#CBA7A2` | Rosa terroso muy tenue |
| `sepia_slate`  | `#7E8A8C` | `#9CAAAC` | Azul-pizarra apagado |

> Todos comparten saturación baja y luminosidad media: ninguno "grita". En oscuro se aclaran ~15% para mantener contraste sobre negro.

### 4.2 Neutros

**Modo claro**
- Fondo app: `#FBFBFA` (blanco cálido, no clínico)
- Superficie / tarjetas: `#FFFFFF`
- Superficie alterna: `#F2F1EE`
- Texto principal: `#1C1C1E`
- Texto suave: `#8A8A8E`
- Hairline / bordes: `#EAE8E3`

**Modo oscuro**
- Fondo app: `#000000` (negro puro OLED, decisión iOS)
- Superficie / tarjetas: `#1C1C1E`
- Superficie alterna: `#2C2C2E`
- Texto principal: `#F2F2F7`
- Texto suave: `#8E8E93`
- Hairline / bordes: `#2C2C2E`

### 4.3 Tipografía
> **Fuente de verdad de tokens visuales = `README.md` (sección Design Tokens).** Es el diseño aprobado de alta fidelidad; si este máster y el README difieren en **valores visuales**, gana el README (ver 10.3). La escala completa se reproduce acá para referencia.
- Familia: `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", system-ui, sans-serif`.
  - En iOS usa San Francisco nativa (lo más Apple posible). Inter como fallback web.
- Escala (móvil):
  - **Display** (referencia protagonista): 38px / 600 / `letter-spacing:-0.8px` / line-height 1.18
  - **Título grande de pantalla:** 26px / 700 / `letter-spacing:-0.6px`
  - **Título de sección / tarjeta:** 18–22px / 600
  - **Cuerpo:** 16px / 400–500 (`line-height:1.5` en párrafos)
  - **Etiqueta / metadato:** 13–14px / 500–600, a veces uppercase con `letter-spacing:0.4–0.6px`
  - **Caption:** 12px / 500–600
  - **Números de stat:** 30–34px / 700 / `letter-spacing:-1px`, en acento

### 4.4 Espaciado y forma
- Espaciado base: múltiplos de 4. Generoso: la app "respira".
- Radios: tarjetas y botones 16px; contenedores grandes 24px+.
- Botón primario: relleno sepia, texto blanco, 17px vertical.
- Botón secundario: transparente, borde hairline 1px, texto principal.
- Sombras: casi inexistentes en claro (sutil cálida); nulas en oscuro (se usa elevación por superficie).

### 4.5 Movimiento
- Transiciones suaves 0.3–0.4s ease en tema, estados de botón, navegación.
- Respetar `prefers-reduced-motion`.
- Nada de animaciones llamativas: el movimiento confirma, no entretiene.

### 4.6 Navegación
- Tab bar inferior, 4 ítems: **Hoy · Oración · Grupos · Ajustes**.
- Fondo translúcido con `backdrop-filter: blur(20px)`.
- Ítem activo en color de acento; resto en texto suave.
- En desktop la tab bar se transforma en sidebar (ver 4.7).

### 4.7 Responsive (mobile-first)

**Principio rector:** el contenido nunca supera su ancho de lectura cómodo. En pantallas grandes crece el espacio alrededor, no el contenido. Ensanchar el contenido es lo que hace que las apps se sientan baratas en desktop. El uso esperado es ~95% móvil; tablet y desktop deben verse **dignos y usables**, no sobre-optimizados.

**Breakpoints y comportamiento:**

| Rango | Layout |
|-------|--------|
| **Móvil** (≤640px) | Diseño base. Tab bar inferior, una columna a todo el ancho con padding lateral. |
| **Tablet** (641–1024px) | Contenido en **columna centrada, ancho máximo ~560–640px** sobre el fondo. Los márgenes laterales quedan como aire. La tab bar puede seguir abajo (centrada bajo la columna). Evita estirar listas y referencias a todo el ancho: se ven desoladas. |
| **Desktop** (≥1024px) | La tab bar inferior se reemplaza por **sidebar de navegación a la izquierda** (Hoy / Oración / Grupos / Ajustes como lista vertical, ítem activo en sepia). El contenido sigue en columna centrada con ancho máximo a la derecha del sidebar. |

**Reglas:**
- Ancho máximo de contenido: `max-w-xl` (~576px) a `max-w-2xl` (~672px). Centrado con `mx-auto`.
- La única transformación **estructural** es tab-bar → sidebar en ≥1024px. El resto es contención de ancho (casi gratis con Tailwind).
- **Opcional / refinamiento, no esencial:** en Oración a ≥1024px, layout de dos paneles (lista a la izquierda, detalle a la derecha). No invertir en esto salvo que el uso desktop lo justifique.
- Targets táctiles ≥44px en todos los tamaños. Tipografía display puede crecer levemente en desktop pero sin perder la jerarquía.

---

## 5. Pantallas — especificación detallada

### 5.1 Hoy (pestaña 1 — la cara de la app)
**Propósito:** lo que el usuario ve cada mañana. Una sola pantalla, sin ruido.

**Contenido (de arriba a abajo):**
1. Fecha actual, discreta, uppercase, texto suave.
2. Nombre del plan + día actual, en color de acento (ej. "Plan M'Cheyne · Día 176").
3. Etiqueta "Lectura de hoy" (texto suave).
4. **Referencias del día**, protagonistas: tipografía display, una por línea (los planes suelen tener varios pasajes, a veces largos como "1 Crónicas 20"). Se listan todas.
5. Empuje al fondo (margin-top auto):
   - Botón primario: **Marcar como leído** → al tocar cambia a estado "✓ Leído hoy" (superficie alterna + texto suave).
   - Botón secundario: **Abrir en mi app de Biblia ↗** → enlace externo.

**Lógica:**
- **Regla canónica de `day_number` (única — no usar ninguna otra):**
  `día_de_hoy = (hoy − plan_start_date) en días + 1`, computado en la **zona horaria local del dispositivo** (el día corta a la **medianoche local**, no UTC). Lo que "Hoy" muestra **siempre lo dicta el calendario**, sin importar cuánto se leyó. Si te atrasaste, "Hoy" igual muestra el día que toca por fecha; los días saltados quedan **sin marcar** (no se completan solos) y se pueden tildar después desde Progreso (5.2). El historial refleja lo realmente leído.
- Marcar leído → inserta fila en `reading_progress` para `día_de_hoy`. Idempotente.
- Si ya está leído hoy, el botón aparece en estado completado al cargar.
- "Abrir en Biblia": arma un **universal link de YouVersion al capítulo exacto** desde la referencia estructurada del día: `https://www.bible.com/bible/103/{book_usfm}.{chapter}.NBLA` (ej. `.../103/JER.33.NBLA`). Abre la app si está instalada, la web si no. Si hay varias referencias, abre la **primera**. (`103` = id de la versión **NBLA** en YouVersion.)

**Estados:**
- Sin plan activo → estado vacío: "Elegí un plan para empezar" + botón a selección de plan.
- Atrasado → no culpar. Mostrar dato neutro ("Te atrasaste 3 días") con opción "Reprogramar".

**Reprogramar (lógica):**
- **Propósito:** salida sin culpa para quien se atrasó. Evita el agujero de días perdidos que empuja al abandono. La meta pastoral es continuidad en la Palabra, no cumplir una racha.
- **Qué hace:** mueve `plan_start_date` para que "Hoy" vuelva a mostrar el primer día no leído:
  `plan_start_date = hoy − (primer_día_no_leído − 1)`. Así "Hoy" coincide otra vez con donde realmente vas. Los días saltados quedan **sin marcar** y se pueden tildar luego desde Progreso si la persona los lee.
- **Decisión tomada — correr y seguir, sin reinsertar:** los días saltados NO se reinsertan más adelante. El plan continúa hacia adelante desde hoy. No se arrastra deuda ni se fuerza completismo. Si la persona quiere leer lo que se saltó, lo hace por su cuenta.
- **Historial:** no se inventan filas de `reading_progress` para los días saltados (no se marcan como leídos lo que no se leyó). Simplemente quedan sin registro y el plan sigue. El histórico refleja lo realmente leído.
- **UI:** un toque, confirmación breve y neutra ("Listo, seguimos desde hoy"). Sin lenguaje de fracaso ni de "ponerse al día".

---

### 5.2 Progreso (sub-vista de Hoy o accesible desde Hoy)
**Propósito:** ver avance sin culpa.

**Contenido:**
- Racha actual (días seguidos) — discreta.
- % del plan completado.
- Historial: heatmap/calendario de días leídos. **Interactivo:** tocar una celda de un día **pasado** lo marca/desmarca como leído (insert/delete en `reading_progress`). Es el **único lugar** para registrar días atrasados que la persona sí leyó — sin esto el historial mentiría. Los días futuros no son tocables.

**Lógica:**
- Racha = días consecutivos con fila en `reading_progress` hasta hoy/ayer.
- % = días completados / `duration_days`.
- El "atraso" es informativo, nunca un regaño.

---

### 5.3 Selección / cambio de plan
**Propósito:** elegir uno de los 3–4 planes curados.

**Contenido:**
- Tarjetas de plan: nombre, descripción breve, duración.
- Plan activo marcado.
- Al elegir uno nuevo → confirma ("Esto reinicia tu progreso del plan anterior").

**Lógica:**
- Set `profiles.active_plan_id` + `plan_start_date = hoy`.
- Cambiar de plan no borra el histórico de progreso anterior, pero arranca el nuevo desde día 1.

---

### 5.4 Oración (pestaña 2)
**Propósito:** ver y gestionar pedidos propios y de los grupos.

**Contenido:**
- Dos secciones (o segmented control): **Míos** / **De mis grupos**.
- **Míos:** lista de pedidos del usuario (privados y compartidos), con indicador de visibilidad y estado.
- **De mis grupos:** pedidos que otros compartieron con grupos a los que pertenezco. Agrupados por grupo.
- Cada ítem: título, fecha, badge de estado (activo / respondido), badge de visibilidad (candado = privado, ícono grupo = compartido).
- Botón flotante o superior: **+ Nuevo pedido**.

**Lógica:**
- "Míos" = `prayer_requests where user_id = yo`.
- "De mis grupos" = `prayer_requests where visibility='shared' and shared_group_id in (mis grupos) and user_id != yo`.
- Orden: activos primero, por fecha desc; respondidos al final o en sub-sección.

---

### 5.5 Crear / editar pedido de oración
**Propósito:** capturar un pedido, mínima fricción.

**Campos:**
- Título (requerido).
- Descripción (opcional, multilínea).
- Visibilidad: **Privado** / **Compartir con grupo** → si compartir, selector de grupo (solo grupos a los que pertenece).
- (Al editar) Estado: activo / respondido. Marcar respondido → set `answered_at = ahora`.

**Lógica:**
- Crear → inserta en `prayer_requests`.
- Si `visibility='shared'`, `shared_group_id` es obligatorio.
- Marcar respondido es pastoralmente valioso: queda registro de oración contestada (base para testimonio en Fase 2).
- Solo el autor edita/borra.

---

### 5.6 Grupos (pestaña 3)
**Propósito:** administrar pertenencia a grupos cerrados.

**Contenido:**
- Lista de mis grupos (nombre, nº de miembros, rol).
- Acciones: **Crear grupo** / **Unirme por código**.
- Detalle de grupo: lista de miembros; si soy owner, puedo administrar (quitar miembro, ver código de invitación, regenerar código).

**Lógica:**
- Crear grupo → genera `invite_code` único corto; creador queda `owner`.
- Unirse → valida código, inserta en `group_members` como `member`.
- Compartir invitación = compartir el código o un enlace `app/join?code=XXXX`.
- Solo `owner` administra miembros y código.

---

### 5.7 Ajustes (pestaña 4)
**Propósito:** preferencias personales.

**Contenido:**
- **Color de acento:** 6 muestras sepia, selección visual inmediata (cambia toda la app al instante).
- **Tema:** Auto / Claro / Oscuro.
- **Recordatorio diario:** switch + selector de hora (si on). En iOS, *best-effort* (ver Lógica); no se promete hora exacta.
- **Cuenta:** nombre, email, cerrar sesión, **Eliminar cuenta**.
- Acerca de / versión.

**Lógica:**
- Cambio de acento → update `profiles.accent_color`, aplica vía CSS variable en vivo.
- Tema → update `profiles.theme_pref`; "Auto" sigue `prefers-color-scheme`.
- Recordatorio → pide permiso de notificaciones; en Android registra la notificación local a la hora elegida. En iOS es *best-effort*: requiere PWA instalada (mostrar aviso para agregar a pantalla de inicio) y **no garantiza hora fija** sin servidor de push (diferido a Fase 2). El copy no promete una hora exacta en iOS.
- **Eliminar cuenta:** confirma con alert. Borra el `profile` y **todos** los datos del usuario en cascada: `reading_progress`, sus `prayer_requests` (privados **y los compartidos a grupos** — se borran, no se anonimizan) y sus `group_members`. Si era `owner` de un grupo, reasigna owner al miembro más antiguo, o borra el grupo si queda vacío. Cierra sesión y vuelve a Bienvenida.

---

### 5.8 Onboarding / Auth
**Propósito:** entrada mínima.

**Flujo:**
1. Bienvenida breve (1 pantalla, identidad visual).
2. Registro / ingreso (Supabase Auth — **solo magic link**: el usuario pone su email y recibe un enlace de acceso. Sin contraseña → sin flujo de recuperación).
3. **"¿Cómo te llamás?"** — campo de nombre, solo en la primera entrada (set `profiles.display_name`). Necesario porque el magic link no captura nombre y la app lo muestra en Grupos y pedidos compartidos.
4. Elegir plan de lectura.
5. (Opcional) activar recordatorio.
6. Aviso "Agregá a pantalla de inicio" en iOS para notificaciones + uso offline.
→ Aterriza en **Hoy**.

---

## 6. Prompts para Claude Design

> Pegá estos en el lienzo de Claude Design, en orden. Cada prompt asume que el anterior ya estableció el sistema visual. Empezá por el sistema, luego Hoy, luego el resto.

### Prompt 0 — Sistema de diseño
```
Estoy diseñando una PWA estilo Apple: delicada, minimalista, mucho aire.
Es para trackear lectura bíblica y pedidos de oración. Definí un sistema visual:

- Tipografía: SF Pro / system-ui, sans limpia. Display 38px peso 600 con
  letter-spacing -0.8px; títulos 22px/600; cuerpo 16px; etiquetas 14px/500
  (a veces uppercase, letter-spacing 0.4px); caption 12px.
- Casi monocromático. Un único acento sepia #A88B6A (claro) / #C2A57E (oscuro).
  Es el único color fuera de la escala de grises.
- Modo claro: fondo #FBFBFA, superficie #FFFFFF, superficie alterna #F2F1EE,
  texto #1C1C1E, texto suave #8A8A8E, hairline #EAE8E3.
- Modo oscuro: fondo #000000 (negro puro OLED), superficie #1C1C1E,
  superficie alterna #2C2C2E, texto #F2F2F7, texto suave #8E8E93, hairline #2C2C2E.
- Radios 16px en botones/tarjetas, 24px en contenedores. Espaciado generoso,
  múltiplos de 4. Transiciones suaves 0.3-0.4s.
- Tab bar inferior translúcida (blur 20px) con 4 ítems: Hoy, Oración, Grupos, Ajustes.
  Ítem activo en sepia, resto en texto suave.
Mostrame el sistema aplicado a componentes base: botón primario (sepia),
botón secundario (borde hairline), tarjeta, y la tab bar, en claro y oscuro.
```

### Prompt 1 — Pantalla Hoy
```
Diseñá la pantalla "Hoy" con el sistema anterior. De arriba a abajo:
fecha actual discreta en uppercase texto suave; debajo "Plan M'Cheyne · Día 176"
en sepia; etiqueta "Lectura de hoy"; luego las referencias del día como
protagonistas en tipografía display, una por línea: "Jeremías 33", "Salmos 5-6",
"Mateo 7" (puede haber referencias largas tipo "1 Crónicas 20"). Al fondo,
botón primario sepia "Marcar como leído" y botón secundario "Abrir en mi app
de Biblia ↗". Mostrala en claro y oscuro. Incluí el estado "✓ Leído hoy"
(botón en superficie alterna, texto suave).
```

### Prompt 2 — Oración (lista)
```
Diseñá la pantalla "Oración". Segmented control arriba: "Míos" / "De mis grupos".
Lista de pedidos: cada ítem con título, fecha, badge de estado (activo/respondido)
y badge de visibilidad (candado=privado, ícono de grupo=compartido). Botón
"+ Nuevo pedido" arriba a la derecha o flotante. En "De mis grupos", los pedidos
van agrupados por nombre de grupo. Activos primero, respondidos atenuados al final.
Claro y oscuro.
```

### Prompt 3 — Crear pedido
```
Diseñá la pantalla "Nuevo pedido de oración". Campos: Título (requerido),
Descripción (opcional, multilínea), y selector de visibilidad: "Privado" /
"Compartir con grupo". Si elige compartir, aparece un selector de grupo.
Botón primario "Guardar pedido". Minimalista, mucho aire, mínima fricción.
Claro y oscuro.
```

### Prompt 4 — Grupos
```
Diseñá la pantalla "Grupos". Lista de mis grupos (nombre, nº de miembros, mi rol).
Dos acciones arriba: "Crear grupo" y "Unirme por código". Diseñá también el
detalle de un grupo: lista de miembros y, para el owner, el código de invitación
visible con opción de copiar/regenerar. Claro y oscuro.
```

### Prompt 5 — Ajustes
```
Diseñá la pantalla "Ajustes". Secciones: Color de acento (6 muestras sepia
en fila, seleccionables: #A88B6A, #B08968, #8C8A5E, #9C9080, #B08A86, #7E8A8C —
con sus variantes claras para modo oscuro); Tema (Auto/Claro/Oscuro segmented);
Recordatorio diario (switch + selector de hora); Cuenta (nombre, email, cerrar
sesión). Estilo lista iOS con agrupaciones y hairlines. Claro y oscuro.
```

### Prompt 6 — Estados vacíos y onboarding
```
Diseñá: (1) estado vacío de "Hoy" sin plan activo ("Elegí un plan para empezar"
+ botón); (2) pantalla de selección de plan con 3-4 tarjetas (nombre, descripción,
duración, plan activo marcado); (3) bienvenida de onboarding (1 pantalla con
identidad visual); (4) aviso "Agregá a pantalla de inicio" para iOS. Claro y oscuro.
```

### Prompt 4 (responsive) — Comportamiento en tablet y desktop
> Pegá este en Claude Design cuando ya tengas las pantallas principales diseñadas. Define cómo se adaptan a pantallas grandes manteniendo el sistema visual.
```
Las pantallas que ya diseñamos son mobile-first y están bien así. Ahora definí
cómo se comportan en tablet y desktop, manteniendo idéntico el sistema visual.
Principio rector: el contenido nunca supera su ancho de lectura cómodo. En
pantallas grandes crece el espacio alrededor, NO el contenido. Estirar listas y
referencias a todo el ancho se ve barato y desolado.

- Móvil (hasta 640px): el diseño actual tal cual. Tab bar abajo, una columna.

- Tablet (641 a 1024px): el contenido va en una columna centrada con ancho máximo
  de ~560-640px sobre el fondo; los márgenes laterales quedan como aire. La tab bar
  sigue abajo, centrada bajo la columna.

- Desktop (1024px o más): la tab bar inferior se reemplaza por un sidebar de
  navegación a la izquierda (Hoy, Oración, Grupos, Ajustes como lista vertical,
  ítem activo en sepia). El contenido sigue en columna centrada con ancho máximo,
  a la derecha del sidebar.

La única transformación estructural es tab-bar → sidebar en desktop; el resto es
contención de ancho. Mantené los mismos colores, tipografía, radios y aire.
Targets táctiles cómodos en todos los tamaños. Mostrame Hoy y Oración en los tres
anchos (móvil, tablet, desktop), en claro y oscuro.
```

---

## 7. Prompts / instrucciones para Claude Code

> Secuencia de construcción sugerida. Cada bloque es una tarea acotada para delegar.

### Tarea 1 — Andamiaje
```
Creá un proyecto PWA con React + Vite + Tailwind CSS. Configurá:
- Service worker y manifest.json (name/short_name "Lee Tu Biblia", display
  standalone, theme_color dinámico, íconos placeholder).
- Estructura de carpetas: /src/screens, /src/components, /src/lib (supabase client),
  /src/hooks, /src/styles.
- Sistema de tokens de diseño como CSS variables, con los neutros claro/oscuro
  y un set de 6 acentos sepia conmutables vía atributo data-accent en :root.
- Tema auto que sigue prefers-color-scheme, con override por clase .light / .dark.
- Tab bar inferior con 4 rutas: Hoy, Oración, Grupos, Ajustes (React Router).
  En desktop (≥1024px) la tab bar se reemplaza por sidebar lateral izquierdo.
- Layout responsive mobile-first (ver sección 4.7): contenido en columna centrada
  con ancho máximo (max-w-xl/2xl, mx-auto) en tablet y desktop; el contenido nunca
  se estira a todo el ancho en pantallas grandes.
No conectes datos todavía; usá mocks.
```

### Tarea 2 — Supabase y modelo de datos
```
Configurá Supabase. Creá las tablas: profiles, reading_plans, plan_days,
reading_progress, groups, group_members, prayer_requests (ver esquema en el
documento maestro, sección 3). Definí políticas RLS:
- reading_progress: usuario solo ve/escribe lo suyo.
- prayer_requests privados: solo autor. Compartidos: visibles a miembros del
  shared_group_id; solo autor edita/borra.
- groups/group_members: visibles a miembros; solo owner administra.
Sembrá el catálogo de **lanzamiento con 3 planes**: **M'Cheyne** (365),
**Cronológico** (365) y **Proverbios en 31 días** (31). (NT en 90 días = más
adelante.) Fuentes de contenido: M'Cheyne (dominio público); Cronológico
día-por-día de bibliavida.com/planes-lectura/cronologico.html (365 días, formato
"Día N: Génesis 1:1-31;…"); Proverbios = capítulos 1..31. Las `references` van
**estructuradas** (book_usfm + chapter, ver esquema sección 3): el parsing
español→USFM se hace acá, una vez, al sembrar, no en runtime. Generá el cliente
de Supabase en /src/lib.
```

### Tarea 3 — Auth y onboarding
```
Implementá Supabase Auth (**solo magic link**, sin contraseña → sin recuperación). Flujo de onboarding:
bienvenida → registro/ingreso → elegir plan (set active_plan_id + plan_start_date)
→ opción de recordatorio → aviso "agregar a pantalla de inicio" en iOS → Hoy.
Creá/actualizá la fila en profiles al registrarse.
```

### Tarea 4 — Pantalla Hoy + Progreso
```
Implementá la pantalla Hoy según sección 5.1 del documento maestro: calcular
day_number con la **regla canónica** (`(hoy − plan_start_date) + 1`), mostrar
referencias del día, marcar leído (insert idempotente en reading_progress),
botón "abrir en Biblia" = universal link de YouVersion al capítulo exacto
(`bible.com/bible/103/{USFM}.{chapter}.NBLA`, primera referencia del día). Estados:
sin plan, atrasado (sin culpa, con reprogramar). Implementá Progreso (5.2):
racha, % completado, historial **interactivo** (tildar días pasados como leídos).
```

### Tarea 5 — Oración
```
Implementá Oración (5.4): secciones "Míos" y "De mis grupos" con las queries
descritas. Crear/editar pedido (5.5): título, descripción, visibilidad
private/shared con selector de grupo, estado active/answered (answered_at).
Respetar RLS. Solo el autor edita/borra.
```

### Tarea 6 — Grupos
```
Implementá Grupos (5.6): crear grupo (genera invite_code único corto, creador=owner),
unirse por código, detalle con miembros, administración por owner (quitar miembro,
ver/regenerar código), enlace de invitación app/join?code=XXXX.
```

### Tarea 7 — Ajustes + notificaciones
```
Implementá Ajustes (5.7): selector de 6 acentos sepia (cambia CSS var en vivo +
persiste en profiles.accent_color), tema auto/claro/oscuro, recordatorio diario
(permiso de notificaciones; en Android notificación local a la hora elegida; en
iOS best-effort, sin prometer hora fija + aviso si no está instalada como PWA),
datos de cuenta, cerrar sesión y **eliminar cuenta** (borrado en cascada de datos
propios incl. pedidos compartidos; reasignar/borrar grupos si era owner).
```

### Tarea 8 — Pulido PWA
```
Verificá instalabilidad (Lighthouse PWA), funcionamiento offline de Hoy y marcado
(cola de sincronización al recuperar conexión), accesibilidad (focus visible,
contraste AA, prefers-reduced-motion), y theme_color del manifest que acompañe
el modo. Íconos definitivos.
```

---

## 8. Checklist de lanzamiento (Fase 1)

- [ ] Auth funcionando (magic link: registro e ingreso por enlace; sin contraseña).
- [ ] Eliminar cuenta (borra perfil + datos propios + pedidos compartidos; reasigna/borra grupos si era owner).
- [ ] 3–4 planes sembrados con sus días completos.
- [ ] Hoy: referencias, marcar leído, abrir Biblia, estados sin-plan/atrasado.
- [ ] Progreso: racha, %, historial.
- [ ] Cambiar de plan.
- [ ] Oración: míos / de grupos, crear, editar, privado/compartido, respondido.
- [ ] Grupos: crear, unirse por código, administrar (owner).
- [ ] Ajustes: 6 acentos, tema, recordatorio, cuenta.
- [ ] RLS verificado (un usuario no ve datos de otro fuera de grupos).
- [ ] PWA instalable, offline básico, notificación local.
- [ ] Claro/oscuro correctos en todas las pantallas.
- [ ] Onboarding completo incluido aviso iOS.

---

## 9. Notas de producto (recordatorios de criterio)

- Cada vez que aparezca la tentación de agregar algo, preguntarse: ¿esto sirve a las dos funciones núcleo, o las infla? Ante la duda, Fase 2 o nunca.
- El "marcar respondido" no es un checkbox cualquiera: es registro de oración contestada. Es la semilla del testimonio compartido de Fase 2. Tratarlo con dignidad en la UI.
- El atraso en lectura nunca se comunica con culpa. Dato neutro + camino de vuelta.
- El acento es lo único con color: protegerlo. Si algo más empieza a tener color, el minimalismo se rompe.

---

## 10. Cómo arrancar en Claude Code

> Esta sección hace el documento autosuficiente para el momento de construir. Seguila en orden.

### 10.1 Antes de abrir Claude Code (lo que hacés vos, no se delega)

Estos pasos involucran cuentas y credenciales: los hacés vos, no Claude Code.

1. **Instalá Claude Code** si no lo tenés.
2. **Creá el proyecto en Supabase** (plan gratis): entrá a supabase.com, creá un proyecto nuevo, elegí región cercana. Guardá la **Project URL** y la **anon key** (Settings → API). No las pegues en el chat; van en un archivo `.env` local.
3. **Creá el repo en GitHub** para el proyecto.
4. **Conectá el repo a Cloudflare Pages** (se puede hacer después del primer commit; deploy automático desde GitHub).

> Nota plan gratis Supabase: si el proyecto queda sin actividad una semana, se pausa; se reactiva con un clic. Para uso diario real no ocurre.

### 10.2 Arquitectura de destino (recordatorio)
- **Frontend:** React + Vite + Tailwind → Cloudflare Pages.
- **Backend:** Supabase gestionado (plan gratis).
- **Droplet de DigitalOcean:** NO participa en esta app. Queda disponible por si algún día se migra a Supabase self-hosted, pero no se necesita para lanzar.

### 10.3 Regla de oro del traspaso
Claude Code **no abre el diseño de Claude Design directamente**. Lo que cruza son **dos documentos**, con jerarquía clara:
- **`APP_LECTURA_ORACION_MASTER.md` (este) = fuente de verdad de producto y lógica:** decisiones cerradas, modelo de datos, RLS, alcance, reglas (day_number, reprogramar, borrado de cuenta, etc.).
- **`README.md` = fuente de verdad de diseño visual:** tokens, medidas, colores, tipografía y especificación de pantallas en alta fidelidad. Es el **diseño aprobado**.
- **Regla:** en lógica/datos manda el máster; en **valores visuales manda el README**. Si un export de Claude Design difiere, gana el documento correspondiente. Antes de construir, mantené los dos sincronizados.

### 10.4 Cómo dar el contexto en cada sesión
Trabajá **una Tarea de la sección 7 por sesión**, no todo de una. Adjuntá este documento y pará a verificar al terminar cada tarea. No pasés a la siguiente hasta que la anterior corra y la hayas revisado.

**Primer mensaje a Claude Code (copiá esto):**
```
Te adjunto el documento maestro de mi PWA (lectura bíblica + oración).
Es la fuente de verdad: seguí el design system de la sección 4, el responsive
de la 4.7, el modelo de datos de la 3, y las pantallas de la 5.

Trabajemos UNA tarea de la sección 7 por vez. Empezá SOLO por la Tarea 1
(andamiaje: React + Vite + Tailwind, estructura de carpetas, tokens de diseño
con los 6 acentos sepia conmutables, tema claro/oscuro auto, tab bar que pasa a
sidebar en desktop, responsive mobile-first). Usá mocks, sin datos todavía.
Cuando termines, pará para que yo verifique antes de seguir con la Tarea 2.
```

Después, sesión por sesión, vas pidiendo Tarea 2, 3, … hasta la 8.

### 10.5 Orden obligatorio de tareas (no saltear)
```
Tarea 1  Andamiaje (React/Vite/Tailwind, tokens, responsive)
Tarea 2  Supabase + tablas + RLS + seed de planes   ← acá pegás Project URL y anon key en .env
Tarea 3  Auth + onboarding
Tarea 4  Pantalla Hoy + Progreso
Tarea 5  Oración (lista, crear, editar, privado/compartido)
Tarea 6  Grupos (crear, unirse, administrar)
Tarea 7  Ajustes + notificaciones
Tarea 8  Pulido PWA (offline, instalable, accesibilidad, íconos)
```
Cada tarea se apoya en la anterior. Saltarse el orden (ej. pantallas con datos antes de tener tablas y RLS) obliga a rehacer.

### 10.6 Qué esperar (y qué no)
- **No** esperes reproducción pixel-perfect del diseño de Claude Design. Claude Code construye según los tokens del documento; los detalles finos de espaciado y sensación se ajustan mirando el resultado real corriendo.
- Las credenciales de Supabase van en `.env` local y en las variables de entorno de Cloudflare Pages — **nunca** en el repo ni en el chat.
- Si una tarea sale muy grande, pedí que la parta en sub-pasos. Sesiones cortas y verificables son mejores que una corrida gigante difícil de auditar.

### 10.7 Al terminar: deploy
- Frontend: push a GitHub → Cloudflare Pages compila y publica.
- Variables de entorno de Supabase cargadas en Cloudflare Pages (no en el código).
- Verificá el checklist de la sección 8 antes de considerar lista la Fase 1.
