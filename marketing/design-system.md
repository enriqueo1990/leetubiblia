# Design system de marketing — Lee Tu Biblia

Sistema visual para piezas de redes y promoción (carruseles, posteos únicos, stories).
Deriva del design system de la app ([src/styles/tokens.css](../src/styles/tokens.css), [tailwind.config.js](../tailwind.config.js)): las piezas de marketing deben verse como la app, no como publicidad genérica.

Primera pieza construida con este sistema: [carrusel-materiales/](carrusel-materiales/) (julio 2026).

## Principios

1. **La pieza se ve como la app.** Mismos colores, misma tipografía, mismos radios. Quien vio el posteo y abre la app tiene que sentir continuidad.
2. **Sereno, no estridente.** Fondo hueso, un solo acento, mucho aire. Nada de degradados llamativos, stickers ni tipografías decorativas.
3. **Mostrar, no prometer.** Siempre que se pueda, una maqueta de la pantalla real (Hoy, una ficha, un botón) vale más que un texto de marketing.
4. **La Biblia de papel es la protagonista.** Toda pieza que hable de contenido bíblico refuerza el principio: la app acompaña, no reemplaza.
5. **Voz de la app: voseo cercano.** "Activás", "Probalo", "Deslizá". Familiar y cálido, sin marcas de género cuando sea posible (coherente con el tono i18n del producto).

## Formatos

| Uso | Tamaño CSS | Export (2x) | Nota |
|---|---|---|---|
| Carrusel / feed IG+FB | 1080×1350 (4:5) | 2160×2700 | Formato por defecto |
| Post cuadrado | 1080×1080 | 2160×2160 | Solo si la red lo exige |
| Story / Reel cover | 1080×1920 (9:16) | 2160×3840 | Márgenes seguros: 200px arriba/abajo |

- Padding de lámina: **96px** en todos los lados (4:5). El contenido nunca lo invade.
- Ancho útil resultante: 888px.

## Color

Tomado 1:1 de los tokens de la app (modo claro):

| Rol | Hex | Uso en marketing |
|---|---|---|
| Fondo de lámina | `#F8F7F4` | Siempre. Nunca blanco puro ni fotos de fondo |
| Superficie (tarjetas) | `#FFFFFF` | Maquetas de la app, tarjetas de pasos |
| Tinta principal | `#1C1C1E` | Títulos |
| Tinta suave | `#56565C` | Cuerpo, subtítulos |
| Gris terciario | `#8B8983` | Metadata, numeración de lámina, notas al pie |
| Acento (marca) | `#A88B6A` | Logo, botones mock, barras de progreso, años |
| Acento tinta | `#705F4C` | Texto sobre fondo claro con voz de acento (kickers, citas, URL). Es `color-mix` 60% acento + 40% tinta — cumple AA donde el acento puro no |
| Tinte de acento | `rgba(168,139,106,0.13)` | Fondo de kickers, badges y contenedores de ícono |
| Hairline | `#D5D3CD` / `#E4E2DC` | Separadores de listas y de fichas |

Regla: **un solo acento por pieza** (el sepia de marca). Los 12 acentos alternativos de la app son para personalización del usuario, no para marketing.

## Tipografía

Sistema, igual que la app — no cargar webfonts:

```css
font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", system-ui, sans-serif;
```

Serif editorial **solo** para material histórico (años, preguntas de catecismo, citas de época):

```css
font-family: "Iowan Old Style", "Palatino", Georgia, serif;
```

Escala (en lámina 1080×1350; escalar proporcionalmente en otros formatos):

| Estilo | Tamaño / peso / tracking | Uso |
|---|---|---|
| Display portada | 104px / 650 / −2.8px | Solo lámina 1 |
| Título de lámina (`.h`) | 74px / 600 / −1.8px, line-height 1.08 | Un título por lámina |
| Lead (`.lead`) | 38px / 400, line-height 1.42, color tinta suave | Máx. 2–3 líneas; negritas en tinta principal |
| Cuerpo secundario | 33px / 400 | Bullets, pasos |
| Kicker | 26px / 600 / +2.5px, MAYÚSCULAS | Categoría de la lámina |
| Metadata / pie | 24–28px, gris terciario | Numeración, notas |

Reglas: números tabulares (`font-variant-numeric: tabular-nums`) en años, contadores y "N / 7". Antialiasing activado.

## Componentes

- **Kicker**: píldora con tinte de acento, texto acento-tinta en mayúsculas. Uno por lámina, arriba a la izquierda. Nombra la sección ("¿QUÉ SON?", "EL CATÁLOGO", "TU RITMO").
- **Numeración de lámina**: "N / T" arriba a la derecha, gris terciario, 26px. La portada no la lleva.
- **Tarjeta / maqueta de app**: fondo blanco, radio **28px**, sombra `0 2px 10px rgba(0,0,0,0.07), 0 0 2px rgba(0,0,0,0.04)`. Dentro: filas con ícono en contenedor de 78px con tinte de acento (radio 20px), título 33px semibold, subtítulo 27px suave, chevron `›` gris.
- **Botón mock**: píldora acento, texto blanco 36px semibold, sombra teñida `0 8px 22px rgba(168,139,106,0.35)`.
- **Chips de cita bíblica**: píldora blanca, borde 2px `#E4E2DC`, texto acento-tinta 31px.
- **Bloque de principio**: contenedor con tinte de acento al 10%, radio 28px, texto acento-tinta 36px. Para la frase de posicionamiento ("La app no reemplaza tu Biblia. La acompaña.").
- **Pasos numerados**: tarjetas blancas apiladas, círculo de 72px con tinte de acento y número acento-tinta.
- **Pie de marca**: logo 52px + "Lee Tu Biblia" 28px semibold tinta suave, abajo a la izquierda. En todas las láminas internas; portada y CTA usan el logo grande en su lugar.

## Logo

SVG inline (mismo trazo que `public/favicon.svg`): cuadrado redondeado `rx=14` relleno `#A88B6A`, libro abierto en trazo blanco `stroke-width 3`, extremos redondeados.

```html
<svg viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#A88B6A"/><path d="M32 20C28 16.7 22.2 16 12 16v28c10.2 0 16 .7 20 4 4-3.3 9.8-4 20-4V16c-10.2 0-16 .7-20 4Z" fill="none" stroke="#FFF" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M32 20v28" fill="none" stroke="#FFF" stroke-width="3" stroke-linecap="round"/></svg>
```

Tamaños: 176px (portada), 132px (CTA), 52px (pie de marca). En portada admite `drop-shadow(0 10px 26px rgba(168,139,106,0.35))`.

## Estructura narrativa de un carrusel

1. **Portada**: badge "NUEVO EN LEE TU BIBLIA" + título display + subtítulo + "Deslizá para conocerlos →".
2–3. **Qué es** y **qué incluye** (con maqueta o lista).
4–5. **Cómo se siente usarlo** (ficha o interacción real).
6. **El principio** (por qué existe, en bloque de principio).
7. **CTA**: logo, "Probalo hoy", 3 pasos, `leetubiblia.com` + "Gratis · funciona en tu navegador · es/en/pt".

Máximo 7 láminas. Cada lámina una sola idea y un solo título.

## Flujo de producción

1. Autorar la pieza como HTML autocontenido (una `.slide` de 1080×1350 por lámina, CSS en `<head>`), en una subcarpeta de `marketing/`.
2. Renderizar con Chrome headless a 2x:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
  --disable-gpu --hide-scrollbars --force-device-scale-factor=2 \
  --window-size=1080,1350 --screenshot=lamina-N.png "file://…/sN.html"
```

(Para láminas individuales desde un HTML multi-slide: inyectar `.slide{display:none!important}#sN{display:flex!important}` como hace el flujo de `carrusel-materiales/`.)

3. Verificar cada PNG visualmente antes de publicar (desbordes, cortes, tildes).
4. Acompañar siempre con un `textos.md`: caption principal, versión corta, alt text por lámina y hashtags. Alt text en el mismo idioma del posteo.

## Checklist antes de publicar

- [ ] Un solo acento (#A88B6A) en toda la pieza
- [ ] Fondo #F8F7F4, sin fotos de fondo ni degradados
- [ ] Voseo consistente ("Activás", no "Activa")
- [ ] Serif solo en material histórico
- [ ] Pie de marca en láminas internas, numeración N / T
- [ ] El principio "acompaña tu Biblia de papel" aparece al menos una vez
- [ ] Alt text escrito para cada lámina
- [ ] URL final: leetubiblia.com
