import { Writable } from 'node:stream'
import { renderToPipeableStream } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import Root from './Root.jsx'

// Entrada SOLO de build (la compila ltb-landing-html en vite.config.js con
// `build.ssr`; nunca llega al bundle del navegador). Devuelve el HTML de una ruta
// pública con el MISMO árbol que el cliente hidrata (Root: Suspense + LaunchReady +
// página). Los providers de preferencias, error y actualización no se montan acá:
// no producen DOM y leen localStorage/navigator, que en Node no existen.
//
// renderToPipeableStream + onAllReady espera a que resuelvan los lazy() de Root y
// emite la página completa DENTRO de su frontera <Suspense> (con los marcadores
// <!--$-->…<!--/$-->), que es lo que hydrateRoot espera encontrar.
export function renderRoute(url) {
  return new Promise((resolve, reject) => {
    const chunks = []
    const sink = new Writable({
      write(chunk, _encoding, done) {
        chunks.push(chunk)
        done()
      },
    })
    sink.on('finish', () => resolve(Buffer.concat(chunks).toString('utf8')))
    const { pipe } = renderToPipeableStream(
      <StaticRouter location={url}>
        <Root />
      </StaticRouter>,
      {
        onAllReady() {
          pipe(sink)
        },
        onShellError: reject,
        onError: reject,
      }
    )
  })
}
