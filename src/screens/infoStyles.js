import { dark } from './demoStyles.js'

// CSS propio de /info («Marcapáginas · Luz de mañana»). Se suma al sistema común de
// landingSystem.js (tokens --lk-*, tipografía, botones, header/footer). Todo lo de
// esta página lleva el prefijo `in-`. Valores y estructura: prototipo-info.html.
//
// Los colores salen de los tokens de la app (tokens.css), así que acento, claro,
// noche y los overrides .light/.dark funcionan solos. Donde hace falta un valor
// distinto en noche se usa `dark()`, que cubre las dos formas de estar en noche:
// el sistema en oscuro (sin forzar claro) o la clase .dark.
//
// Movimiento = mejora progresiva (@supports + prefers-reduced-motion): sin él la
// página está completa. Todo lo interactivo (demo, pestañas, FAQ, selector de
// letra) funciona con checkboxes/radios/<details> nativos, sin JS.

export const INFO_CSS = `
/* ── Tokens propios de /info ── */
.in-page{
  --in-sans:-apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", system-ui, sans-serif;
  --in-faint:#DAD3C8;
  --in-tint-strong:color-mix(in srgb, var(--accent) 26%, transparent);
  --in-oracion-ink:color-mix(in srgb, var(--hue-oracion) 55%, var(--text-primary));
  --in-grupos-ink:color-mix(in srgb, var(--hue-grupos) 55%, var(--text-primary));
  overflow-x:clip;
}
${dark('.in-page', '--in-faint:#363B41; --in-tint-strong:color-mix(in srgb, var(--accent) 30%, transparent)')}
.in-main{font-size:var(--lk-fs-body); line-height:1.6}
.in-main p{text-wrap:pretty}
.in-main :where(h1,h2,h3){text-wrap:balance}
.in-main :where(b){font-weight:600}
.in-main :where(section){position:relative}
.in-main :where(ul,ol){list-style:none; margin:0; padding:0}
.in-ico{width:1.25em; height:1.25em; fill:none; stroke:currentColor; stroke-width:1.9; stroke-linecap:round; stroke-linejoin:round; flex:none}

/* ── Hero ── */
.in-hero{padding-block:clamp(24px, 5vw, 64px) 0; overflow-x:clip}
.in-hero-grid{display:grid; gap:28px; align-items:center}
.in-hero-h1{margin-top:clamp(14px,2vw,22px); max-width:11.5ch}
.in-hero-lede{margin-top:clamp(14px,2vw,22px); max-width:34em}
.in-hero-cta{display:flex; flex-wrap:wrap; align-items:center; gap:12px 22px; margin-top:clamp(20px,2.4vw,30px)}
.in-micro{margin-top:14px; font-size:var(--lk-fs-micro); line-height:1.5; color:var(--text-soft)}
.in-micro b{font-weight:600; color:var(--text-primary)}
.in-trust{display:none; flex-wrap:wrap; gap:6px 18px; margin-top:28px; padding-top:20px; border-top:1px solid var(--hairline); font-size:var(--lk-fs-micro); color:var(--text-soft)}
.in-trust span{display:inline-flex; align-items:center; gap:8px}
.in-trust span::before{content:""; width:5px; height:5px; border-radius:50%; background:var(--accent)}
@media (min-width:960px){
  .in-hero-grid{grid-template-columns:1.12fr .88fr; gap:56px}
  .in-trust{display:flex}
}

/* Las capturas en teléfono (PhoneShot) y los demos de /lideres y /ayuda: demoStyles.js y phoneShotStyles.js. */

/* ── Secciones ── */
.in-sec{padding-block:clamp(64px, 9vw, 120px)}
.in-sec-head{max-width:46rem}
.in-sec-head .lk-h2{margin-top:18px}
.in-sec-head p.in-lede{margin-top:20px; max-width:36em}
.in-sec-head.in-center{margin-inline:auto; text-align:center}
.in-sec-head.in-center .in-lede{margin-inline:auto}
.in-lede{font-size:var(--lk-fs-lede); line-height:1.55; color:var(--text-soft)}

/* — La idea — */
.in-idea{display:grid; gap:44px; align-items:center}
.in-idea .lk-h2{margin-top:18px}
.in-idea p.in-lede{margin-top:22px; max-width:32em}
.in-bible{position:relative; margin-inline:calc(var(--lk-gutter) * -.4)}
.in-bible svg{width:100%; height:auto; overflow:visible}
.in-bible-tag{position:absolute; top:-3%; left:53.2%; transform:translateX(-50%); white-space:nowrap; padding:10px 14px 11px; border-radius:14px; background:var(--surface); box-shadow:var(--shadow-card), 0 14px 30px -14px rgba(43,108,176,.35); font-size:.75rem; color:var(--text-soft); line-height:1.3}
.in-bible-tag b{display:block; font:450 1.125rem/1.15 var(--lk-serif); color:var(--text-primary); margin-top:2px}
.in-bible-tag b span{color:var(--accent-ink)}
.in-bible-tag::after{content:""; position:absolute; left:calc(50% - 1px); top:100%; height:clamp(28px, 7vw, 50px); border-left:2px dashed color-mix(in srgb, var(--accent) 70%, transparent)}
@media (min-width:960px){
  .in-idea{grid-template-columns:1.05fr .95fr; gap:72px}
  .in-bible{margin-inline:0}
}
.in-ribbon-sway{transform-origin:319px 118px}

/* — Cuatro gestos — */
.in-gestos{margin-top:clamp(56px, 7vw, 96px); border-top:1px solid var(--hairline); padding-top:clamp(40px, 5vw, 64px)}
.in-steps{display:grid; gap:0; margin-top:34px; counter-reset:g}
.in-steps li{position:relative; padding:0 0 30px 62px; counter-increment:g}
.in-steps li::before{content:counter(g); position:absolute; left:0; top:-2px; width:44px; height:44px; border-radius:50%; background:var(--surface); box-shadow:var(--shadow-card); display:grid; place-items:center; font:450 1.5rem/1 var(--lk-serif); color:var(--accent-ink); z-index:1}
.in-steps li::after{content:""; position:absolute; left:21px; top:44px; bottom:0; width:2px; background:linear-gradient(var(--accent), transparent); opacity:.5}
.in-steps li:last-child{padding-bottom:0}
.in-steps li:last-child::after{display:none}
.in-steps b{display:block; font:600 1.125rem/1.3 var(--in-sans); letter-spacing:-.005em}
.in-steps span{display:block; margin-top:4px; color:var(--text-soft); font-size:var(--lk-fs-small); line-height:1.55; max-width:26em}
@media (min-width:900px){
  .in-steps{grid-template-columns:repeat(4,1fr); gap:28px}
  .in-steps li{padding:62px 0 0 0}
  .in-steps li::before{top:0}
  .in-steps li::after{left:56px; right:-28px; top:21px; bottom:auto; width:auto; height:2px; background:linear-gradient(90deg, var(--accent), transparent)}
}

/* — Bento — */
.in-bento-sec{background:linear-gradient(var(--bg-app), color-mix(in srgb, var(--accent) 6%, var(--bg-app)) 18%, color-mix(in srgb, var(--accent) 6%, var(--bg-app)) 82%, var(--bg-app))}
.in-bento{display:grid; gap:12px; margin-top:clamp(36px, 5vw, 64px); grid-auto-flow:column; grid-auto-columns:84%;
  overflow-x:auto; scroll-snap-type:x mandatory; overscroll-behavior-x:contain; scrollbar-width:none;
  margin-inline:calc(var(--lk-gutter) * -1); padding:6px var(--lk-gutter) 22px; scroll-padding-inline:var(--lk-gutter)}
.in-bento::-webkit-scrollbar{display:none}
.in-bento:focus-visible{outline-offset:-4px}
.in-bento > .in-tile{scroll-snap-align:start}
.in-t-grupo{order:5}
.in-t-mat{order:6}
.in-t-medida{order:7}
.in-tile{position:relative; background:var(--surface); border-radius:24px; padding:26px 26px 24px; box-shadow:var(--shadow-card); overflow:hidden; display:flex; flex-direction:column; gap:18px; min-height:240px}
.in-tile h3{font:650 1.1875rem/1.25 var(--in-sans); letter-spacing:-.01em; margin-top:14px}
.in-tile p{margin-top:6px; font-size:var(--lk-fs-small); line-height:1.55; color:var(--text-soft); max-width:30em}
.in-tile .in-viz{margin-top:auto}
.in-tile-link{display:inline-flex; align-items:center; min-height:44px; margin-top:2px; font-size:var(--lk-fs-small)}
.in-k{font:600 .75rem/1 var(--in-sans); letter-spacing:.12em; text-transform:uppercase; color:var(--accent-ink); display:flex; align-items:center; gap:8px}
.in-k .in-ico{width:18px; height:18px}
.in-k.in-oracion{color:var(--in-oracion-ink)}
.in-k.in-grupos{color:var(--in-grupos-ink)}
@media (min-width:760px){
  .in-bento{display:grid; grid-auto-flow:row; grid-auto-columns:auto; overflow:visible; margin-inline:0; padding:0; grid-template-columns:repeat(6,1fr); gap:16px}
  .in-t-grupo, .in-t-mat, .in-t-medida{order:0}
  .in-t-plan{grid-column:span 4}
  .in-t-racha{grid-column:span 2}
  .in-t-camino, .in-t-oracion, .in-t-mat, .in-t-medida{grid-column:span 2}
  .in-t-grupo{grid-column:span 4}
  .in-tile{padding:30px 30px 28px}
}
.in-chips{display:flex; flex-wrap:wrap; gap:8px}
.in-chip{padding:8px 14px; border-radius:99px; background:var(--accent-tint); color:var(--accent-ink); font-size:.875rem; font-weight:600; line-height:1; white-space:nowrap}
.in-chip.in-n{background:var(--segment-track); color:var(--text-soft)}
.in-t-plan .in-chips{margin-top:auto}
.in-t-plan .in-big{font:450 clamp(3.5rem, 2.2rem + 5vw, 6rem)/.9 var(--lk-serif); letter-spacing:-.04em; color:var(--accent-ink); position:absolute; right:26px; top:14px; opacity:.9}
.in-week{display:flex; gap:8px; align-items:flex-end}
.in-week span{flex:1; display:flex; flex-direction:column; align-items:center; gap:8px; font-size:.75rem; font-weight:600; color:var(--text-soft)}
.in-week i{display:block; width:100%; max-width:34px; aspect-ratio:1; border-radius:50%; background:var(--accent-action)}
.in-week i.in-gap{background:transparent; box-shadow:inset 0 0 0 2px var(--in-faint)}
.in-week i.in-today{background:var(--accent-ink); box-shadow:0 0 0 4px var(--in-tint-strong)}
.in-note{background:var(--surface-alt); border-radius:16px; padding:16px 18px}
.in-note small{display:block; font-size:.75rem; font-weight:600; letter-spacing:.06em; text-transform:uppercase; color:var(--text-soft)}
.in-note q{display:block; quotes:none; margin-top:6px; font:italic 450 1.3125rem/1.3 var(--lk-serif); letter-spacing:-.005em}
.in-req{background:var(--surface-alt); border-radius:16px; padding:16px 18px; display:grid; gap:12px}
.in-req b{font-weight:600; line-height:1.35}
.in-req .in-row{display:flex; align-items:center; justify-content:space-between; gap:10px}
.in-pill{white-space:nowrap; display:inline-flex; align-items:center; gap:6px; padding:7px 13px; border-radius:99px; font-size:.8125rem; font-weight:700; line-height:1}
.in-hands{font-size:.8125rem; color:var(--text-soft); display:flex; align-items:center}
.in-hands i{width:24px; height:24px; border-radius:50%; margin-left:-7px; border:2px solid var(--surface-alt); display:grid; place-items:center; font:700 .625rem/1 var(--in-sans); color:#fff; font-style:normal}
.in-hands i:first-child{margin-left:0}
.in-hands span{margin-left:8px; white-space:nowrap}
.in-covers{display:flex; gap:10px}
.in-cover{flex:1; aspect-ratio:3/4.2; border-radius:6px 12px 12px 6px; padding:12px 10px; display:flex; flex-direction:column; justify-content:space-between; box-shadow:var(--shadow-card), inset 3px 0 0 rgba(255,255,255,.18); color:#fff; font:450 .9375rem/1.1 var(--lk-serif); letter-spacing:-.01em; min-width:0}
.in-cover small{font:600 .5625rem/1.2 var(--in-sans); letter-spacing:.1em; text-transform:uppercase; opacity:.8}
/* Los colores de las tapas de la app (materialTheme.js): Heidelberg, Westminster y las matutinas. */
.in-cover.in-a{background:#1F3B2D}
.in-cover.in-b{background:#1B2944}
.in-cover.in-c{background:#C27B2E; color:#2A1907}
.in-avatars{display:flex; align-items:center}
.in-avatars i{width:40px; height:40px; border-radius:50%; margin-left:-10px; border:3px solid var(--surface); display:grid; place-items:center; font:700 .8125rem/1 var(--in-sans); font-style:normal; color:#fff}
.in-avatars i:first-child{margin-left:0}
.in-avatars .in-more{background:var(--segment-track); color:var(--text-soft)}
.in-pulse{display:grid; gap:10px}
.in-pulse .in-head{display:flex; justify-content:space-between; align-items:baseline; gap:12px; font-size:.8125rem; color:var(--text-soft)}
.in-pulse .in-head b{font:600 1rem/1.2 var(--in-sans); color:var(--text-primary)}
.in-bar{height:8px; border-radius:99px; background:var(--segment-track); overflow:hidden}
.in-bar i{display:block; height:100%; width:75%; border-radius:99px; background:var(--hue-grupos)}
.in-t-grupo .in-split{display:grid; gap:26px; align-items:center; margin-block:auto}
.in-mini{display:grid; gap:10px; margin-top:8px}
.in-mini li{display:flex; align-items:center; gap:12px; padding:10px 12px; border-radius:14px; background:var(--surface-alt); font-size:.9375rem; font-weight:600; line-height:1.25}
.in-mini li .in-ico{width:20px; height:20px; color:var(--in-grupos-ink)}
.in-mini small{display:block; font-weight:400; font-size:.8125rem; color:var(--text-soft)}
@media (max-width:759px){ .in-cover{font-size:.8125rem; padding:10px 8px} .in-cover small{font-size:.5rem; letter-spacing:.06em} }
@media (min-width:560px){ .in-t-grupo .in-split{grid-template-columns:1fr 1fr} }
.in-size{display:grid; gap:14px}
.in-seg{display:inline-grid; grid-auto-flow:column; background:var(--segment-track); border-radius:12px; padding:3px; justify-self:start}
.in-seg label{position:relative; cursor:pointer}
.in-seg input{position:absolute; opacity:0; inset:0; width:100%; height:100%; margin:0; cursor:pointer}
.in-seg span{display:grid; place-items:center; min-width:48px; height:44px; padding-inline:8px; border-radius:9px; font-weight:600; color:var(--text-soft); transition:background-color .2s, color .2s}
.in-seg label:has(input:checked) span{background:var(--surface); color:var(--text-primary); box-shadow:var(--shadow-card)}
.in-seg label:has(input:focus-visible) span{outline:2px solid var(--accent-ink); outline-offset:2px}
.in-size-sample{font:450 1.0625rem/1.25 var(--lk-serif); transition:font-size .25s var(--lk-ease); background:var(--surface-alt); padding:12px 14px; border-radius:14px}
.in-size-sample b{color:var(--accent-ink); font-weight:inherit}
.in-t-medida:has(.in-sz2:checked) .in-size-sample{font-size:1.1875rem}
.in-t-medida:has(.in-sz3:checked) .in-size-sample{font-size:1.33rem}
.in-t-medida ul{display:grid; gap:6px; font-size:.875rem; color:var(--text-soft)}
.in-t-medida li{display:flex; gap:8px; align-items:center}
.in-t-medida li .in-ico{width:16px; height:16px; color:var(--accent-ink)}

/* — Lo que no hacemos + Quién — */
.in-nots{background:var(--surface); border-block:1px solid var(--hairline)}
.in-nots-grid{display:grid; gap:40px}
.in-nots .lk-h2{margin-top:18px}
.in-nots .in-sub{margin-top:20px; max-width:26em}
.in-nolist{display:grid}
.in-nolist li{display:grid; grid-template-columns:auto 1fr; column-gap:18px; padding:22px 0; border-top:1px solid var(--hairline)}
.in-nolist li:last-child{border-bottom:1px solid var(--hairline)}
.in-nolist .in-no{font:italic 450 1.0625rem/1.2 var(--lk-serif); color:var(--accent-ink); padding-top:.45em; min-width:1.6em}
.in-nolist h3{font:450 clamp(1.5rem, 1.2rem + 1.1vw, 2rem)/1.15 var(--lk-serif); letter-spacing:-.018em}
.in-nolist p{margin-top:6px; color:var(--text-soft); font-size:var(--lk-fs-small); line-height:1.55; max-width:30em}
@media (min-width:960px){
  .in-nots-grid{grid-template-columns:.8fr 1.2fr; gap:88px; align-items:start}
  .in-nots-head{position:sticky; top:calc(var(--lk-header-h) + 40px)}
}
.in-who{margin-top:clamp(40px, 5vw, 64px); display:grid; gap:22px; padding:26px; border-radius:24px; background:color-mix(in srgb, var(--accent) 8%, var(--bg-app)); border:1px solid var(--hairline); align-items:center}
.in-portrait{display:block; width:132px; aspect-ratio:4/5; border-radius:20px; overflow:hidden; border:3px solid color-mix(in srgb, var(--accent) 8%, var(--bg-app)); box-shadow:0 14px 30px -16px rgba(28,28,30,.35)}
.in-portrait img{display:block; width:100%; height:100%; object-fit:cover}
.in-who h3{font:450 clamp(1.5rem, 1.3rem + .8vw, 1.875rem)/1.2 var(--lk-serif); letter-spacing:-.015em}
.in-who p{margin-top:10px; color:var(--text-soft); max-width:38em}
.in-who p b{color:var(--text-primary); font-weight:600}
.in-who .in-links{display:flex; flex-wrap:wrap; gap:0 22px; margin-top:6px; font-size:var(--lk-fs-small)}
.in-who .in-links > *{display:inline-flex; align-items:center; gap:6px; min-height:44px}
.in-linkbtn{padding:0; border:0; background:none; cursor:pointer; font:inherit; font-weight:600}
@media (min-width:760px){
  .in-who{grid-template-columns:auto 1fr; gap:32px; padding:34px 38px}
  .in-portrait{width:168px}
}

/* — Líderes — */
.in-leaders{background:color-mix(in srgb, var(--hue-grupos) 9%, var(--bg-app)); overflow:clip}
.in-lead-grid{display:grid; gap:40px; align-items:center}
.in-leaders .lk-h2{margin-top:18px}
.in-leaders .lk-h2 em{color:var(--in-grupos-ink)}
.in-leaders p.in-lede{margin-top:20px; max-width:30em}
.in-lead-cta{display:flex; flex-wrap:wrap; align-items:center; gap:6px 24px; margin-top:32px}
.in-btn-grupos{background:#2F6F58; color:#fff; box-shadow:0 8px 22px -8px rgba(47,111,88,.55)}
.in-btn-grupos:hover{filter:brightness(1.08)}
${dark('.in-btn-grupos', 'background:#57B795; color:#0E2119')}
.in-textlink-grupos{color:var(--in-grupos-ink); text-decoration-color:color-mix(in srgb, var(--in-grupos-ink) 35%, transparent)}
.in-textlink-grupos:hover{text-decoration-color:currentColor}
.in-lead-link{display:inline-flex; align-items:center; min-height:44px}
.in-lcard{background:var(--surface); border-radius:24px; padding:10px 24px 22px; box-shadow:var(--shadow-card), 0 30px 60px -30px rgba(40,110,85,.35)}
.in-lcard-h{padding:16px 0 12px; font-size:.75rem; font-weight:600; letter-spacing:.12em; text-transform:uppercase; color:var(--in-grupos-ink)}
.in-lsteps{counter-reset:l}
.in-lsteps li{display:grid; grid-template-columns:auto 1fr; gap:4px 16px; padding:16px 0; border-top:1px solid var(--hairline); counter-increment:l}
.in-lsteps li::before{content:counter(l); grid-row:span 2; width:34px; height:34px; border-radius:50%; background:var(--hue-grupos); color:#fff; display:grid; place-items:center; font-size:.9375rem; font-weight:700}
${dark('.in-lsteps li::before', 'color:#10231b')}
.in-lsteps b{font:450 1.375rem/1.2 var(--lk-serif); letter-spacing:-.012em}
.in-lsteps span{color:var(--text-soft); font-size:var(--lk-fs-small); line-height:1.5}
.in-lcard-f{display:flex; gap:10px; margin-top:6px; padding:12px 14px; border-radius:14px; background:color-mix(in srgb, var(--hue-grupos) 12%, var(--surface)); font-size:.8125rem; line-height:1.5; color:var(--text-soft)}
.in-lcard-f .in-ico{color:var(--in-grupos-ink); margin-top:2px}
@media (min-width:960px){ .in-lead-grid{grid-template-columns:1fr 1fr; gap:80px} }

/* — Instalar — */
.in-install-grid{display:grid; gap:36px; align-items:start}
.in-install-grid .lk-h2{margin-top:18px}
.in-install-grid p.in-lede{margin-top:18px; max-width:30em}
.in-tabs{margin-top:28px}
.in-installnow{margin-bottom:22px}
.lk-install-note{padding:12px 16px; border-radius:14px; background:var(--accent-tint); font-size:var(--lk-fs-small); line-height:1.5}
.in-tab-labels{display:inline-grid; grid-auto-flow:column; background:var(--segment-track); padding:4px; border-radius:14px}
.in-tab{position:relative; display:flex; align-items:center; gap:8px; padding:0 22px; height:44px; border-radius:11px; font-weight:600; color:var(--text-soft); cursor:pointer; transition:background-color .2s, color .2s}
.in-tab input{position:absolute; opacity:0; inset:0; width:100%; height:100%; margin:0; cursor:pointer}
.in-tab:has(input:checked){background:var(--surface); color:var(--text-primary); box-shadow:var(--shadow-card)}
.in-tab:has(input:focus-visible){outline:2px solid var(--accent-ink); outline-offset:2px}
.in-here{padding:3px 8px; border-radius:99px; background:var(--accent-tint); color:var(--accent-ink); font-size:.6875rem; font-weight:600; letter-spacing:.02em; white-space:nowrap}
.in-panel{display:none; margin-top:26px}
.in-tabs:has(.in-tab-ios:checked) .in-p-ios, .in-tabs:has(.in-tab-and:checked) .in-p-and{display:block}
.in-isteps{display:grid; gap:18px; counter-reset:i}
.in-isteps li{display:grid; grid-template-columns:auto 1fr; gap:16px; counter-increment:i; align-items:start}
.in-isteps li::before{content:counter(i); width:34px; height:34px; border-radius:50%; background:var(--accent-action); color:var(--on-accent); display:grid; place-items:center; font-weight:700; font-size:.9375rem}
.in-isteps b{display:block; font-weight:600; line-height:1.35; padding-top:5px}
.in-isteps small{display:block; margin-top:3px; font-size:var(--lk-fs-small); line-height:1.5; color:var(--text-soft)}
.in-callout{margin-top:26px; padding:14px 16px; border-radius:16px; background:var(--accent-tint); font-size:var(--lk-fs-small); line-height:1.55; display:flex; gap:12px}
.in-callout .in-ico{color:var(--accent-ink); margin-top:2px}
.in-callout.in-here-now{box-shadow:inset 0 0 0 2px var(--accent)}
.in-icon-art{justify-self:center; width:min(100%, 360px); aspect-ratio:1.7; border-radius:36px; background:linear-gradient(160deg, color-mix(in srgb, var(--accent) 22%, var(--bg-app)), color-mix(in srgb, var(--accent) 6%, var(--bg-app))); display:grid; place-items:center; position:relative; box-shadow:var(--shadow-card)}
.in-icon-art .in-app{width:36%; aspect-ratio:1; border-radius:22.5%; overflow:hidden; box-shadow:0 18px 36px -12px rgba(43,108,176,.6), 0 1px 0 rgba(255,255,255,.2) inset}
.in-icon-art .in-app svg{width:100%; height:100%}
.in-icon-art .in-lab{position:absolute; bottom:12%; font-size:.8125rem; font-weight:600; color:var(--text-primary)}
.in-icon-art .in-grid{position:absolute; inset:14% 12% auto 12%; display:grid; grid-template-columns:repeat(4,1fr); gap:12%; opacity:.55}
.in-icon-art .in-grid i{aspect-ratio:1; border-radius:22%; background:color-mix(in srgb, var(--text-primary) 9%, transparent)}
@media (min-width:960px){
  .in-install-grid{grid-template-columns:1fr 1fr; gap:88px; align-items:center}
  .in-icon-art{aspect-ratio:1}
}

/* — FAQ — */
.in-faq{max-width:50rem; margin-inline:auto; margin-top:clamp(36px, 5vw, 56px)}
.in-faq details{border-top:1px solid var(--hairline)}
.in-faq details:last-child{border-bottom:1px solid var(--hairline)}
.in-faq summary{list-style:none; cursor:pointer; display:flex; align-items:center; justify-content:space-between; gap:20px; min-height:64px; padding:14px 2px; font:450 clamp(1.25rem, 1.1rem + .6vw, 1.5rem)/1.25 var(--lk-serif); letter-spacing:-.012em}
.in-faq summary::-webkit-details-marker{display:none}
.in-faq summary .in-pm{flex:none; width:32px; height:32px; border-radius:50%; background:var(--accent-tint); color:var(--accent-ink); display:grid; place-items:center; transition:transform .3s var(--lk-ease), background-color .2s}
.in-faq summary:hover .in-pm{background:var(--in-tint-strong)}
.in-faq details[open] .in-pm{transform:rotate(45deg)}
.in-faq .in-ans{padding:0 2px 24px; color:var(--text-soft); max-width:40em; line-height:1.65}
@supports (interpolate-size: allow-keywords){
  .in-faq{interpolate-size:allow-keywords}
  .in-faq details::details-content{block-size:0; overflow:clip; transition:block-size .35s var(--lk-ease), content-visibility .35s allow-discrete}
  .in-faq details[open]::details-content{block-size:auto}
}

/* — Cierre — */
.in-closing-in{text-align:center; padding-block:clamp(84px, 12vw, 160px)}
.in-closing-in .lk-display{max-width:12ch; margin-inline:auto}
.in-closing-in p.in-lede{margin:22px auto 0; max-width:30em; line-height:1.5}
.in-closing-in .lk-btn{margin-top:34px}
.in-closing-in .in-micro{margin-top:16px}

/* ── Movimiento: mejora progresiva ── */
@media (prefers-reduced-motion: no-preference){
  html{scroll-behavior:smooth}
  @supports (animation-timeline: scroll()){
    .in-rv{animation:in-rise linear both; animation-timeline:view(); animation-range:entry 0% entry 42%}
    @keyframes in-rise{from{opacity:0; transform:translateY(26px)} to{opacity:1; transform:none}}
    .in-rv-2{animation-range:entry 6% entry 48%}
    .in-rv-3{animation-range:entry 12% entry 54%}
    .in-ribbon-sway{animation:in-sway linear both; animation-timeline:view(); animation-range:entry 10% cover 55%}
    @keyframes in-sway{from{transform:translateY(-34px) scaleY(.7); opacity:0} to{transform:none; opacity:1}}
  }
  .in-enter{animation:in-enter .8s var(--lk-ease) both}
  .in-enter-2{animation-delay:.08s}
  .in-enter-3{animation-delay:.16s}
  .in-enter-4{animation-delay:.22s}
  .in-enter-5{animation-delay:.3s}
  @keyframes in-enter{from{opacity:0; transform:translateY(14px)}}
}
@media (prefers-reduced-motion: reduce){
  html{scroll-behavior:auto}
}
`
