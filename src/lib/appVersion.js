// La versión de la app: el número (package.json, se sube a mano en cada versión
// con novedades) y el código del build (el commit, automático: ver
// vite.config.js). Ajustes muestra "Versión 2.0.0 · 34b4e4b"; los reportes de
// error mandan las dos cosas.
import { version } from '../../package.json'

export const APP_VERSION = version
export const APP_BUILD = import.meta.env.VITE_APP_BUILD || 'dev'
export const APP_VERSION_LABEL = `${APP_VERSION} · ${APP_BUILD}`
