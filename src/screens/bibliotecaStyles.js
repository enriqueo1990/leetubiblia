import { dark } from './demoStyles.js'

// CSS propio de /biblioteca. Se suma a infoStyles.js (INFO_CSS: secciones, bento, «lo
// que no hacemos», FAQ, cierre) y al sistema de landingSystem.js. Todo lleva el
// prefijo `bb-`. Los colores salen de los tokens de la app; las tapas de los libros
// traen el color propio de cada material (materialTheme.js), igual que BookCover.jsx,
// y son la excepción deliberada a "un solo acento": viven solo en las portadas.
export const BIBLIOTECA_CSS = `
/* ── Tapa de un libro (BookCover de la app, en CSS) ──
   El tamaño de la letra sigue al ancho de la tapa (cqw): 160 px de ancho = los
   9 / 21 px de la tapa grande de la app. */
.bb-cover{--cw:160px; container-type:inline-size; position:relative; display:flex; width:100%; aspect-ratio:3/4; overflow:hidden;
  border-radius:6px 10px 10px 6px; background:var(--c); color:var(--ink);
  box-shadow:0 1px 2px rgba(0,0,0,.12), 0 8px 18px rgba(40,25,10,.14), var(--cover-ring)}
.bb-cover-sp{flex:none; width:9%; height:100%; background:var(--sp)}
.bb-cover::after{content:""; position:absolute; top:0; bottom:0; left:9%; width:1.5px; background:rgba(255,255,255,.12)}
.bb-cover-in{display:flex; flex:1; min-width:0; flex-direction:column; padding:14% 12% 11%}
.bb-cover-kind{font-weight:600; text-transform:uppercase; color:var(--acc); font-size:9px; letter-spacing:.18em; line-height:1.2}
.bb-cover-title{margin-top:auto; font-family:var(--lk-serif); font-weight:500; font-size:21px; line-height:1.06; letter-spacing:-.015em; text-wrap:balance; overflow-wrap:break-word}
@supports (width:1cqw){
  .bb-cover-kind{font-size:max(5.4cqw, 6.5px)}
  .bb-cover-title{font-size:13.1cqw}
}

/* ── Hero: cuatro tapas sobre una repisa ── */
.bb-h1{max-width:13ch}
.bb-hero-shelf{position:relative; display:flex; align-items:flex-end; justify-content:center; padding:24px 4px 24px; max-width:560px; justify-self:center; width:100%}
.bb-hero-shelf .bb-cover{flex:1 1 0; min-width:0; max-width:190px}
.bb-hero-shelf .bb-cover + .bb-cover{margin-left:clamp(-12px, -1.4vw, -4px)}
.bb-hero-shelf .bb-cover:nth-child(1){transform:rotate(-3deg) translateY(8px)}
.bb-hero-shelf .bb-cover:nth-child(2){transform:translateY(-14px)}
.bb-hero-shelf .bb-cover:nth-child(3){transform:rotate(1.6deg) translateY(2px)}
.bb-hero-shelf .bb-cover:nth-child(4){transform:rotate(-1.4deg) translateY(-6px)}
.bb-hero-shelf::after{content:""; position:absolute; left:0; right:0; bottom:8px; height:12px; border-radius:6px;
  background:linear-gradient(var(--surface), var(--surface-alt)); box-shadow:var(--shadow-card); z-index:-1}
@media (max-width:639px){ .bb-hero-shelf .bb-cover:nth-child(4){display:none} .bb-hero-shelf{margin-top:12px} }
@media (min-width:960px){ .bb-hero-shelf{justify-self:end; max-width:none; margin-right:calc(var(--lk-gutter) * -.5)} }

/* ── Para quién ── */
.bb-who{display:grid; gap:14px; margin-top:clamp(32px, 4vw, 52px)}
.bb-card{background:var(--surface); border-radius:24px; padding:26px 26px 24px; box-shadow:var(--shadow-card); display:flex; flex-direction:column; gap:0}
.bb-card h3{font:650 1.1875rem/1.25 var(--in-sans); letter-spacing:-.01em; margin-top:14px}
.bb-card p{margin-top:8px; font-size:var(--lk-fs-small); line-height:1.6; color:var(--text-soft); max-width:30em}
.bb-card-link{margin-top:auto; padding-top:14px; display:inline-flex; align-items:center; min-height:44px; font-size:var(--lk-fs-small)}
@media (min-width:860px){ .bb-who{grid-template-columns:repeat(3, 1fr); gap:16px} .bb-card{padding:30px 30px 26px} }

/* ── El lector: texto con leyenda | teléfono ── */
.bb-band{background:linear-gradient(var(--bg-app), color-mix(in srgb, var(--accent) 6%, var(--bg-app)) 16%, color-mix(in srgb, var(--accent) 6%, var(--bg-app)) 84%, var(--bg-app))}
.bb-reader{display:grid; gap:44px; align-items:center}
.bb-reader .lk-h2{margin-top:18px}
.bb-reader p.in-lede{margin-top:20px; max-width:30em}
.bb-legend{display:grid; gap:0; margin-top:clamp(24px, 3vw, 36px); max-width:34rem}
.bb-legend > li{display:grid; gap:4px; padding:16px 0; border-top:1px solid var(--hairline)}
.bb-legend > li:last-child{border-bottom:1px solid var(--hairline)}
.bb-legend b{font:650 1.0625rem/1.3 var(--in-sans); letter-spacing:-.005em}
.bb-legend > li > span{color:var(--text-soft); font-size:var(--lk-fs-small); line-height:1.55}
.bb-chips{margin-top:8px}
.bb-chips .in-chip{white-space:normal; line-height:1.25}
.bb-reader-demo{justify-self:center; width:100%}
.bb-demo-note{margin-top:14px; text-align:center; font-size:var(--lk-fs-micro); line-height:1.5; color:var(--text-soft)}
.bb-reader-demo .in-demo-cap{margin-top:18px}
@media (min-width:960px){ .bb-reader{grid-template-columns:1.05fr .95fr; gap:80px} }

/* ── Los diez libros: estantes por tradición ── */
.bb-shelves{margin-top:clamp(36px, 5vw, 64px); display:grid; gap:0}
.bb-shelf{display:grid; gap:22px; padding-block:clamp(26px, 3.4vw, 40px); border-top:1px solid var(--hairline)}
.bb-shelf:last-child{border-bottom:1px solid var(--hairline)}
.bb-shelf-head h3{margin:0}
.bb-shelf-head p{margin-top:8px; font-size:var(--lk-fs-small); line-height:1.5; color:var(--text-soft); max-width:21em}
.bb-books{display:grid; gap:20px}
.bb-book{display:grid; grid-template-columns:92px 1fr; gap:16px; align-items:start}
.bb-book .bb-cover{--cw:92px}
.bb-book-t h4{font:650 1.0625rem/1.3 var(--in-sans); letter-spacing:-.005em; margin:0}
.bb-book-m{margin-top:3px; font-size:var(--lk-fs-micro); font-weight:600; letter-spacing:.02em; color:var(--accent-ink)}
.bb-book-b{margin-top:8px; font-size:var(--lk-fs-small); line-height:1.55; color:var(--text-soft)}
.bb-note{margin-top:22px; max-width:46em}
@media (min-width:640px){
  .bb-books{grid-template-columns:repeat(auto-fill, minmax(176px, 1fr)); gap:28px 24px}
  .bb-book{grid-template-columns:1fr; gap:14px}
  .bb-book .bb-cover{max-width:176px}
}
@media (min-width:640px){
  .bb-solo .bb-books{grid-template-columns:1fr}
  .bb-solo .bb-book{grid-template-columns:176px minmax(0, 32em); gap:28px; align-items:end}
  .bb-solo .bb-book-b{font-size:1rem}
}
@media (min-width:960px){
  .bb-shelf{grid-template-columns:minmax(0, 250px) 1fr; gap:48px}
  .bb-shelf-head{position:sticky; top:calc(var(--lk-header-h) + 28px); align-self:start}
  .bb-books{grid-template-columns:repeat(4, minmax(0, 1fr))}
}

/* ── Cómo se usa: pasos | Hoy ── */
.bb-use{display:grid; gap:52px; align-items:center}
.bb-use .lk-h2{margin-top:18px}
.bb-steps{counter-reset:s; margin-top:clamp(28px, 3vw, 40px); display:grid}
.bb-steps li{position:relative; padding:0 0 26px 62px; counter-increment:s}
.bb-steps li::before{content:counter(s); position:absolute; left:0; top:-2px; width:44px; height:44px; border-radius:50%; background:var(--surface); box-shadow:var(--shadow-card); display:grid; place-items:center; font:450 1.5rem/1 var(--lk-serif); color:var(--accent-ink); z-index:1}
.bb-steps li::after{content:""; position:absolute; left:21px; top:44px; bottom:0; width:2px; background:linear-gradient(var(--accent), transparent); opacity:.5}
.bb-steps li:last-child::after{display:none}
.bb-steps b{display:block; font:600 1.125rem/1.3 var(--in-sans); letter-spacing:-.005em}
.bb-steps span{display:block; margin-top:4px; color:var(--text-soft); font-size:var(--lk-fs-small); line-height:1.55; max-width:30em}
.bb-extras{margin-top:clamp(12px, 2vw, 20px); padding:18px 20px; border-radius:20px; background:var(--surface); box-shadow:var(--shadow-card); display:grid; gap:10px; max-width:34rem}
.bb-extras li{display:flex; align-items:flex-start; gap:12px; font-size:var(--lk-fs-small); line-height:1.5; color:var(--text-soft)}
.bb-extras .in-ico{width:16px; height:16px; margin-top:.2em; color:var(--accent-ink)}
.bb-use-demo{justify-self:center; width:100%}
.bb-use-demo .in-demo-cap{margin-top:18px}
@media (min-width:960px){ .bb-use{grid-template-columns:1fr auto; gap:96px} .bb-use-demo{width:auto} }

${dark('.bb-cover', 'box-shadow:0 1px 2px rgba(0,0,0,.4), 0 8px 18px rgba(0,0,0,.4), var(--cover-ring)')}
${dark('.bb-hero-shelf::after', 'background:linear-gradient(var(--surface-alt), var(--surface))')}

@media (prefers-reduced-motion: reduce){
  .bb-hero-shelf .bb-cover{transition:none}
}
`
