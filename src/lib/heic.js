// HEIC/HEIF: el formato "de alta eficiencia" de iPhone y de varios Android
// (Samsung, Xiaomi…). Safari lo abre solo; Chrome y Firefox no. Para esos
// navegadores la foto se convierte acá mismo, en el teléfono, con libheif
// (paquete heic-to, LGPL-3.0, sin modificar y en su propio chunk).
//
// El conversor pesa ~3 MB (~0,5 MB por la red): se baja SOLO la primera vez que
// alguien elige una foto HEIC en un navegador que no la abre, y queda guardado
// (caché de código del service worker). No entra en la instalación de la app.

// Marcas ISO-BMFF de las imágenes HEIF/HEIC (bytes 8–12, después de "ftyp").
const BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1'])

// ¿Es HEIC/HEIF? Mira el tipo y la extensión, y si no alcanzan (hay Android que
// entregan la foto sin tipo y con un nombre sin extensión) lee la cabecera.
export async function isHeic(file) {
  if (!file) return false
  if (/hei[cf]/i.test(file.type || '') || /\.hei[cf]s?$/i.test(file.name || '')) return true
  // Un tipo declarado que no es HEIC (image/jpeg, image/png…) se respeta.
  if (file.type) return false
  try {
    const head = new Uint8Array(await file.slice(0, 12).arrayBuffer())
    if (head.length < 12) return false
    const ascii = String.fromCharCode(...head)
    return ascii.slice(4, 8) === 'ftyp' && BRANDS.has(ascii.slice(8, 12))
  } catch {
    return false
  }
}

// Convierte la foto a un ImageBitmap listo para dibujar. libheif ya aplica la
// rotación que trae el archivo, así que sale derecha.
export async function heicToBitmap(file) {
  // La variante /csp no usa eval: sirve igual el día que el sitio tenga CSP.
  const { heicTo } = await import('heic-to/csp')
  return heicTo({ blob: file, type: 'bitmap' })
}
