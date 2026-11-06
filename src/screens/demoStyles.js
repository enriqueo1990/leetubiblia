// CSS de los demos de pantalla de las landings: el teléfono dibujado en HTML/CSS
// con datos de EJEMPLO. Lo usan TodayDemo (/info, interactivo) y landingDemos.jsx
// (/lideres y /ayuda, estáticos: Hoy, sala del grupo, pulso del líder, Orar ahora y
// la lista de Oración). Todo lleva el prefijo `in-` (el del demo original) y está en
// unidades --u (1 = 1 px de una pantalla de 390 de ancho), así que el teléfono escala
// sin tocar nada. Los colores salen de los tokens de la app vía --p-* (que en
// «Ver en noche» de TodayDemo se invierten).
//
// Cada página que monte un demo monta también <DemoStyle/> (landingDemos.jsx).
// Sin JS y con prefers-reduced-motion: los estáticos no se mueven; TodayDemo mueve
// solo lo que hay dentro de @media (prefers-reduced-motion: no-preference).

// Reglas que cambian en noche: el sistema en oscuro (sin forzar claro) o la clase .dark.
export const dark = (sel, decl) => {
  const sels = [].concat(sel)
  const auto = sels.map((x) => `:root:not(.light) ${x}`).join(', ')
  const forced = sels.map((x) => `:root.dark ${x}`).join(', ')
  return `@media (prefers-color-scheme: dark){${auto}{${decl}}}\n${forced}{${decl}}`
}

export const DEMO_CSS = `
/* ── TodayDemo: el teléfono, todo en unidades --u (1 = 1 px de una pantalla de 390) ── */
.in-demo{position:relative; justify-self:center; width:min(100%, 326px);
  --in-sans:-apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", system-ui, sans-serif; --in-bezel:#1B1D20;
  --in-shadow-lift:0 2px 4px rgba(28,28,30,.06), 0 18px 44px -12px rgba(43,108,176,.28);
  --p-seg:var(--segment-track); --p-segact:var(--segment-active);
  --p-bg:var(--bg-app); --p-surface:var(--surface); --p-alt:var(--surface-alt); --p-ink:var(--text-primary); --p-soft:var(--text-soft);
  --p-hair:var(--hairline); --p-control:var(--control-border); --p-accent:var(--accent); --p-shadow:var(--shadow-card); --p-sun:38%}
${dark('.in-demo', '--p-sun:12%; --in-bezel:#26292D; --in-shadow-lift:0 0 0 1px rgba(255,255,255,.07), 0 24px 60px -16px rgba(0,0,0,.7)')}
/* «Ver en noche / en claro»: el demo toma la paleta contraria a la de la página. */
.in-demo:has(.in-flipbox:checked){--p-bg:#131517; --p-surface:#1C1F22; --p-alt:#262A2E; --p-ink:#F1F1EE; --p-soft:#A4A8AD; --p-hair:#2C3136; --p-control:#6B7177; --p-accent:#8FBFEC; --p-sun:12%; --p-seg:#262A2E; --p-segact:#353A40; --p-shadow:0 0 0 1px rgba(255,255,255,.06)}
${dark('.in-demo:has(.in-flipbox:checked)', '--p-bg:#FAF8F4; --p-surface:#FFFFFF; --p-alt:#F6F3EE; --p-ink:#1F1B16; --p-soft:#5C564D; --p-hair:#E4DED5; --p-control:#8A8378; --p-accent:#5B9FDF; --p-sun:38%; --p-seg:#EFEBE4; --p-segact:#FFFFFF; --p-shadow:0 1px 2px rgba(28,28,30,.05), 0 6px 20px rgba(28,28,30,.06)')}
.in-phone{position:relative; border-radius:46px; padding:9px; background:var(--in-bezel);
  box-shadow:var(--in-shadow-lift), 0 0 0 1px rgba(255,255,255,.04) inset; transform:rotate(1.4deg)}
.in-phone::before{content:""; position:absolute; z-index:3; top:19px; left:50%; width:27%; height:24px; transform:translateX(-50%); border-radius:20px; background:#000}
.in-screen{container-type:inline-size; border-radius:38px; overflow:hidden; background:var(--p-bg); color:var(--p-ink); aspect-ratio:390/772; position:relative}
.in-sc{--u:calc(100cqw / 390); --p-ink-accent:color-mix(in srgb, var(--p-accent) 60%, var(--p-ink));
  height:100%; display:flex; flex-direction:column; font-family:var(--in-sans); font-size:calc(15*var(--u)); line-height:1.4; position:relative; isolation:isolate}
.in-sc::before{content:""; position:absolute; inset:0 0 auto 0; height:calc(300*var(--u)); z-index:-1;
  background:radial-gradient(90% 80% at 90% 0%, color-mix(in srgb, #FFDDA0 var(--p-sun), transparent), transparent 62%), radial-gradient(70% 60% at 0% 0%, color-mix(in srgb, var(--p-accent) 22%, transparent), transparent 62%)}
.in-sc p{margin:0}
.in-sc-status{height:calc(52*var(--u)); padding:calc(17*var(--u)) calc(30*var(--u)) 0; display:flex; justify-content:space-between; font-size:calc(14*var(--u)); font-weight:600; font-variant-numeric:tabular-nums}
.in-sc-status i{display:inline-block; width:calc(24*var(--u)); height:calc(11*var(--u)); border-radius:calc(3.5*var(--u)); border:calc(1.4*var(--u)) solid var(--p-ink); opacity:.8; position:relative; margin-top:calc(3*var(--u))}
.in-sc-status i::after{content:""; position:absolute; inset:calc(1.5*var(--u)); right:calc(5*var(--u)); background:var(--p-ink); border-radius:calc(1.5*var(--u))}
.in-sc-body{flex:1; padding:0 calc(16*var(--u)); display:flex; flex-direction:column; min-height:0}
.in-sc-greet{display:flex; justify-content:space-between; align-items:center; height:calc(36*var(--u)); font-size:calc(14*var(--u)); font-weight:500; color:var(--p-soft)}
.in-sc-greet svg{width:calc(19*var(--u)); height:calc(19*var(--u)); fill:none; stroke:currentColor; stroke-width:1.8; stroke-linecap:round}
.in-sc-card{background:var(--p-surface); border-radius:calc(18*var(--u)); box-shadow:var(--p-shadow); padding:calc(15*var(--u)) calc(16*var(--u)) calc(14*var(--u)); margin-top:calc(8*var(--u))}
.in-sc-plan{display:flex; align-items:center; gap:calc(4*var(--u)); font-size:calc(17*var(--u)); font-weight:600; line-height:1.25}
.in-sc-plan svg{width:calc(14*var(--u)); height:calc(14*var(--u)); fill:none; stroke:var(--p-soft); stroke-width:2.2; stroke-linecap:round; stroke-linejoin:round; opacity:.8}
.in-sc-dayrow{display:flex; justify-content:space-between; align-items:baseline; margin-top:calc(3*var(--u)); font-size:calc(13*var(--u)); color:var(--p-soft); font-variant-numeric:tabular-nums}
.in-sc-streak{font-weight:600; color:var(--p-soft); transition:color .4s}
.in-sc-streak .in-s-after{display:none}
.in-sc-prog{margin-top:calc(11*var(--u)); height:calc(2*var(--u)); border-radius:2px; background:var(--p-hair); overflow:hidden}
.in-sc-prog i{display:block; height:100%; width:3.8%; background:var(--p-accent); border-radius:2px; transition:width .7s var(--lk-ease)}
.in-sc-ref{margin-top:calc(14*var(--u)); font:450 calc(34*var(--u))/1.15 var(--lk-serif); letter-spacing:-.012em}
.in-sc-chips{display:flex; gap:calc(8*var(--u)); margin-top:calc(8*var(--u))}
.in-sc-chips b{min-width:calc(52*var(--u)); height:calc(46*var(--u)); display:grid; place-items:center; padding-inline:calc(8*var(--u)); border-radius:calc(14*var(--u));
  background:color-mix(in srgb, var(--p-accent) 15%, transparent); color:var(--p-ink-accent); font:450 calc(24*var(--u))/1 var(--lk-serif); font-variant-numeric:lining-nums}
.in-sc-hint{margin-top:calc(12*var(--u)); font-size:calc(12.5*var(--u)); line-height:1.5; color:var(--p-soft)}
.in-sc-swap{flex:1; min-height:0; display:grid; margin-top:calc(14*var(--u))}
.in-sc-swap > *{grid-area:1/1; min-height:0}
.in-sc-label{font-size:calc(11.5*var(--u)); font-weight:600; letter-spacing:.12em; text-transform:uppercase; color:var(--p-soft); padding-left:calc(2*var(--u)); margin-bottom:calc(7*var(--u))}
.in-sc-rows{background:var(--p-surface); border-radius:calc(16*var(--u)); box-shadow:var(--p-shadow); overflow:hidden}
.in-sc-row{display:flex; align-items:center; gap:calc(12*var(--u)); padding:calc(11*var(--u)) calc(14*var(--u)); min-height:calc(50*var(--u)); border-top:1px solid var(--p-hair); font-size:calc(15*var(--u)); line-height:1.25}
.in-sc-row:first-child{border-top:0}
.in-sc-row b{display:block; font-weight:600}
.in-sc-row small{display:block; margin-top:calc(1*var(--u)); font-size:calc(12.5*var(--u)); color:var(--p-soft)}
.in-sc-row .in-dot{width:calc(24*var(--u)); height:calc(24*var(--u)); border-radius:50%; flex:none; box-shadow:inset 0 0 0 calc(1.6*var(--u)) var(--p-control); display:grid; place-items:center}
.in-sc-row .in-dot.in-on{background:var(--accent-action); box-shadow:none}
.in-sc-row .in-dot svg{width:calc(13*var(--u)); height:calc(13*var(--u)); fill:none; stroke:#fff; stroke-width:3; stroke-linecap:round; stroke-linejoin:round}
.in-sc-row .in-chev{margin-left:auto; width:calc(14*var(--u)); height:calc(14*var(--u)); fill:none; stroke:var(--p-soft); stroke-width:2.2; stroke-linecap:round; stroke-linejoin:round; opacity:.7}
.in-sc-foot{text-align:center; margin-top:calc(11*var(--u)); font-size:calc(13.5*var(--u)); color:var(--p-soft)}
.in-sc-foot em{font:italic 450 calc(15*var(--u)) var(--lk-serif); color:var(--p-ink-accent)}
.in-sc-also .in-sc-row .in-ic{width:calc(32*var(--u)); height:calc(32*var(--u)); border-radius:calc(10*var(--u)); background:color-mix(in srgb, var(--hue-grupos) 20%, transparent); color:color-mix(in srgb, var(--hue-grupos) 60%, var(--p-ink)); display:grid; place-items:center; flex:none}
.in-sc-also .in-sc-row .in-ic.in-m{background:color-mix(in srgb, var(--p-accent) 18%, transparent); color:var(--p-ink-accent)}
.in-sc-also .in-sc-row .in-ic svg{width:calc(18*var(--u)); height:calc(18*var(--u)); fill:none; stroke:currentColor; stroke-width:1.9; stroke-linecap:round; stroke-linejoin:round}
.in-sc-bar{padding:calc(10*var(--u)) calc(16*var(--u)); position:relative}
.in-sc-bar::before{content:""; position:absolute; inset:calc(-24*var(--u)) 0 0 0; z-index:-1; background:linear-gradient(transparent, var(--p-bg) 55%)}
.in-btn-mark{display:grid; place-items:center; height:calc(54*var(--u)); border-radius:calc(16*var(--u)); font-size:calc(17*var(--u)); font-weight:600; cursor:pointer; user-select:none; -webkit-tap-highlight-color:transparent;
  background:var(--accent-action); color:#fff; transition:background-color .35s, color .35s, transform .15s var(--lk-ease)}
.in-btn-mark:active{transform:scale(.985)}
.in-btn-mark > span{grid-area:1/1; display:flex; align-items:center; gap:calc(8*var(--u))}
.in-btn-mark svg{width:calc(18*var(--u)); height:calc(18*var(--u)); fill:none; stroke:currentColor; stroke-width:2.6; stroke-linecap:round; stroke-linejoin:round}
.in-btn-mark .in-b-after path{stroke-dasharray:1; stroke-dashoffset:1}
.in-sc-tabs{display:flex; border-top:1px solid var(--p-hair); background:color-mix(in srgb, var(--p-bg) 88%, transparent); padding:calc(8*var(--u)) 0 calc(18*var(--u))}
.in-sc-tabs span{flex:1; display:flex; flex-direction:column; align-items:center; gap:calc(3*var(--u)); font-size:calc(10.5*var(--u)); font-weight:500; color:var(--p-soft)}
.in-sc-tabs svg{width:calc(24*var(--u)); height:calc(24*var(--u)); fill:none; stroke:currentColor; stroke-width:1.7; stroke-linecap:round; stroke-linejoin:round}
.in-sc-tabs .in-on{color:var(--p-ink-accent); font-weight:600}
.in-read{position:absolute; opacity:0; width:1px; height:1px; margin:0}

/* Los dos estados (antes / después de marcar) están siempre en el DOM; el inactivo
   se oculta con visibility para que ni el lector de pantalla lo lea. */
.in-sc-swap > *{transition:opacity .45s var(--lk-ease), transform .55s var(--lk-ease), visibility 0s linear 0s}
.in-sc-day{opacity:0; visibility:hidden; transform:translateY(calc(14*var(--u))); transition-delay:0s, 0s, .55s; pointer-events:none}
.in-btn-mark .in-b-before, .in-btn-mark .in-b-after{transition:opacity .25s, visibility 0s linear 0s}
.in-btn-mark .in-b-after{opacity:0; visibility:hidden; transition-delay:0s, .25s}
.in-screen:has(.in-read:checked) .in-s-before{display:none}
.in-screen:has(.in-read:checked) .in-s-after{display:inline}
.in-screen:has(.in-read:checked) .in-sc-streak{color:var(--p-ink-accent)}
.in-screen:has(.in-read:checked) .in-sc-prog i{width:7.7%}
.in-screen:has(.in-read:checked) .in-sc-day{opacity:1; visibility:visible; transform:none; transition-delay:0s; pointer-events:auto}
.in-screen:has(.in-read:checked) .in-sc-also{opacity:0; visibility:hidden; transform:translateY(calc(-8*var(--u))); transition-delay:0s, 0s, .55s; pointer-events:none}
.in-screen:has(.in-read:checked) .in-btn-mark{background:color-mix(in srgb, var(--p-accent) 18%, var(--p-surface)); color:var(--p-ink-accent)}
.in-screen:has(.in-read:checked) .in-b-before{opacity:0; visibility:hidden; transition-delay:0s, .25s}
.in-screen:has(.in-read:checked) .in-b-after{opacity:1; visibility:visible; transition-delay:0s, 0s}
.in-screen:has(.in-read:checked) .in-b-after path{animation:in-draw .5s .12s var(--lk-ease) forwards}
.in-screen:has(.in-read:focus-visible) .in-btn-mark{outline:2px solid var(--p-ink-accent); outline-offset:3px}
@keyframes in-draw{to{stroke-dashoffset:0}}

.in-demo-cap{margin-top:20px; display:flex; flex-wrap:wrap; justify-content:center; align-items:center; gap:8px 14px; font-size:var(--lk-fs-micro); line-height:1.4; color:var(--text-soft); text-align:center}
.in-flip{position:relative; display:inline-flex; align-items:center; gap:7px; min-height:44px; cursor:pointer; padding:0 14px; border-radius:99px; background:var(--surface); box-shadow:var(--shadow-card); font-weight:600; color:var(--text-primary)}
.in-flipbox{position:absolute; inset:0; width:100%; height:100%; margin:0; opacity:0; cursor:pointer}
.in-flip:has(.in-flipbox:focus-visible){outline:2px solid var(--accent-ink); outline-offset:2px}
.in-flip .in-ico{width:16px; height:16px}
.in-flip .in-l-dark, .in-flip .in-i-sun{display:none}
${dark(['.in-flip .in-l-dark', '.in-flip .in-i-sun'], 'display:inline')}
${dark(['.in-flip .in-l-light', '.in-flip .in-i-moon'], 'display:none')}
/* ── Demos estáticos: la misma pantalla, sin estado ── */
.in-demo.in-static{width:var(--demo-w, 340px); max-width:100%; margin-inline:auto}
.in-static .in-phone{transform:none}
.in-static .in-sc-body{overflow:hidden; position:relative}
.in-static .in-sc-body.in-fade{-webkit-mask-image:linear-gradient(#000 calc(100% - 46*var(--u)), transparent); mask-image:linear-gradient(#000 calc(100% - 46*var(--u)), transparent)}
.in-static .in-btn-mark{cursor:default}
.in-demo-fig{margin:0}
.in-sc h2, .in-sc h4{margin:0}
.in-demo-fig .in-demo-cap{flex-direction:column; gap:4px}
.in-demo-fig .in-demo-cap b{font-weight:500; color:var(--text-primary); max-width:26em}
.in-demo-fig .in-demo-cap span{color:var(--text-soft)}

/* Pantalla de Hoy: pasajes en la serif de la marca (libro en tinta, capítulo en acento) */
.in-sc-pass{margin-top:calc(12*var(--u))}
.in-sc-pass p{font:500 calc(31*var(--u))/1.2 var(--lk-serif); letter-spacing:-.01em; padding:calc(2*var(--u)) 0}
.in-sc-pass p span{color:var(--p-ink-accent)}
.in-sc-extras{margin-top:calc(14*var(--u))}
.in-sc-extras .in-sc-label{margin-bottom:calc(7*var(--u))}
.in-sc-grow{padding-block:calc(10*var(--u))}
.in-sc-grow b{display:flex; align-items:center; gap:calc(8*var(--u)); font-weight:400; font-size:calc(16*var(--u))}
.in-sc-grow b svg{width:calc(16*var(--u)); height:calc(16*var(--u)); fill:none; stroke:var(--p-soft); stroke-width:1.8; stroke-linecap:round; stroke-linejoin:round; flex:none}
.in-sc-grow small{padding-left:calc(24*var(--u))}
.in-sc-grow .in-sc-meta{margin-left:auto; flex:none; font-size:calc(13*var(--u)); color:var(--p-soft); font-variant-numeric:tabular-nums}
.in-sc-grow > span:first-child{flex:1; min-width:0}
.in-sc-grow .in-sc-meta + .in-chev{margin-left:calc(6*var(--u))}
.in-sc-mrow{padding:calc(12*var(--u)) calc(14*var(--u)); align-items:flex-start}
.in-sc-mrow > span:nth-child(2){flex:1; min-width:0}
.in-sc-mrow b{font-size:calc(15*var(--u)); line-height:1.3}
.in-sc-cover{flex:none; width:calc(40*var(--u)); height:calc(56*var(--u)); border-radius:calc(3*var(--u)) calc(7*var(--u)) calc(7*var(--u)) calc(3*var(--u)); background:#3B6A93; box-shadow:inset calc(3*var(--u)) 0 0 rgba(255,255,255,.18), 0 1px 3px rgba(28,28,30,.18)}
.in-sc-mbar{display:flex; align-items:center; gap:calc(10*var(--u)); margin-top:calc(8*var(--u))}
.in-sc-mbar i{display:block; flex:1; height:calc(3*var(--u)); border-radius:99px; background:var(--p-hair); position:relative; overflow:hidden}
.in-sc-mbar i::after{content:""; position:absolute; inset:0 auto 0 0; width:var(--w, 20%); background:var(--p-accent); border-radius:99px}
.in-sc-mbar em{font-style:normal; font-size:calc(12*var(--u)); color:var(--p-soft); font-variant-numeric:tabular-nums}

/* Detalle de grupo: cabecera, «Hoy» del grupo, plan y pedidos */
.in-sc-back{display:flex; align-items:center; height:calc(34*var(--u)); font-size:calc(14*var(--u)); font-weight:500; color:var(--p-ink-accent)}
.in-sc-back svg{width:calc(13*var(--u)); height:calc(13*var(--u)); fill:none; stroke:currentColor; stroke-width:2.4; stroke-linecap:round; stroke-linejoin:round; transform:scaleX(-1); margin-right:calc(3*var(--u))}
.in-sc-hd{display:flex; align-items:center; justify-content:space-between; gap:calc(10*var(--u)); margin-top:calc(6*var(--u))}
.in-sc-title{display:flex; align-items:center; gap:calc(6*var(--u)); min-width:0; font-size:calc(26*var(--u)); font-weight:700; letter-spacing:-.02em; line-height:1.15}
.in-sc-title span{white-space:nowrap; overflow:hidden; text-overflow:ellipsis}
.in-sc-title svg{flex:none; width:calc(16*var(--u)); height:calc(16*var(--u)); fill:none; stroke:var(--p-soft); stroke-width:1.8; stroke-linecap:round; stroke-linejoin:round; opacity:.55}
.in-sc-fab{flex:none; width:calc(44*var(--u)); height:calc(44*var(--u)); border-radius:50%; background:var(--accent-action); color:#fff; display:grid; place-items:center}
.in-sc-fab svg{width:calc(18*var(--u)); height:calc(18*var(--u)); fill:none; stroke:currentColor; stroke-width:1.9; stroke-linecap:round; stroke-linejoin:round}
.in-sc-meta2{margin-top:calc(6*var(--u)); font-size:calc(14*var(--u)); color:var(--p-soft)}
.in-sc-pulse{margin-top:calc(16*var(--u)); padding:calc(14*var(--u)) calc(16*var(--u)) calc(15*var(--u)); border-radius:calc(20*var(--u)); background:color-mix(in srgb, var(--p-accent) 15%, transparent); border:1px solid var(--p-accent)}
.in-sc-pulse .in-sc-sl{color:var(--p-ink-accent); padding:0}
.in-sc-pulse div{display:flex; align-items:center; gap:calc(10*var(--u)); margin-top:calc(10*var(--u)); font-size:calc(15*var(--u))}
.in-sc-pulse div svg{width:calc(18*var(--u)); height:calc(18*var(--u)); fill:none; stroke:var(--p-ink-accent); stroke-width:1.8; stroke-linecap:round; stroke-linejoin:round; flex:none}
.in-sc-pulse b{font-weight:700}
.in-sc-sec{display:flex; align-items:center; justify-content:space-between; gap:calc(8*var(--u)); margin-top:calc(18*var(--u)); min-height:calc(24*var(--u)); padding-inline:calc(4*var(--u))}
.in-sc-sl{font-size:calc(13*var(--u)); font-weight:600; letter-spacing:.03em; text-transform:uppercase; color:var(--p-soft); line-height:1.2}
.in-sc-act{display:inline-flex; align-items:center; gap:calc(3*var(--u)); font-size:calc(13*var(--u)); font-weight:500; color:var(--p-ink-accent); white-space:nowrap}
.in-sc-act svg{width:calc(15*var(--u)); height:calc(15*var(--u)); fill:none; stroke:currentColor; stroke-width:2; stroke-linecap:round; stroke-linejoin:round}
.in-sc-c{background:var(--p-surface); border-radius:calc(20*var(--u)); box-shadow:var(--p-shadow); margin-top:calc(6*var(--u))}
.in-sc-c:not(.in-sc-pad) > * + *{border-top:1px solid var(--p-hair)}
.in-sc-pad{padding:calc(14*var(--u)) calc(16*var(--u))}
.in-sc-pt{font-size:calc(16*var(--u)); font-weight:600; line-height:1.3}
.in-sc-ps{margin-top:calc(2*var(--u)); font-size:calc(13*var(--u)); color:var(--p-soft)}
.in-sc-ok{margin-top:calc(10*var(--u)); display:flex; align-items:center; gap:calc(6*var(--u)); font-size:calc(13*var(--u)); font-weight:600; color:var(--p-ink-accent)}
.in-sc-ok svg{width:calc(15*var(--u)); height:calc(15*var(--u)); fill:none; stroke:currentColor; stroke-width:2.2; stroke-linecap:round; stroke-linejoin:round; flex:none}
.in-sc-pr{padding:calc(13*var(--u)) calc(16*var(--u)) calc(12*var(--u))}
.in-sc-pd{margin-top:calc(2*var(--u)); font-size:calc(13*var(--u)); line-height:1.35; color:var(--p-soft); white-space:nowrap; overflow:hidden; text-overflow:ellipsis}
.in-sc-pf{display:flex; align-items:center; justify-content:space-between; gap:calc(8*var(--u)); margin-top:calc(8*var(--u)); font-size:calc(12*var(--u)); color:var(--p-soft)}
.in-sc-pf > span{display:flex; align-items:center; gap:calc(6*var(--u)); min-width:0; white-space:nowrap}
.in-sc-avs{display:inline-flex}
.in-sc-avs i{width:calc(22*var(--u)); height:calc(22*var(--u)); margin-left:calc(-8*var(--u)); border-radius:50%; border:2px solid var(--p-surface); box-sizing:border-box; display:grid; place-items:center; font:600 calc(8.5*var(--u))/1 var(--in-sans); font-style:normal; color:var(--p-ink-accent); background:color-mix(in srgb, var(--p-accent) 18%, var(--p-surface))}
.in-sc-avs i:first-child{margin-left:0}
.in-sc-pill{padding:calc(8*var(--u)) calc(14*var(--u)); border-radius:99px; background:color-mix(in srgb, var(--p-accent) 15%, transparent); color:var(--p-ink-accent); font-size:calc(13*var(--u)); font-weight:600; white-space:nowrap; line-height:1}
.in-sc-pill.in-on{display:inline-flex; align-items:center; gap:calc(4*var(--u)); background:none; padding-inline:0}
.in-sc-pill.in-on svg{width:calc(15*var(--u)); height:calc(15*var(--u)); fill:none; stroke:currentColor; stroke-width:2.2; stroke-linecap:round; stroke-linejoin:round}

.in-sc-mem{display:flex; align-items:center; gap:calc(12*var(--u)); padding:calc(10*var(--u)) calc(16*var(--u))}
.in-sc-mem .in-ava{flex:none; width:calc(40*var(--u)); height:calc(40*var(--u)); border-radius:50%; display:grid; place-items:center; font-size:calc(15*var(--u)); font-weight:600; color:var(--p-ink-accent); background:color-mix(in srgb, var(--p-accent) 15%, var(--p-surface))}
.in-sc-mem > span:nth-child(2){flex:1; min-width:0; font-size:calc(16*var(--u)); line-height:1.25}
.in-sc-mem small{display:block; margin-top:calc(1*var(--u)); font-size:calc(13*var(--u)); color:var(--p-soft)}
.in-sc-mem em{font-style:normal; color:var(--p-soft)}
.in-sc-chip{display:inline-flex; align-items:center; gap:calc(4*var(--u)); padding:calc(5*var(--u)) calc(10*var(--u)); border-radius:99px; background:color-mix(in srgb, var(--p-accent) 15%, transparent); color:var(--p-ink-accent); font-size:calc(12*var(--u)); font-weight:500; white-space:nowrap; line-height:1}
.in-sc-chip svg{width:calc(13*var(--u)); height:calc(13*var(--u)); fill:none; stroke:currentColor; stroke-width:2.2; stroke-linecap:round; stroke-linejoin:round}

/* Pulso del líder: resumen y semana, solo para quien lidera */
.in-sc-lock{display:flex; align-items:center; gap:calc(6*var(--u)); color:var(--p-soft)}
.in-sc-lock svg{width:calc(13*var(--u)); height:calc(13*var(--u)); fill:none; stroke:currentColor; stroke-width:1.9; stroke-linecap:round; stroke-linejoin:round; flex:none}
.in-sc-lock .in-sc-sl{padding:0}
.in-sc-stats{display:flex; gap:calc(8*var(--u)); margin-top:calc(14*var(--u))}
.in-sc-stats div{flex:1; min-width:0}
.in-sc-stats b{display:block; font-size:calc(30*var(--u)); font-weight:700; line-height:1.1; letter-spacing:-.02em; color:var(--p-ink-accent); font-variant-numeric:tabular-nums}
.in-sc-stats span{display:block; margin-top:calc(2*var(--u)); font-size:calc(12.5*var(--u)); line-height:1.25; color:var(--p-soft)}
.in-sc-meter{margin-top:calc(14*var(--u)); height:calc(8*var(--u)); border-radius:99px; background:var(--p-alt); overflow:hidden}
.in-sc-meter i{display:block; height:100%; width:40%; background:var(--p-accent)}
.in-sc-note{margin-top:calc(8*var(--u)); font-size:calc(12*var(--u)); line-height:1.4; color:var(--p-soft)}
.in-sc-week{margin-top:calc(14*var(--u)); display:grid; gap:calc(6*var(--u))}
.in-sc-week + .in-sc-note{margin-top:calc(12*var(--u))}
.in-sc-wr{display:flex; align-items:center; gap:calc(12*var(--u)); min-height:calc(22*var(--u)); font-size:calc(14*var(--u))}
.in-sc-wr > span:first-child{flex:1; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis}
.in-sc-wr em{font-style:normal; color:var(--p-soft)}
.in-sc-dots{display:flex; gap:calc(6*var(--u))}
.in-sc-dots i{display:grid; place-items:center; width:calc(18*var(--u)); height:calc(18*var(--u)); font:600 calc(10*var(--u))/1 var(--in-sans); font-style:normal; color:var(--p-soft)}
.in-sc-dots i.in-now{color:var(--p-ink-accent)}
.in-sc-dots i:empty::before{content:""; width:calc(10*var(--u)); height:calc(10*var(--u)); border-radius:50%; background:var(--p-alt); border:1px solid var(--p-hair); box-sizing:border-box}
.in-sc-dots i.in-r::before{background:var(--p-accent); border-color:transparent}

/* Orar ahora: una ficha por pedido, sin barra de pestañas (modo foco) */
.in-sc-ftop{display:flex; align-items:center; justify-content:space-between; height:calc(44*var(--u)); font-size:calc(12.5*var(--u)); color:var(--p-soft); font-variant-numeric:tabular-nums}
.in-sc-ftop svg{width:calc(22*var(--u)); height:calc(22*var(--u)); fill:none; stroke:currentColor; stroke-width:1.7; stroke-linecap:round}
.in-sc-prog2{width:calc(112*var(--u)); height:calc(6*var(--u)); margin:calc(2*var(--u)) auto 0; border-radius:99px; background:var(--p-alt); overflow:hidden}
.in-sc-prog2 i{display:block; height:100%; width:25%; border-radius:99px; background:var(--p-accent)}
.in-sc-focus{flex:1; min-height:0; display:flex; flex-direction:column; justify-content:center; gap:calc(10*var(--u)); padding-block:calc(14*var(--u))}
.in-sc-eb{text-align:center; font-size:calc(12*var(--u)); font-weight:600; letter-spacing:.04em; text-transform:uppercase; color:var(--p-ink-accent)}
.in-sc-ficha{background:var(--p-surface); border-radius:calc(20*var(--u)); box-shadow:var(--p-shadow); padding:calc(28*var(--u)) calc(24*var(--u)); text-align:center; display:flex; flex-direction:column; justify-content:center; gap:calc(16*var(--u)); min-height:calc(330*var(--u))}
.in-sc-ficha h4{font-size:calc(26*var(--u)); font-weight:700; line-height:1.15; letter-spacing:-.02em; margin:0}
.in-sc-ficha p.in-fd{font-size:calc(16.5*var(--u)); line-height:1.5}
.in-sc-news{margin:calc(2*var(--u)) auto 0; max-width:calc(300*var(--u)); padding-top:calc(16*var(--u)); position:relative}
.in-sc-news::before{content:""; position:absolute; top:0; left:50%; width:calc(48*var(--u)); height:1px; margin-left:calc(-24*var(--u)); background:var(--p-hair)}
.in-sc-news b{display:block; font-size:calc(11*var(--u)); font-weight:600; letter-spacing:.04em; text-transform:uppercase; color:var(--p-soft)}
.in-sc-news p{margin-top:calc(7*var(--u)); font-size:calc(14.5*var(--u)); line-height:1.5; color:var(--p-soft)}
.in-sc-news small{display:block; margin-top:calc(6*var(--u)); font-size:calc(12*var(--u)); color:var(--p-soft)}
.in-sc-fmeta{text-align:center; font-size:calc(13*var(--u)); color:var(--p-soft)}
.in-sc-bar.in-end{padding-bottom:calc(24*var(--u))}
.in-sc-skip{display:grid; place-items:center; height:calc(44*var(--u)); margin-top:calc(2*var(--u)); font-size:calc(15*var(--u)); font-weight:500; color:var(--p-soft)}

/* Oración: pedidos propios y respondidos */
.in-sc-ohd{display:flex; align-items:center; justify-content:space-between; min-height:calc(44*var(--u))}
.in-sc-ohd .in-sc-title{font-size:calc(26*var(--u))}
.in-sc-ohd i{display:grid; place-items:center; width:calc(44*var(--u)); height:calc(44*var(--u)); color:var(--p-ink-accent)}
.in-sc-ohd i svg{width:calc(20*var(--u)); height:calc(20*var(--u)); fill:none; stroke:currentColor; stroke-width:1.9; stroke-linecap:round}
.in-sc-orar{margin-top:calc(12*var(--u)); display:flex; align-items:center; justify-content:space-between; gap:calc(16*var(--u)); padding:calc(18*var(--u)) calc(20*var(--u)); border-radius:calc(20*var(--u)); background:color-mix(in srgb, var(--p-accent) 15%, transparent)}
.in-sc-orar b{display:block; font:500 calc(24*var(--u))/1.15 var(--lk-serif)}
.in-sc-orar small{display:block; margin-top:calc(4*var(--u)); font-size:calc(14*var(--u)); color:var(--p-soft)}
.in-sc-orar i{flex:none; display:grid; place-items:center; width:calc(56*var(--u)); height:calc(56*var(--u)); border-radius:50%; background:var(--accent-action); color:#fff}
.in-sc-orar i svg{width:calc(22*var(--u)); height:calc(22*var(--u)); fill:none; stroke:currentColor; stroke-width:1.8; stroke-linecap:round; stroke-linejoin:round}
.in-sc-seg{display:flex; margin-top:calc(16*var(--u)); padding:calc(4*var(--u)); border-radius:calc(14*var(--u)); background:var(--p-seg)}
.in-sc-seg span{flex:1; display:grid; place-items:center; height:calc(40*var(--u)); border-radius:calc(10*var(--u)); font-size:calc(15*var(--u)); font-weight:500; color:var(--p-soft)}
.in-sc-seg span.in-on{background:var(--p-segact); color:var(--p-ink); font-weight:600; box-shadow:var(--p-shadow)}
.in-sc-list{display:grid; gap:calc(10*var(--u)); margin-top:calc(14*var(--u))}
.in-sc-it{display:flex; align-items:center; justify-content:space-between; gap:calc(10*var(--u)); padding:calc(13*var(--u)) calc(16*var(--u)); background:var(--p-surface); border-radius:calc(20*var(--u)); box-shadow:var(--p-shadow)}
.in-sc-it > span:first-child{min-width:0}
.in-sc-it b{display:block; font-size:calc(16*var(--u)); font-weight:600; line-height:1.3; white-space:nowrap; overflow:hidden; text-overflow:ellipsis}
.in-sc-it small{display:block; font-size:calc(13*var(--u)); color:var(--p-soft)}
.in-sc-it em{display:block; margin-top:calc(1*var(--u)); font-style:normal; font-size:calc(12*var(--u)); font-weight:500; color:var(--p-ink-accent)}
.in-sc-it .in-side{display:flex; align-items:center; gap:calc(8*var(--u)); flex:none; color:var(--p-soft)}
.in-sc-it .in-side svg{width:calc(16*var(--u)); height:calc(16*var(--u)); fill:none; stroke:currentColor; stroke-width:1.7; stroke-linecap:round; stroke-linejoin:round}
.in-sc-it.in-dim b{color:var(--p-soft)}
.in-sc-it .in-tag{padding:calc(3*var(--u)) calc(8*var(--u)); border-radius:99px; background:color-mix(in srgb, var(--p-accent) 15%, transparent); color:var(--p-ink-accent); font-size:calc(12*var(--u)); font-weight:500}

/* Pares de demos (texto + teléfono): en escritorio, dos columnas con los teléfonos
   alineados por subgrid; en móvil, una columna (texto y luego el teléfono). */
.in-duo{display:grid; gap:clamp(56px, 7vw, 72px) 48px}
.in-duo-item{display:grid; justify-items:center; align-content:start; row-gap:28px}
.in-duo-text{max-width:30em; text-align:center}
.in-duo-text > p{margin-top:14px}
@media (min-width:900px){
  .in-duo{grid-template-columns:repeat(2, minmax(0, 1fr)); column-gap:clamp(40px, 6vw, 96px)}
  @supports (grid-template-rows: subgrid){
    .in-duo-item{grid-row:span 2; grid-template-rows:subgrid}
  }
}

/* Lector de un material (Biblioteca): la pregunta como ficha, pasajes como referencias */
.in-sc-rbar{display:flex; align-items:center; justify-content:space-between; min-height:calc(40*var(--u)); margin-top:calc(2*var(--u))}
.in-sc-ract{display:flex; align-items:center; gap:calc(14*var(--u)); font-size:calc(13*var(--u)); font-weight:500; color:var(--p-soft)}
.in-sc-ract svg{width:calc(16*var(--u)); height:calc(16*var(--u)); fill:none; stroke:currentColor; stroke-width:1.9; stroke-linecap:round; stroke-linejoin:round}
.in-sc-ract span{display:inline-flex; align-items:center; gap:calc(6*var(--u))}
.in-sc-rd{margin-top:calc(14*var(--u)); padding:calc(18*var(--u)) calc(18*var(--u)) calc(14*var(--u))}
.in-sc-rmeta{font-size:calc(13*var(--u)); font-weight:500; line-height:1.4; color:var(--p-soft)}
.in-sc-rq{margin-top:calc(10*var(--u)); font-size:calc(21*var(--u)); font-weight:600; line-height:1.28; letter-spacing:-.01em}
.in-sc-ra{margin-top:calc(14*var(--u)); font-size:calc(17*var(--u)); line-height:1.55}
.in-sc-rrefs{margin-top:calc(16*var(--u)); padding-top:calc(13*var(--u)); border-top:1px solid var(--p-hair); font-size:calc(15*var(--u)); line-height:1.75}
.in-sc-rref{color:var(--p-ink-accent); font-weight:500; white-space:nowrap}
.in-sc-rsep{color:var(--p-soft); opacity:.5}
.in-sc-rnav{display:flex; align-items:center; height:calc(40*var(--u)); font-size:calc(15*var(--u)); font-weight:500; color:var(--p-ink-accent)}

/* ── Movimiento: solo TodayDemo, y solo donde se admite ── */
@keyframes in-demo-enter{from{opacity:0; transform:translateY(14px)}}
@media (prefers-reduced-motion: no-preference){
  .in-demo:not(.in-static){animation:in-demo-enter 1s .12s var(--lk-ease) both}
  @supports (animation-timeline: scroll()){
    .in-demo:not(.in-static) .in-phone{animation:in-tilt linear both; animation-timeline:view(); animation-range:entry 0% exit 100%}
    @keyframes in-tilt{from{transform:translateY(24px) rotate(2.4deg)} 50%{transform:none rotate(1deg)} to{transform:translateY(-14px) rotate(-.2deg)}}
  }
}
@media (prefers-reduced-motion: reduce){
  .in-btn-mark .in-b-after path{stroke-dashoffset:0}
  .in-sc-swap > *, .in-btn-mark .in-b-before, .in-btn-mark .in-b-after{transition-duration:.01ms; transition-delay:0s}
}
`
