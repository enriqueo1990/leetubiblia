# Arquitectura de páginas públicas — Lee Tu Biblia

_Reorganización ejecutada el 11 de julio de 2026. Modelo: hub y radios (plano)._

## Mapa final

```
/  (o /info)   ← LA PUERTA. Presentación en frío + bifurcación al líder.
│
├── /lideres      ← Página del líder de grupo (fusión de las dos antiguas).
├── /ayuda        ← Manual/referencia. Se entra desde Ajustes y el footer.
└── /privacidad   ← Capa de confianza (nueva).

footer global en las 4  ← el tejido conectivo (landingKit → LandingFooter).
```

Ejes de contenido: **audiencia** (lector · líder) × **intención** (orientar · consultar · dar confianza).

## Tabla de decisiones

| Antes | Acción | Ahora | Razón |
|---|---|---|---|
| `/info` | **Mantener** + enlace a `/lideres` + footer global | `/info` | Es la puerta. Le faltaba dar salida a las hermanas. |
| `/grupos-de-discipulado` (pitch) | **Fusionar** | `/lideres` | Se le hablaba al líder 3 veces. La "presentación" con voz de venta sobraba. |
| `/guia-lideres` (walkthrough real) | **Fusionar** (base de la nueva) | `/lideres` | El recorrido con capturas reales es lo honesto; se le injertó el "Por qué". |
| `/guia` (manual) | **Renombrar** + footer global | `/ayuda` | No es captación, es referencia. El nombre lo dice. |
| — | **Crear** | `/privacidad` | App con cuentas y datos de oración; no había página de privacidad. |
| (sin footer conector) | **Crear** `LandingFooter` | footer global ×4 | Convierte piezas sueltas en un sitio. |

## Cambios técnicos

- **Componentes:** `GuiaLideres.jsx`→`Lideres.jsx` (repurposed), `Guia.jsx`→`Ayuda.jsx`, `GruposDiscipulado.jsx` **eliminado**, `Privacidad.jsx` **nuevo**. Footer compartido en `landingKit.jsx`.
- **Rutas** (`App.jsx`): `/info`, `/lideres`, `/ayuda`, `/privacidad`. Las viejas redirigen client-side.
- **301 server-side** (`public/_redirects`): `/grupos-de-discipulado`→`/lideres`, `/guia-lideres`→`/lideres`, `/guia`→`/ayuda`. Conserva los links ya compartidos.
- **SEO:** `vite.config.js` (carpetas-índice + OG por página), `sitemap.xml` y `llms.txt` actualizados. `/lideres` reusa `og-lideres.png`; `/ayuda` reusa `og-guia.png`; `/privacidad` cae en `og-image.png`.
- **Enlace interno:** Ajustes → `/ayuda` (antes `/guia`).

## Verificado

- Desde la puerta se alcanza cualquier hermana en un clic (footer + enlace en la sección de líderes).
- Al líder se le habla una sola vez, con capturas reales, sin tono de pitch.
- Footer idéntico en las 4, marca la página actual.
- `/privacidad` veraz: privado por defecto, opt-in en grupos, borrado en cascada desde Ajustes, sin publicidad ni venta de datos, contacto real.
- Rutas viejas redirigen (server 301 + client-side). Build limpio, sin errores de consola. Móvil y modo oscuro OK.

## Diferenciación visual por función (2ª pasada)

Las 4 compartían el mismo sistema **y** la misma plantilla, así que se confundían
entre sí (¿info repetida?). Se mantuvo el sistema (color, tipo, componentes,
footer) y se diferenció la **estructura según el trabajo de cada página**:

- **Header compartido `LandingHeader`** con navegación VISIBLE entre las 4
  hermanas (no oculta tras un menú), para quien no baja al footer. El enlace
  activo marca "estás acá". Espeja la nav del footer (una sola fuente, `SITE_NAV`).
  En móvil hace scroll horizontal si no entran.
- **`/info`** — único con hero de marketing centrado + CTA grande; sin breadcrumb (es la puerta).
- **`/lideres`** — hero cálido + **tríada de capturas reales en abanico** como firma propia.
- **`/ayuda`** — encabezado tipo **manual**: alineado a la izquierda, "MANUAL · REFERENCIA", índice de pestañas con chips, sin resplandor sepia.
- **`/privacidad`** — encabezado tipo **documento**: izquierda, fecha bajo el título, sin resplandor.

Resultado: cada página se reconoce de un vistazo; la marca sigue siendo una sola.

## Atmósfera cálida (3ª pasada — auditoría de diseño)

Diagnóstico: header frío que peleaba con los heros (costura visible entre el
divisor gris de la nav y el resplandor que nacía debajo), todo gris-sobre-crema,
tinte del acento casi invisible (13%). Correcciones:

- **`LandingGlow`**: el resplandor pasó a nivel de página, DETRÁS del header —
  header y hero son una sola lámina cálida. Fuerte (19%) en `/info` y `/lideres`,
  suave (11%) en `/ayuda` y `/privacidad`.
- **Header sin divisor**; ítem activo de la nav como píldora con tinte sepia
  (outdent `-mx` para conservar la alineación del texto); CTA "Abrir la app" con
  tinte cálido en vez de borde gris.
- **`.landing-band`**: bandas alternas con lavado sepia (7% sobre el fondo) en
  vez del surface-alt casi idéntico al fondo; chips del índice de `/ayuda` con
  tinte.

## Paleta semántica (4ª pasada)

"Todo muy marrón, monocromático" → primero se probó alternar cálido/frío por
índice: **forzado** (decoración mecánica). La respuesta correcta: **color por
significado**, tomado de los 12 acentos de la app (6 sepias + 6 pasteles):

| Tema | Matiz | Uso |
|---|---|---|
| Lectura / marca | sepia (`--accent`) | CTAs, hero, pestaña Hoy |
| Oración | coral `#E2906C` | eyebrow+badges+banda de Oración, mock "Estoy orando" |
| Grupos | menta `#57B795` | discipulado de `/info`, pestaña Grupos, puntos del GroupMock |
| Ajustes / extras | cielo `#6FA4D8` | pestaña Ajustes, ítems de cuenta/config |

Cada sección viste su matiz completo (eyebrow + badges + banda + mock): sistema,
no confetti. Los chips del índice de `/ayuda` adelantan la paleta. Clases en
landingKit: `hb-*` (badge), `ht-*` (texto AA), `band-*`, `hs-oracion` (sólido).
Resplandor bitonal (sepia + menta) detrás del header. `/privacidad` unificada a
880 (el frame 720 se leía como error).

## Capturas actuales (5ª pasada)

Las capturas de `/lideres` eran de una versión vieja (acento aqua). Se retomaron
de la app REAL con `scripts/capture-guia-lideres.mjs` (puppeteer-core + Chrome
del sistema, 390×844 @2x): cuenta dev con datos demo (Pablo · sepia · "Grupo de
los martes" · Proverbios como plan de grupo; sembrado con `seed-testdata.mjs`).
Para refrescarlas en el futuro: seed → dev server → ese script. OGs de
`/lideres` y `/ayuda` regeneradas con las URLs nuevas.

## Mocks de /info y /ayuda → capturas reales (6ª pasada)

Los mocks compartidos (`PhoneMock`, `GroupMock`, `PrayerMock` en landingKit)
eran ILUSTRACIONES dibujadas a mano dentro de un `PhoneFrame` (bisel falso,
altura fija, tab bar sintética) — contenido inventado ("Grupo Norte", "Jeremías
33" fijo). Al lado de las capturas reales nuevas de `/lideres` quedaban como
"versión vieja de la app". Se reemplazaron por el mismo patrón `Shot` (imagen
real + borde/sombra, alto natural, sin bisel) con 3 capturas nuevas:
`src/assets/mocks/{hoy-lectura,sala-grupo,oracion-lista}.png`, mismo pipeline
(`scripts/capture-guia-lideres.mjs`, extendido). `PhoneFrame` fue eliminado.

## Pendiente opcional (no bloqueante)

- OG dedicada para `/privacidad` (hoy hereda la genérica). `og-grupos.mjs` y
  `public/og-grupos.png` quedaron huérfanos (la ruta murió): reciclables.
