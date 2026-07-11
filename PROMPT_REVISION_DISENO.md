# Prompt — Revisión de diseño web de las páginas públicas

> Ejecutar dentro del repo `leetubiblia`. Objetivo: revisar como **diseñador web**
> cada página pública (`/info`, `/lideres`, `/ayuda`, `/privacidad`) y dejarlas
> impecables **con el nuevo header (2 filas con navegación) y el footer global**.
> No rediseñar de cero: pulir, alinear y armonizar dentro del canon existente.

## Rol y estándar

Actuás como **diseñador web / product designer** haciendo una pasada de *polish*
final. Criterio Apple-minimal ya establecido: un solo acento sepia, la misma sans
del sistema, aire en vez de tarjetas, ancho de lectura acotado. El texto bíblico
NUNCA se muestra. Todo gratis, tono pastoral, sin venta.

Cada decisión se juzga por: **¿esto se ve intencional y cohesivo, o accidental?**

## Contexto: header y footer nuevos (deben encajar perfecto)

- `LandingHeader` (en `landingKit.jsx`): 2 filas — (1) wordmark + botón "Abrir la
  app"; (2) nav de las 4 hermanas con la activa marcada. Divisor `border-t` entre
  filas. En móvil la nav hace scroll horizontal.
- `LandingFooter`: espeja la nav del header, centrado, con tagline.
- Ambos comparten `SITE_NAV` (una sola fuente de verdad).

## Checklist de revisión (aplicar a CADA página)

### 1. Alineación con el header/footer (PRIORITARIO)
- El **borde izquierdo** del primer bloque de contenido (hero o encabezado de
  documento) debe **alinear con el wordmark y la nav**. Hoy hay desajustes:
  el header es `max-w-[760px]` y algunos encabezados usan 820/720/880 → los
  bordes no coinciden. **Unificar**: el header/footer deben compartir el ancho
  de contenido dominante de cada página (usar un prop `width`), y el encabezado
  superior de cada página debe usar ese MISMO ancho. Verificar por medición que
  los bordes izquierdos coinciden.
- Ritmo vertical header → primer contenido: dar aire suficiente (no pegado al
  divisor de la nav). Consistente entre páginas del mismo tipo.
- Antes del footer: espacio de respiro suficiente; el footer no debe sentirse
  pegado a la última sección.

### 2. Jerarquía de acción
- El botón "Abrir la app" del header **no debe competir** con la CTA principal de
  la página (en `/info` había dos botones sepia sólidos iguales). El del header es
  **secundario**: estilo ghost/outline; la CTA in-content sigue siendo la sólida.

### 3. Tipografía y ritmo
- Escala de títulos coherente con el rol (hero grande en marketing; compacto en
  manual/documento). Interlínea, `text-wrap:balance`, medidas de lectura ≤ ~620.
- Espaciado vertical entre secciones consistente (no mezclar py-16/py-20/py-8 sin
  razón). Divisores `border-hairline` usados con criterio, sin dobles líneas.

### 4. Estados e interacción (accesibilidad)
- Enlaces de nav (header y footer) y CTAs: estado **hover** y **focus-visible**
  (anillo de foco visible para teclado). Contraste AA del texto activo sepia.
- Áreas táctiles cómodas en móvil.

### 5. Responsive
- Móvil (375px): sin scroll horizontal del body; header nav OK; heros y grillas
  reflow correcto; la tríada de capturas de `/lideres` no aprieta el texto.
- Verificar también un ancho intermedio (tablet).

### 6. Coherencia entre páginas
- Las 4 comparten sistema pero cada una conserva su firma (marketing / marketing
  con capturas / manual / documento). Que la diferencia se lea **intencional**.

## Método

1. Levantar el dev server y revisar cada página (desktop + móvil).
2. Anotar hallazgos por página con severidad.
3. Corregir en `landingKit.jsx` (header/footer/props) y en cada pantalla.
4. Verificar por medición (bordes izquierdos alineados, sin overflow) y con
   capturas. Reintentar capturas si el panel se cuelga.
5. Build de producción limpio, sin errores de consola, sin imports huérfanos.

## Restricciones

- No mostrar texto bíblico. No segundo color ni tipografía nueva.
- No romper los dos-columnas (grid de features + phone mock).
- No introducir dependencias. Mantener el kit como fuente única de header/footer.
- Cambios de ancho: cuidar no degradar la medida de lectura del texto interno.

## Criterios de aceptación

- Bordes izquierdos de header, contenido superior y footer **alineados** en cada
  página (verificado por medición).
- Header CTA secundario; una sola CTA sólida por vista.
- Hover + focus-visible en toda la navegación y CTAs.
- Sin overflow horizontal en móvil; tríada de `/lideres` respira.
- Ritmo vertical consistente; sin dobles divisores ni saltos raros.
- Build limpio; cero errores de consola.
