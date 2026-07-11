# Prompt — Reorganizar las páginas públicas de Lee Tu Biblia

> Pegá este prompt como tarea. Está pensado para ejecutarse dentro del repo
> `leetubiblia` con acceso a los archivos. Si lo usás en otra sesión, adjuntá
> este archivo como contexto.

---

## Tu rol

Actuás como un equipo de una sola persona con cuatro sombreros, y los usás en
este orden:

1. **Arquitecto de Información (IA)** — decidís qué páginas existen, qué rol
   cumple cada una y cómo se conectan. Sos el dueño del mapa.
2. **Product Designer (UX)** — traducís esa arquitectura a estructura de página:
   jerarquía, flujo, qué va primero, dónde bifurca por audiencia.
3. **UX Writer / Content Designer** — escribís cada palabra. Dos voces distintas
   según la intención: *orientar* (puerta) vs. *consultar* (ayuda) vs.
   *dar confianza* (legal).
4. **Front-end** — implementás en React sin romper el canon de diseño ni el
   sistema existente.

No saltes al código. Primero decidís la arquitectura, la validás, y recién
después escribís y construís.

## El producto (principios innegociables)

- **Lee Tu Biblia** es una PWA de lectura bíblica y oración. **Es gratis y no se
  vende nada.** La lógica NO es convertir/vender: es **orientar, acompañar y dar
  confianza pastoral.**
- **La app acompaña la Biblia FÍSICA, no la reemplaza.** El texto bíblico NUNCA
  se muestra dentro del producto ni en las páginas. Se muestran referencias, no
  versículos.
- **Todo es opt-in; nadie queda expuesto.** Ante un grupo solo se señala lo
  positivo. Este valor tiene que ser visible y coherente en todo el sitio.
- Público doble: el **lector individual** y el **líder/pastor** de grupo de
  discipulado.
- Español rioplatense (voseo), tal como ya están escritas las páginas actuales.

## Estado actual (lo que vas a reorganizar)

Cuatro páginas públicas, todas fuera del `Gate`, ruteadas por `pathname` en
`src/App.jsx` (líneas ~64–70). Comparten primitivos de marca y mocks en
`src/screens/landingKit.jsx`.

| Ruta | Archivo | Rol hoy |
|---|---|---|
| `/info` | `src/screens/Info.jsx` | Puerta principal en frío. Trae una sección de líderes embebida. |
| `/guia` | `src/screens/Guia.jsx` | Manual exhaustivo. Enlazado desde Ajustes. |
| `/grupos-de-discipulado` | `src/screens/GruposDiscipulado.jsx` | "Presentación" (pitch) para el líder. |
| `/guia-lideres` | `src/screens/GuiaLideres.jsx` | Recurso pastoral con capturas reales del producto. |

OG images en `public/og-*.png`; rutas en `public/sitemap.xml`.

### Problema diagnosticado

- **Al líder se le habla tres veces** (sección en `/info` + `/grupos-de-discipulado`
  + `/guia-lideres`). Hay redundancia y una voz de "pitch" que choca con el tono
  gratuito/pastoral.
- **El manual (`/guia`) está mal clasificado**: es referencia/ayuda, no
  captación.
- **Descubribilidad rota**: `/info` no enlaza a ninguna de las otras tres. No hay
  footer común que conecte el sitio.
- **No existe página de privacidad**, pese a que la app maneja cuentas, grupos y
  pedidos de oración (dato sensible) y se comparte por link a pastores.

## Arquitectura objetivo (hub y radios, plano — NO un árbol)

Una puerta y hermanas al mismo nivel, todas conectadas por un footer global.
Todo a un clic de la puerta.

```
/  (o /info)   ← LA PUERTA. Una sola.
│               qué es · para quién · gratis · cómo empiezo
│               + bifurcación honesta: "¿lideras un grupo?" → /lideres
│
├── /lideres      ← UNA página de líder (fusión de /grupos-de-discipulado
│                   + /guia-lideres: el "por qué / ritmo" con las capturas reales)
├── /ayuda        ← el actual /guia, reencuadrado como referencia
│                   (entra desde Ajustes y desde el footer, no es captación)
└── /privacidad   ← capa de confianza. NUEVA.

footer global en las 4 páginas  ← el tejido conectivo que hoy falta
```

Ejes que ordenan el contenido (usalos para decidir qué va dónde):
- **Audiencia:** lector individual · líder/pastor
- **Intención:** orientar (marketing) · consultar (ayuda) · dar confianza (legal)

## Canon de diseño (respetalo; no inventes un lenguaje nuevo)

- Un solo acento sepia como único color. La MISMA sans del sistema.
- Ancho de lectura acotado. Aire en vez de tarjetas flotantes.
- Reutilizá `landingKit.jsx` (Wordmark, Eyebrow, IconBadge, mocks, LandingStyle).
  Si necesitás un primitivo nuevo, agregalo al kit, no lo dupliques por página.
- Consistencia entre vistas: mismo header mínimo, mismo footer. Solo señalá la
  excepción cuando la haya.

## Método de trabajo (por fases, en este orden)

1. **Auditar.** Leé las cuatro páginas y `landingKit.jsx`. Listá cada bloque de
   contenido y etiquetalo por (audiencia × intención). Marcá duplicados.
2. **IA.** Confirmá o ajustá el mapa objetivo de arriba. Entregá el mapa final
   con: qué rutas quedan, qué se fusiona, qué se redirige (301), qué OG/sitemap
   cambia.
3. **Estructura (UX).** Para cada página resultante, definí el esqueleto de
   secciones (orden y jerarquía) antes de escribir. Especial atención a la
   **bifurcación por audiencia** en la puerta y al **footer global**.
4. **Copy (UX Writing).** Escribí el texto final de cada sección. Distinguí las
   voces: la puerta orienta y da ganas; la ayuda explica sin adornos; privacidad
   es clara y honesta. Nada de lenguaje de venta.
5. **Implementar.** React, reutilizando el kit. Actualizá `App.jsx` (rutas +
   redirects de las viejas), `sitemap.xml`, y las OG necesarias.
6. **Verificar.** Corré la app, navegá el sitio completo, comprobá que desde la
   puerta se llega en un clic a cada hermana y que el footer conecta todo.
   Revisá mobile y modo oscuro. Mostrá capturas.

## Entregables

- **Documento de arquitectura** (breve): mapa final, tabla de decisiones
  (mantener / fusionar / renombrar / crear / redirigir) y racional de cada una.
- **Páginas implementadas** según el mapa, con footer global y bifurcación.
- **`/privacidad`** nueva, redactada.
- **Redirects** de las rutas viejas a las nuevas y `sitemap.xml` actualizado.
- **Nota de verificación** con capturas del recorrido completo.

## Restricciones — qué NO hacer

- No mostrar texto bíblico. Solo referencias.
- No introducir un segundo color ni una tipografía nueva.
- No lenguaje de venta/urgencia ni métricas infladas.
- No dejar páginas huérfanas: si una ruta muere, redirige; no la borres a secas.
- No romper los enlaces existentes (`Ajustes → /guia`, etc.): actualizalos.
- No pedir permisos de datos nuevos ni prometer en `/privacidad` cosas que la app
  no cumple: verificá contra el comportamiento real antes de redactar.

## Criterios de aceptación

- Desde la puerta se alcanza **cualquier** otra página en un clic.
- Al líder se le habla **una sola vez**, con capturas reales y sin tono de pitch.
- El footer es idéntico en las cuatro páginas y las conecta todas.
- Existe `/privacidad` enlazada desde el footer, veraz respecto a la app.
- Las rutas viejas redirigen; no hay 404 ni enlaces rotos; el sitemap coincide.
- El canon de diseño se mantiene: un acento, la sans del sistema, aire, kit
  compartido.
