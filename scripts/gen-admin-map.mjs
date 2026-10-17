// Regenera los datos del mapa del panel (/admin):
//   src/screens/admin/worldMap.json  → países (Natural Earth 1:110m, sin Antártida)
//     pre-proyectados (Natural Earth I, 960×470) como paths SVG, por ISO-2.
//   src/screens/admin/tzCountry.json → zona horaria IANA → ISO-2.
// Las librerías solo hacen falta para generar; la app no las carga. Uso:
//   mkdir /tmp/mapgen && cd /tmp/mapgen && npm init -y && npm i d3-geo@3.1.1 \
//     topojson-client@3.1.0 world-atlas@2.0.2 i18n-iso-countries@7.14.0 countries-and-timezones@3.7.2
//   node scripts/gen-admin-map.mjs /tmp/mapgen src/screens/admin
import { createRequire } from 'node:module'
import { writeFileSync } from 'node:fs'
const [, , modsDir, outDir] = process.argv
const require = createRequire(modsDir + '/package.json')
const d3 = await import(require.resolve('d3-geo'))
const topo = await import(require.resolve('topojson-client'))
const world = require('world-atlas/countries-110m.json')
const iso = require('i18n-iso-countries')
const ct = require('countries-and-timezones')

const W = 960, H = 470
const fc = topo.feature(world, world.objects.countries)
fc.features = fc.features.filter((f) => f.id !== '010') // sin Antártida
const projection = d3.geoNaturalEarth1().fitExtent([[4, 4], [W - 4, H - 4]], fc)
const path = d3.geoPath(projection).digits(1)
const countries = []
const missing = []
for (const f of fc.features) {
  const a2 = f.id ? iso.numericToAlpha2(f.id) : null
  const d = path(f)
  if (!d) continue
  // Kosovo y N. Chipre no tienen código numérico ISO en world-atlas.
  const code = a2 || (f.properties.name === 'Kosovo' ? 'XK' : null)
  if (!code) { missing.push(f.properties.name); continue }
  countries.push({ id: code, d })
}
writeFileSync(outDir + '/worldMap.json', JSON.stringify({ w: W, h: H, countries }))
const tz = {}
for (const [name, z] of Object.entries(ct.getAllTimezones({ deprecated: true }))) {
  const c = z.countries?.[0]
  if (c) tz[name] = c
}
writeFileSync(outDir + '/tzCountry.json', JSON.stringify(tz))
console.log('countries', countries.length, 'skipped', missing, 'tz', Object.keys(tz).length)
