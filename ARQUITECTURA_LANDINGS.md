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

## Pendiente opcional (no bloqueante)

- OG dedicada para `/lideres` y `/privacidad` (hoy reusan/heredan). Los scripts `scripts/og-*.mjs` y `public/og-grupos.png` quedan sin uso: se pueden reciclar para generar `og-lideres`/`og-privacidad` propias.
