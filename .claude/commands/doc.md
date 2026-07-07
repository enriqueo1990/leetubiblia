---
description: Genera una guía visual de funciones de Lee Tu Biblia (qué hace la app), en el propio lenguaje de diseño de la app, y la publica como Artifact compartible
---

Tu tarea es generar una **guía de funciones** de la app Lee Tu Biblia: un catálogo atemporal de "qué hace la app", en lenguaje de usuario y **con lindo diseño**. A diferencia de `/actualizaciones` (cronológico, "qué hay de nuevo"), esto es de referencia y no caduca.

El argumento opcional `$ARGUMENTS` puede pedir un enfoque (ej. "solo grupos", "para la landing", "versión corta"). Si está vacío, cubre toda la app.

## Cómo obtener las funciones (fuente de verdad = el código)

1. Lee las rutas en `src/App.jsx` para saber qué pantallas existen.
2. Revisa `src/screens/*.jsx` y `README.md` / `APP_LECTURA_ORACION_MASTER.md` para describir con precisión qué hace cada una.
3. **Agrupa por las 4 pestañas** de la app: **Hoy (Lectura) · Oración · Grupos · Ajustes**, más las sub-vistas de cada una (Progreso, Tu recorrido, Mi camino, Materiales, etc.).
4. Excluye lo interno: panel `/admin`, landings de captación (`/info`, `/grupos-de-discipulado`), SEO/OG, migraciones.

## Reglas de contenido

- **Lenguaje de usuario**, cálido y en segunda persona. Nada de jerga técnica.
- **Respeta el principio de producto:** la app acompaña la lectura en la Biblia **física**; NO muestra el texto bíblico adentro. No describas ninguna función como un lector de Escritura.
- Una función = un beneficio claro en 1–2 líneas.

## Reglas de diseño (importante — "lindo diseño")

Usa el **mismo lenguaje visual de la app** (está en `README.md`, sección Design Tokens). No inventes un estilo genérico:

- **Color:** fondo `#FBFBFA`, superficie `#FFFFFF`, texto `#1C1C1E`, suave `#8A8A8E`, hairline `#EAE8E3`. Acento sepia `#A88B6A` con tinte `rgba(168,139,106,0.13)`. **El acento es el único color** fuera de la escala de grises.
- **Modo oscuro automático** vía `prefers-color-scheme`: fondo `#000`, superficie `#1C1C1E`, texto `#F2F2F7`, acento `#C2A57E`. Tarjetas sin borde en oscuro (elevación por color).
- **Tipografía:** stack del sistema `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", system-ui`. Display 38px/600/-0.8px; título de pantalla 26px/700/-0.6px; tarjeta 18px/600; cuerpo 15–16px; etiquetas 13px/600 uppercase con `letter-spacing:0.6px`.
- **Forma:** radios 16px en tarjetas, 14px en botones; borde hairline 1px (claro), sin sombras; columna de lectura centrada ~660px que respira. Sin emojis como marcadores de sección.
- **Héroe:** una réplica de la pantalla "Hoy" (fecha uppercase → plan·día en acento → "Lectura de hoy" → referencias grandes → botones), porque es lo más característico del producto.

## Salida

1. Escribe la página en un archivo HTML autocontenido (todo el CSS inline en un `<style>`; sin `<!DOCTYPE>`, `<html>`, `<head>` ni `<body>` — el runtime de Artifact los envuelve). Guárdalo en el scratchpad de la sesión.
2. Antes de escribir el `<style>`, carga la skill `artifact-design`.
3. Publícala con la herramienta **Artifact** (favicon `📖`) y entrégame la URL compartible.
4. Muéstrame en el chat la lista de funciones incluidas para que confirme antes de dar por buena la guía.
