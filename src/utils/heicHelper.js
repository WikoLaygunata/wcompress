import { convert as heicConvert, isHeic as checkIsHeic } from 'heiccon'

export const HEIC_ACCEPT_TYPES = 'image/*,.heic,.heif,.hif,.heics,.heifs,image/heic,image/heif'

/**
 * Checks whether a given file is a HEIC/HEIF image.
 * Uses fast filename / MIME checks first, then falls back to magic bytes inspection.
 */
export const isHeicFile = async (file) => {
  if (!file) return false

  const name = (file.name || '').toLowerCase()
  const type = (file.type || '').toLowerCase()

  if (
    name.endsWith('.heic') ||
    name.endsWith('.heif') ||
    name.endsWith('.hif') ||
    name.endsWith('.heics') ||
    name.endsWith('.heifs') ||
    type === 'image/heic' ||
    type === 'image/heif' ||
    type.includes('heic') ||
    type.includes('heif')
  ) {
    return true
  }

  // Fallback to checking magic bytes (WASM/buffer) if the MIME type is missing or generic (common on Windows)
  if (!type || type === 'application/octet-stream') {
    try {
      return await checkIsHeic(file)
    } catch {
      return false
    }
  }

  return false
}

/**
 * If the file is a HEIC/HEIF file, converts it into a browser-compatible format (jpg or png).
 * Otherwise returns the original file untouched.
 */
export const ensureCompatibleImage = async (file, targetFormat = 'jpg', quality = 90) => {
  const isHeic = await isHeicFile(file)
  if (!isHeic) {
    return file
  }

  const result = await heicConvert(file, {
    format: targetFormat,
    quality: quality,
  })

  const newExt = targetFormat === 'png' ? '.png' : '.jpeg'
  const newMime = targetFormat === 'png' ? 'image/png' : 'image/jpeg'
  const baseName = file.name ? file.name.replace(/\.(heic|heif|hif|heics|heifs)$/i, '') : 'converted_image'
  const newName = `${baseName}${newExt}`

  return new File([result.blob], newName, { type: newMime })
}
