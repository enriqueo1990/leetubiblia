// Foto de perfil (migración 0037). La foto se recorta al cuadrado del centro, se
// achica a 256×256 y se sube en WebP (~20 KB) a avatars/<user_id>/avatar.webp;
// el perfil guarda la URL pública con ?v= para que el cambio se vea al instante.
import { supabase } from './supabase.js'
import { centerSquare } from './avatarMath.js'

export const AVATAR_SIZE = 256
const BUCKET = 'avatars'
const pathFor = (uid) => `${uid}/avatar.webp`


// Recorta y achica en el navegador. `rect` es el cuadrado elegido en la hoja de
// recorte (en píxeles de la imagen); sin él, el cuadrado del centro. WebP si el
// navegador lo genera; si no, JPEG.
export async function avatarBlob(file, rect = null) {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => null)
  const img = bitmap ?? (await loadImage(file))
  const w = img.width
  const h = img.height
  const { sx, sy, side } = rect ?? centerSquare(w, h)
  const canvas = document.createElement('canvas')
  canvas.width = AVATAR_SIZE
  canvas.height = AVATAR_SIZE
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, sx, sy, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE)
  bitmap?.close?.()
  const toBlob = (type, q) => new Promise((res) => canvas.toBlob(res, type, q))
  const webp = await toBlob('image/webp', 0.82)
  if (webp && webp.type === 'image/webp') return webp
  return toBlob('image/jpeg', 0.85)
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('image'))
    }
    img.src = url
  })
}

// Sube la foto y devuelve la URL pública (con ?v= nuevo).
export async function uploadAvatar(uid, blob) {
  const { error } = await supabase.storage.from(BUCKET).upload(pathFor(uid), blob, {
    upsert: true,
    contentType: blob.type || 'image/webp',
    cacheControl: '31536000',
  })
  if (error) throw error
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(pathFor(uid))
  return `${data.publicUrl}?v=${Date.now()}`
}

// Borra la foto del almacenamiento (si no hay, no pasa nada).
export async function removeAvatarFile(uid) {
  const { error } = await supabase.storage.from(BUCKET).remove([pathFor(uid)])
  if (error) throw error
}
