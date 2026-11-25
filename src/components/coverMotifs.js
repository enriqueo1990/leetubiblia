// Los emblemas de las tapas: un sello por obra, alusivo a su historia o a su
// contenido. Todos se dibujan en la misma caja (120×120), dentro del mismo
// medallón de doble aro, con tres tintas del mismo color: `main` (el trazo
// principal), `thin` (el sombreado fino, como de grabado) y `fill` (los pocos
// detalles macizos). BookCover los pinta con el acento de cada material.

const f = (n) => Math.round(n * 10) / 10
const polar = (cx, cy, r, deg) => [f(cx + r * Math.cos((deg * Math.PI) / 180)), f(cy + r * Math.sin((deg * Math.PI) / 180))]

function circle(cx, cy, r) {
  return `M${f(cx - r)} ${cy}a${r} ${r} 0 1 0 ${f(2 * r)} 0a${r} ${r} 0 1 0 ${f(-2 * r)} 0z`
}

// Rayos: segmentos radiales entre r1 y r2, uno por ángulo (0° = derecha, -90° = arriba).
function rays(cx, cy, r1, r2, angles) {
  return angles.map((a) => `M${polar(cx, cy, r1, a).join(' ')}L${polar(cx, cy, r2, a).join(' ')}`).join('')
}

const range = (from, to, step) => Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step)

// Estrella de cuatro puntas (maciza).
function star(cx, cy, s) {
  const k = s * 0.16
  return `M${cx} ${f(cy - s)}Q${f(cx + k)} ${f(cy - k)} ${f(cx + s)} ${cy}Q${f(cx + k)} ${f(cy + k)} ${cx} ${f(cy + s)}Q${f(cx - k)} ${f(cy + k)} ${f(cx - s)} ${cy}Q${f(cx - k)} ${f(cy - k)} ${cx} ${f(cy - s)}z`
}

// Rosa de cinco pétalos: el contorno exterior de cinco círculos en ronda.
function rose(cx, cy, d, r) {
  const c = range(0, 4, 1).map((k) => polar(cx, cy, d, -90 + 72 * k))
  const cut = (a, b) => {
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const D = Math.hypot(dx, dy)
    const h = Math.sqrt(r * r - (D / 2) ** 2)
    const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
    const p = [m[0] - (dy / D) * h, m[1] + (dx / D) * h]
    const q = [m[0] + (dy / D) * h, m[1] - (dx / D) * h]
    const far = (v) => Math.hypot(v[0] - cx, v[1] - cy)
    return far(p) > far(q) ? p : q
  }
  const pts = c.map((_, k) => cut(c[(k + 4) % 5], c[k]))
  return `M${f(pts[0][0])} ${f(pts[0][1])}${pts.map((_, k) => `A${r} ${r} 0 1 1 ${f(pts[(k + 1) % 5][0])} ${f(pts[(k + 1) % 5][1])}`).join('')}z`
}

// Olas: una hilera de crestas de 10 de ancho.
const waves = (x, y, n) => `M${x} ${y}q5-5 10 0${'t10 0'.repeat(n - 1)}`

// El medallón: doble aro, igual en todas las tapas.
export const RING = { main: circle(60, 60, 56), thin: circle(60, 60, 52.5) }

const templeColumns = [33, 43.8, 54.6, 65.4, 76.2, 87]

export const MOTIFS = {
  // Lecturas matutinas: el sol que nace sobre el agua.
  sunrise: {
    main: `M14 74H106M38 74a22 22 0 0 1 44 0${rays(60, 74, 28, 38, [-160, -120, -90, -60, -20])}`,
    thin: `M44 74a16 16 0 0 1 32 0${rays(60, 74, 28, 33, [-140, -105, -75, -40])}M28 81H92M38 88H82M48 95H72M22 81h2M96 81h2M30 88h3M87 88h3`,
  },
  // Lecturas vespertinas: la luna creciente entre estrellas, sobre las nubes.
  moon: {
    main: 'M68 28A27 27 0 1 0 88 72A29 29 0 0 1 68 28zM26 92H56M64 92h10M40 99H84',
    thin: 'M60 38A22 22 0 0 0 74 77M20 86h14M82 86h16M52 105h18',
    fill: `${star(34, 40, 6)}${star(90, 38, 4.5)}${star(26, 64, 3)}${star(96, 58, 2.5)}${star(48, 24, 2.5)}`,
  },
  // Didajé: "hay dos caminos, uno de la vida y otro de la muerte".
  twoWays: {
    main: `M48 106C51 92 54 80 52 68C48 54 38 42 24 34M72 106C69 92 66 80 68 68C72 54 82 42 96 34M60 62C56 51 47 40 35 29M60 62C64 51 73 40 85 29M20 70a9 9 0 0 1 18 0M96 52A9.5 9.5 0 1 0 100 68A8 8 0 0 1 96 52z`,
    thin: `M60 102v-7M60 89v-6M60 78v-5${rays(29, 70, 12, 16, [-160, -125, -90, -55, -20])}M12 70H46M74 70H108M18 78h24M78 78h24M26 86h18M76 86h18`,
    fill: `${star(84, 46, 2.6)}${star(100, 40, 2)}`,
  },
  // Credos de la iglesia antigua: el crismón (ji-ro) entre alfa y omega.
  chiRho: {
    main: 'M60 20V100M60 20h7a11.5 11.5 0 0 1 0 23h-7M40 46L80 94M80 46L40 94M20 80l8-21 8 21M23 72h10M84 80h5a9.5 9.5 0 1 1 7 0h5',
    thin: 'M64 47V100M67 24.5a7 7 0 0 1 0 14M55 100h14M36 46h8M76 46h8M36 94h8M76 94h8M17 80h6M33 80h6',
  },
  // Confesiones: el corazón encendido y traspasado de Agustín.
  flamingHeart: {
    main: 'M60 98C36 82 26 66 34 52C40 42 54 44 60 56C66 44 80 42 86 52C94 66 84 82 60 98zM60 50C51 42 56 32 60 18C64 32 69 42 60 50zM49 45C43 39 45 31 50 24C50 31 55 37 53 44M71 45C77 39 75 31 70 24C70 31 65 37 67 44M16 88L33 79M87 51L104 42M104 42l-8 0M104 42l-3 7M16 88l1-7M16 88l7 2',
    thin: 'M80 54C86 64 80 76 66 88M74 55C79 64 75 73 64 82M60 44C58 38 59 32 60 27M40 54C36 60 38 66 42 72M21 85.5l1-6M21 85.5l6 2',
  },
  // Lutero: la rosa de Lutero (la cruz en el corazón, el corazón en la rosa).
  lutherRose: {
    main: `${rose(60, 61, 21, 17)}M60 78C47 69 43 61 47 54C50 49 57 50 60 56C63 50 70 49 73 54C77 61 73 69 60 78zM60 55.5V70M54.5 60.5H65.5`,
    thin: range(0, 4, 1)
      .map((k) => {
        const a = -90 + 72 * k
        return `${rays(60, 61, 23, 34, [a])}${rays(60, 61, 25, 32, [a - 14, a + 14])}${rays(60, 61, 27, 31, [a - 27, a + 27])}`
      })
      .join(''),
  },
  // Confesión Belga: el muro del castillo de Tournai, por donde Guido de Brès
  // arrojó la confesión en 1561.
  castle: {
    main: 'M46 92V44H43V36H49V40H55V36H65V40H71V36H77V44H74V92M22 92V56H27V60H32V56H37V60H42V56H46M98 92V56H93V60H88V56H83V60H78V56H74M19 92H101M54 92V78a6 6 0 0 1 12 0V92M60 50v8M60 36V20l10 4-10 4',
    thin: 'M57 92V73M60 92V72M63 92V73M54 80h12M54 86h12M26 68h6M34 74h6M26 80h6M36 86h6M88 68h6M80 74h6M88 80h6M78 86h6M49 64h6M65 68h6M50 72h4M66 76h4M26 98H94M36 103H84',
  },
  // Heidelberg: el ancla, por su "único consuelo" (la esperanza, ancla del alma).
  anchor: {
    main: `${circle(60, 22, 7)}M41 34h38a3 3 0 0 1 0 6H41a3 3 0 0 1 0-6zM57 29v5M63 29v5M57 40V95M63 40V95M26 74C28 90 44 101 60 101C76 101 92 90 94 74M34 73C37 86 48 93.5 57 94.5M86 73C83 86 72 93.5 63 94.5M26 74l-5-11 13 10M94 74l5-11-13 10M56 100l4 6 4-6`,
    thin: `${circle(60, 22, 3.2)}M46 35.5v3M51 35.5v3M69 35.5v3M74 35.5v3M60 44v4M60 52v4M60 60v4M60 68v4M60 76v4M60 84v4M33 82l-3 2.5M39 89l-2.5 3.5M47 94.5l-1.5 4M73 94.5l1.5 4M81 89l2.5 3.5M87 82l3 2.5M24.5 67l5 4M95.5 67l-5 4`,
  },
  // Calvino: el corazón ofrecido en la mano ("mi corazón te ofrezco, Señor").
  offeredHeart: {
    main: 'M64 62C50 53 46 44 50 37C53 32 61 33 64 39C67 33 75 32 78 37C82 44 78 53 64 62zM16 82L29 75L34 88L21 95zM29 75C40 69 50 69 58 71C66 73 78 73 90 67C94 65 97 69 93 72L80 79C70 87 52 92 34 88M50 70C52 63 58 61 62 63C65 65 63 69 58 71',
    thin: `${rays(64, 46, 23, 29, range(-150, -30, 20))}M72 75L86 69.5M74 78L90 71M74 40C77 45 75 50 68 56M20 85l10 -5.5M23 91l9-5M40 85C52 86 62 83 70 79`,
  },
  // Dort: el tulipán (los cinco puntos de la gracia).
  tulip: {
    main: 'M42 28C38 44 46 58 60 60C52 50 50 38 42 28zM78 28C82 44 74 58 60 60C68 50 70 38 78 28zM60 20C54 27 51 35 50.5 42M60 20C66 27 69 35 69.5 42M60 60V104M60 98C50 96 38 84 34 66C46 70 56 82 60 98zM60 92C68 90 80 80 86 62C74 66 64 76 60 92z',
    thin: 'M45.5 37C45.5 46 50 54 57 58M74.5 37C74.5 46 70 54 63 58M60 28V52M56 34C55 40 56 47 58 53M64 34C65 40 64 47 62 53M38 70C46 78 54 88 59 96M82 66C74 74 66 82 61 90M42 80l5 1M46 86l5 1M78 75l-5 1M74 81l-5 1',
  },
  // Confesión de Westminster: el ventanal ojival de la abadía.
  gothicArch: {
    main: `M36 98V52C36 36 48 24 60 16C72 24 84 36 84 52V98M32 98H88M60 98V58M40 66C40 56 45 50 50 46C55 50 60 56 60 66M60 66C60 56 65 50 70 46C75 50 80 56 80 66${circle(60, 37, 7.5)}`,
    thin: `M40 98V53C40 39 50 29 60 21.5C70 29 80 39 80 53V98M34 102H86${circle(60, 37, 3)}${rays(60, 37, 3, 7.5, [-90, 0, 90, 180])}M40 76H80M40 87H80M50 66V98M70 66V98`,
  },
  // Catecismo Menor de Westminster: la corona ("glorificar a Dios y gozar de él").
  crown: {
    main: `M30 80L24 48L42 63L60 38L78 63L96 48L90 80M30 80H90V89H30z${circle(24, 44, 3.5)}${circle(60, 33, 4)}${circle(96, 44, 3.5)}M60 29V18M55.5 22.5h9`,
    thin: `M34.5 76L31 57L42.5 67.5L60 45L77.5 67.5L89 57L85.5 76${circle(45, 84.5, 1.8)}${circle(75, 84.5, 1.8)}M60 81.5l3 3-3 3-3-3zM35 84.5h4M81 84.5h4M51 84.5h3M66 84.5h3M34 94H86M42 99H78`,
  },
  // Catecismo Mayor de Westminster: las tablas de la ley (su gran exposición
  // de los diez mandamientos).
  tablets: {
    main: 'M30 96V44a13 13 0 0 1 26 0V96M64 96V44a13 13 0 0 1 26 0V96M24 96H96M38 50h10M38 58h10M38 66h10M38 74h10M38 82h10M72 50h10M72 58h10M72 66h10M72 74h10M72 82h10',
    thin: `M33.5 96V44.5a9.5 9.5 0 0 1 19 0V96M67.5 96V44.5a9.5 9.5 0 0 1 19 0V96M28 101H92${rays(60, 34, 12, 20, [-90, -65, -115])}M38 54h6M38 62h7M38 70h5M38 78h7M72 54h7M72 62h5M72 70h7M72 78h6`,
  },
  // Catecismo para Niños Pequeños: la casa con el corazón (la fe enseñada en familia).
  home: {
    main: 'M22 60L60 28L98 60M31 53V94H89V53M54 94V77a6 6 0 0 1 12 0V94M73 39V29h8V46M60 62C54 58 52 54 54 51C55.6 48.8 58.8 49.4 60 52C61.2 49.4 64.4 48.8 66 51C68 54 66 58 60 62zM22 94H98',
    thin: 'M36 70h10v10H36zM74 70h10v10H74zM41 70v10M36 75h10M79 70v10M74 75h10M77 24c-3-3 3-5 0-8M63 86h1M28 99H92M38 104H82M30 59.5L60 34L90 59.5',
  },
  // Bautista de 1689: el agua del bautismo.
  waters: {
    main: `M60 18C50 32 44 41 44 51a16 16 0 0 0 32 0C76 41 70 32 60 18z${waves(20, 79, 8)}${waves(35, 97, 5)}`,
    thin: `M51 51a9 9 0 0 0 7 8.5${waves(25, 88, 7)}M36 46h-7M38 35l-6-3M84 46h7M82 35l6-3M60 72v-2M50 104h20`,
  },
  // Keach: la pluma y el tintero (el catecismo que escribió para las iglesias).
  quill: {
    main: 'M88 22C66 24 46 44 42 72M88 22C88 44 72 66 48 78M42 72L48 78M88 22C72 40 54 64 34 96M64 86h24l-3 14H67zM68 86v-5h16v5',
    thin: 'M77 35L66 34M71 43L58 43M65 51L52 53M59 59L46.5 63M79 33L86 38M73 41L82 49M67 49L76 59M61 57L68 67M55 65L59 73M67 92h18M26 104c6-5 12 3 18-1s10-3 14 0',
  },
  // New Hampshire: las Montañas Blancas.
  mountains: {
    main: `M20 86L42 48L53 64L70 34L100 86M17 86H103M36.5 57.5l4 3 3-4 4 4 3-3.5M62.5 47l4 3 4-5 4 5 4-3${circle(34, 30, 6)}`,
    thin: `M74 50L70 58M78 56L72 68M82 63L75 77M88 72L83 82M45.5 58L43 64M48 62L44 71${rays(34, 30, 9, 13, range(-180, 135, 45))}M26 92H94M36 97H84M48 102H72`,
  },
  // Catecismo de Spurgeon: el pórtico del Tabernáculo Metropolitano.
  temple: {
    main: `M24 42L60 22L96 42zM26 42v5h68v-5M28 86H92M24 90H96M21 94H99${templeColumns.map((x) => `M${f(x - 2)} 50V84M${f(x + 2)} 50V84M${f(x - 3.5)} 50h7M${f(x - 3.5)} 84h7`).join('')}`,
    thin: `M33 39.5L60 25.5L87 39.5${circle(60, 34.5, 3)}${templeColumns.map((x) => `M${x} 53V81`).join('')}M30 99H90`,
  },
  // Santidad (Ryle): la lámpara encendida ("lámpara es a mis pies tu palabra").
  lamp: {
    main: `M22 68C22 60 36 56 54 56C68 56 78 60 88 62C92 62.5 94 66 90 68C80 72 76 82 54 82C34 82 22 78 22 68zM22 68C13 66 12 56 17 54C22 53 24 58 24 62M48 56C48 51 60 51 60 56${circle(54, 48.5, 2)}M44 82l-4 8h28l-4-8M34 90H74M91 61C85 54 89 46 92 38C95 46 98 54 91 61z`,
    thin: `M91.5 57C89.5 53 91 49 92 46${rays(92, 48, 13, 17, [-140, -115, -90, -65, -40])}M30 74C38 78 50 79 62 77.5M32 63C42 60.5 54 60 64 61M28 96H80M40 101H68`,
  },
  // Spurgeon para Niños: el barrilete al viento.
  kite: {
    main: 'M66 18L88 46L66 82L44 46zM66 18V82M44 46H88M66 82C62 90 52 88 46 94C40 100 32 98 28 92M51 87l7 6v-6l-7 6zM34 94l7 6v-6l-7 6zM20 62a6 6 0 0 1 9-6a8 8 0 0 1 14 3a5 5 0 0 1 0 10H22a4 4 0 0 1-2-7z',
    thin: 'M66 30L52.5 46M66 40L61 46M66 70L80.7 46M66 58L73.3 46M86 74q3-4 6 0q3-4 6 0M78 88q2.5-3.5 5 0q2.5-3.5 5 0M26 74h12M30 79h6',
  },
  // El peregrino: el caminante que sube hacia la Ciudad Celestial.
  pilgrimPath: {
    main: `M51 50V37h6v13M57 50V28l4.5-6 4.5 6V50M66 50V35h6v15M46 50H78M60 50C58 58 72 60 70 68C68 76 43 75 43 87C43 95 49 99 47 105M64 50C63 57 78 58 77 68C76 79 67 78 68 87C69 94 73 98 73 104M16 80C28 72 38 54 46 50M78 50C86 54 96 72 104 80${circle(55, 80, 3)}M55 83.5V94M55 94l-3 7M55 94l3.5 7M61.5 79V101M55 87.5l6.5-2${circle(50.6, 87, 3.2)}`,
    thin: `${rays(61.5, 36, 19, 25, [-160, -135, -110, -70, -45, -20])}M60 50v-5h3v5M24 80c6-3 10-8 13-13M30 86c5-3 9-8 12-13M96 80c-6-3-10-8-13-13M90 86c-5-3-9-8-12-13M69 40v3M54 42v3`,
  },
}
