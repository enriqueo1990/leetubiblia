// Sistema visual de las landings («Marcapáginas · Luz de mañana»): tokens,
// tipografía, eyebrow con cinta, botones, resplandor y la cromática de
// header/footer. Es CSS plano en un string (sin dependencias) para que lo use el
// <style> que monta cada landing (landingKit › LandingStyle) y lo lean el build y
// los tests. Dirección y valores: landings-2027/E-direccion-creativa.md (sección b)
// y el prototipo landings-2027/prototipo-info.html.
//
// Reglas del sistema
//  - Los colores NO se inventan: salen de los tokens de la app (tokens.css), así que
//    acento, modo claro/noche y overrides (.light/.dark) funcionan solos.
//  - Newsreader («voz del libro») para títulos, frases y referencias; la sans del
//    sistema para todo lo funcional. La fuente es una subsetada y autoalojada que se
//    usa SOLO en las landings (public/fonts, ~81 KB roman + cursiva); la app sigue
//    registrando la suya con FontFace (lib/brandFont.js), con otro nombre de familia.
//  - Movimiento = mejora progresiva (@supports + prefers-reduced-motion).

// Archivos de la fuente (nombres con versión: son inmutables, ver public/_headers).
// El build (vite.config.js) precarga SOLO la roman: el H1 es roman.
export const LANDING_FONT_ROMAN = '/fonts/newsreader-roman-v1.woff2'
export const LANDING_FONT_ITALIC = '/fonts/newsreader-italic-v1.woff2'

export const SYSTEM_CSS = `
      /* ── Fuente: Newsreader subsetada (latín) + reserva con métricas ajustadas ── */
      @font-face {
        font-family: "Newsreader Landing";
        font-style: normal; font-weight: 400 500; font-display: swap;
        src: url(${LANDING_FONT_ROMAN}) format("woff2");
      }
      @font-face {
        font-family: "Newsreader Landing";
        font-style: italic; font-weight: 400 500; font-display: swap;
        src: url(${LANDING_FONT_ITALIC}) format("woff2");
      }
      /* Reserva: Georgia con métricas ajustadas para que el cambio de fuente no mueva
         nada. Anchos medidos en el navegador contra Newsreader (que cambia con el
         tamaño por su eje opsz): roman 0,92 (18 px) → 0,99 (80 px), cursiva 0,84 →
         0,91; se fija 97 % y 89 %, que son los del tramo de los títulos (44–80 px).
         Las alturas (ascent 73,5 % / descent 26,5 % de Newsreader, leídas del archivo)
         se dividen por size-adjust porque este también las escala. */
      @font-face {
        font-family: "Newsreader Landing Fallback";
        src: local("Georgia");
        size-adjust: 97%; ascent-override: 75.8%; descent-override: 27.3%; line-gap-override: 0%;
      }
      @font-face {
        font-family: "Newsreader Landing Fallback";
        font-style: italic;
        src: local("Georgia Italic"), local("Georgia-Italic");
        size-adjust: 89%; ascent-override: 82.6%; descent-override: 29.8%; line-gap-override: 0%;
      }

      /* ── Tokens del sistema (los colores vienen de tokens.css) ── */
      :root {
        --lk-serif: "Newsreader Landing", "Newsreader Landing Fallback", Georgia, "Times New Roman", serif;

        /* Escala (E › b.1): Newsreader = títulos; sans = lo funcional. */
        --lk-fs-display: clamp(2.75rem, 1.55rem + 5.3vw, 5rem);   /* H1 hero y cierre: 44 → 80 px */
        --lk-fs-h2: clamp(2rem, 1.35rem + 2.7vw, 3.5rem);          /* 32 → 56 px */
        --lk-fs-h3: clamp(1.5rem, 1.25rem + 1vw, 2rem);            /* frases / H3 */
        --lk-fs-h4: clamp(1.25rem, 1.1rem + .6vw, 1.5rem);         /* preguntas, subtítulos de detalle */
        --lk-fs-lede: clamp(1.125rem, 1.05rem + .35vw, 1.3125rem); /* 18 → 21 px */
        --lk-fs-body: 1.0625rem;                                   /* 17 px */
        --lk-fs-small: .9375rem;                                   /* 15 px */
        --lk-fs-micro: .8125rem;                                   /* 13 px */

        --lk-gutter: clamp(20px, 5vw, 48px);
        --lk-wrap: 1180px;
        --lk-header-h: 60px;
        --lk-ease: cubic-bezier(.22, .8, .26, 1);

        /* Luz de mañana: un hilo de sol cálido (solo claro) + resplandor de acento. */
        --lk-warm: rgba(255, 222, 160, .40);
        --lk-glow-a: 26%;
        --lk-glow-b: 14%;
        --lk-glass: color-mix(in srgb, var(--bg-app) 80%, transparent);
      }
      /* Noche = el mismo sitio apagado: el resplandor baja y el sol casi desaparece. */
      @media (prefers-color-scheme: dark) {
        :root:not(.light) { --lk-warm: rgba(214, 170, 110, .10); --lk-glow-a: 14%; --lk-glow-b: 8%; }
      }
      :root.dark { --lk-warm: rgba(214, 170, 110, .10); --lk-glow-a: 14%; --lk-glow-b: 8%; }

      html { scroll-padding-top: calc(var(--lk-header-h) + 16px); }

      /* ── Tipografía ── */
      .lk-serif, .lk-display, .lk-h2, .lk-h3, .lk-h4 {
        font-family: var(--lk-serif); font-weight: 450; font-optical-sizing: auto;
        color: var(--text-primary); text-wrap: balance;
      }
      .lk-display { font-size: var(--lk-fs-display); line-height: 1.02; letter-spacing: -.025em; }
      .lk-h2 { font-size: var(--lk-fs-h2); line-height: 1.06; letter-spacing: -.022em; }
      .lk-h3 { font-size: var(--lk-fs-h3); line-height: 1.15; letter-spacing: -.015em; }
      .lk-h4 { font-size: var(--lk-fs-h4); line-height: 1.25; letter-spacing: -.012em; }
      /* La cursiva es el énfasis y va en el acento entintado (AA). */
      .lk-serif em, .lk-display em, .lk-h2 em, .lk-h3 em, .lk-h4 em { font-style: italic; color: var(--accent-ink); }
      .lk-lede { font-size: var(--lk-fs-lede); line-height: 1.5; color: var(--text-soft); text-wrap: pretty; }
      .lk-body { font-size: var(--lk-fs-body); line-height: 1.6; text-wrap: pretty; }
      .lk-small { font-size: var(--lk-fs-small); line-height: 1.5; }
      .lk-micro { font-size: var(--lk-fs-micro); line-height: 1.5; color: var(--text-soft); }

      /* ── Contenedor ── */
      .lk-wrap {
        width: 100%; margin-inline: auto; padding-inline: var(--lk-gutter);
        max-width: calc(var(--lk-wrap) + 2 * var(--lk-gutter));
      }

      /* ── Eyebrow con cinta marcapáginas: la firma del sistema ── */
      .lk-eyebrow {
        display: inline-flex; align-items: center; gap: .6em;
        font-size: .8125rem; line-height: 1; font-weight: 600;
        letter-spacing: .14em; text-transform: uppercase; color: var(--accent-ink);
      }
      .lk-eyebrow::before {
        content: ""; width: 9px; height: 14px; flex: none; background: currentColor;
        clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 70%, 0 100%);
      }

      /* ── Botones ── */
      .lk-btn {
        display: inline-flex; align-items: center; justify-content: center; gap: .55em;
        min-height: 52px; padding: 0 28px; border-radius: 14px; border: 0;
        font-size: 1.0625rem; line-height: 1; font-weight: 600; text-decoration: none; cursor: pointer;
        transition: transform .15s var(--lk-ease), filter .15s, background-color .2s;
      }
      .lk-btn-primary {
        background: var(--accent-action); color: var(--on-accent);
        box-shadow: 0 1px 0 rgba(255, 255, 255, .18) inset, 0 8px 22px -8px rgba(43, 108, 176, .55);
      }
      .lk-btn-primary:hover { filter: brightness(1.06); }
      .lk-btn-primary:active { transform: translateY(1px); filter: brightness(.94); }
      .lk-btn-ghost { background: transparent; color: var(--text-primary); border: 1px solid var(--control-border); }
      .lk-btn-ghost:hover { background: var(--surface-alt); }
      .lk-btn-sm { min-height: 44px; padding: 0 18px; font-size: .9375rem; border-radius: 12px; white-space: nowrap; }
      .lk-btn-lg { min-height: 58px; padding: 0 38px; font-size: 1.1875rem; }
      .lk-textlink {
        font-weight: 600; color: var(--accent-ink); text-decoration: underline; text-underline-offset: .28em;
        text-decoration-thickness: 1.5px; text-decoration-color: color-mix(in srgb, var(--accent-ink) 35%, transparent);
      }
      .lk-textlink:hover { text-decoration-color: currentColor; }
      .lk-btn:focus-visible, .lk-textlink:focus-visible, .lk-hdr a:focus-visible, .lk-hdr summary:focus-visible,
      .lk-foot a:focus-visible, .lk-foot button:focus-visible {
        outline: 2px solid var(--accent-ink); outline-offset: 3px; border-radius: 8px;
      }

      /* ── Resplandor «luz de mañana» (primer hijo del wrapper, que lleva isolate) ── */
      .lk-glow {
        position: absolute; inset: 0 0 auto 0; height: 900px; z-index: -1; pointer-events: none;
        background:
          radial-gradient(46% 52% at 92% 6%, var(--lk-warm), transparent 70%),
          radial-gradient(62% 60% at 78% 22%, color-mix(in srgb, var(--accent) var(--lk-glow-a), transparent), transparent 72%),
          radial-gradient(52% 50% at 6% 0%, color-mix(in srgb, var(--accent) var(--lk-glow-b), transparent), transparent 70%);
        -webkit-mask-image: linear-gradient(#000 55%, transparent); mask-image: linear-gradient(#000 55%, transparent);
      }
      /* Páginas-documento (/ayuda, /privacidad): presencia, sin marketing. */
      .lk-glow-soft { height: 440px; opacity: .8; }
      /* Cierre: la luz sube desde abajo. Va en la <section> final (isolate + overflow-clip). */
      .lk-closing { position: relative; isolation: isolate; overflow: clip; }
      .lk-closing::before {
        content: ""; position: absolute; inset: auto 0 0 0; height: 560px; z-index: -1; pointer-events: none;
        background:
          radial-gradient(60% 70% at 50% 100%, color-mix(in srgb, var(--accent) var(--lk-glow-a), transparent), transparent 72%),
          radial-gradient(34% 40% at 82% 100%, var(--lk-warm), transparent 70%);
      }

      /* ── Header de UNA fila, sticky, de vidrio ── */
      .lk-skip {
        position: absolute; left: 12px; top: -64px; z-index: 100; padding: 10px 16px; border-radius: 10px;
        background: var(--accent-action); color: var(--on-accent); font-weight: 600; text-decoration: none;
      }
      .lk-skip:focus { top: 10px; }
      .lk-hdr {
        position: sticky; top: 0; z-index: 50; background: var(--lk-glass);
        -webkit-backdrop-filter: blur(16px) saturate(1.5); backdrop-filter: blur(16px) saturate(1.5);
      }
      .lk-hdr-in { height: var(--lk-header-h); display: flex; align-items: center; gap: 20px; }
      .lk-brand {
        display: inline-flex; align-items: center; gap: 10px; text-decoration: none; white-space: nowrap;
        font-size: 1.0625rem; line-height: 1; font-weight: 650; letter-spacing: -.01em; color: var(--text-primary);
      }
      .lk-brand-lg { gap: 12px; font-size: 1.25rem; }
      .lk-nav { display: none; margin-left: 12px; gap: 4px; }
      .lk-nav a {
        display: inline-flex; align-items: center; min-height: 44px; padding: 0 12px; border-radius: 10px;
        text-decoration: none; font-weight: 500; font-size: .9688rem; color: var(--text-soft);
        transition: color .15s, background-color .15s;
      }
      .lk-nav a:hover { color: var(--text-primary); background: var(--accent-tint); }
      .lk-nav a[aria-current] { color: var(--text-primary); font-weight: 600; }
      .lk-actions { margin-left: auto; display: flex; align-items: center; gap: 8px; }
      .lk-login {
        display: none; align-items: center; min-height: 44px; padding: 0 12px; text-decoration: none;
        font-weight: 600; font-size: .9688rem; color: var(--text-soft);
      }
      .lk-login:hover { color: var(--text-primary); }
      /* Menú móvil: <details> nativo (abre y cierra sin JS). El panel cuelga del header. */
      .lk-burger summary {
        list-style: none; cursor: pointer; width: 44px; height: 44px; display: grid; place-items: center;
        border-radius: 12px; color: var(--text-primary);
      }
      .lk-burger summary::-webkit-details-marker { display: none; }
      .lk-burger summary:hover { background: var(--accent-tint); }
      .lk-ico { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 1.9; stroke-linecap: round; stroke-linejoin: round; flex: none; }
      .lk-burger .lk-x { display: none; }
      .lk-burger[open] .lk-x { display: block; }
      .lk-burger[open] .lk-bars { display: none; }
      .lk-burger-panel {
        position: absolute; left: 0; right: 0; top: 100%; max-height: calc(100dvh - var(--lk-header-h)); overflow-y: auto;
        background: var(--bg-app); border-bottom: 1px solid var(--hairline);
        padding: 8px var(--lk-gutter) 20px; box-shadow: 0 24px 40px -20px rgba(0, 0, 0, .25);
      }
      .lk-burger-panel a {
        display: flex; align-items: center; justify-content: space-between; min-height: 52px; text-decoration: none;
        font-family: var(--lk-serif); font-weight: 500; font-size: 1.25rem; line-height: 1;
        color: var(--text-primary); border-bottom: 1px solid var(--hairline);
      }
      .lk-burger-panel a .lk-ico { width: 18px; height: 18px; color: var(--text-soft); }
      .lk-burger-panel a[aria-current] { color: var(--accent-ink); }
      .lk-burger-panel a.lk-menu-small { font-family: inherit; font-weight: 500; font-size: .9375rem; color: var(--text-soft); border-bottom: 0; }
      /* Cinta de progreso (2 px) y filete que aparece al bajar: solo con scroll-driven. */
      .lk-progress { position: absolute; left: 0; right: 0; bottom: 0; height: 2px; pointer-events: none; }
      .lk-progress i { display: block; height: 100%; background: var(--accent); transform-origin: 0 50%; transform: scaleX(0); }
      .lk-hdr::after { content: ""; position: absolute; inset: auto 0 0 0; height: 1px; background: var(--hairline); opacity: 0; pointer-events: none; }
      @media (min-width: 900px) {
        .lk-nav { display: flex; }
        .lk-login { display: inline-flex; }
        .lk-burger { display: none; }
        .lk-hdr-in { gap: 28px; }
      }

      /* ── Footer en columnas: App · Líderes · Proyecto · Legal ── */
      .lk-foot { border-top: 1px solid var(--hairline); background: var(--surface); padding-block: 56px 36px; }
      .lk-foot-grid { display: grid; gap: 28px 24px; }
      .lk-foot-nav { display: grid; gap: 28px 24px; grid-template-columns: 1fr 1fr; }
      .lk-foot-brand p { margin-top: 14px; max-width: 22em; font-size: var(--lk-fs-small); line-height: 1.55; color: var(--text-soft); }
      .lk-foot-h { margin-bottom: 10px; font-size: .75rem; line-height: 1; font-weight: 600; letter-spacing: .12em; text-transform: uppercase; color: var(--text-soft); }
      .lk-foot-list { list-style: none; margin: 0; padding: 0; }
      .lk-foot-list a, .lk-foot-list button {
        display: inline-flex; align-items: center; gap: 6px; min-height: 44px; padding: 0; border: 0; background: none; cursor: pointer;
        font: inherit; font-size: .9688rem; color: var(--text-primary); text-decoration: none;
      }
      .lk-foot-list a:hover, .lk-foot-list button:hover { color: var(--accent-ink); text-decoration: underline; }
      .lk-foot-list [aria-current] { font-weight: 600; color: var(--text-primary); }
      @media (min-width: 900px) {
        .lk-foot-grid { grid-template-columns: 1.5fr 4fr; gap: 24px; }
        .lk-foot-nav { grid-template-columns: repeat(4, 1fr); }
      }

      /* ── Movimiento: mejora progresiva; sin esto la página está completa ── */
      @media (prefers-reduced-motion: no-preference) {
        @supports (animation-timeline: scroll()) {
          .lk-progress i { animation: lk-grow linear both; animation-timeline: scroll(root); }
          .lk-hdr::after { animation: lk-hair linear both; animation-timeline: scroll(root); animation-range: 0 120px; }
          @keyframes lk-grow { to { transform: scaleX(1); } }
          @keyframes lk-hair { to { opacity: 1; } }
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .lk-btn, .lk-nav a { transition: none; }
      }
`
