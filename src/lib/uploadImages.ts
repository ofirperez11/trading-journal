import { supabase } from './supabase'

// Store trade screenshots in Supabase Storage (not as base64 inside the DB row).
// Base64 in the `images` column means every trades query re-downloads every
// screenshot — which blows through the egress quota. Uploading to Storage keeps
// rows tiny and lets the browser cache the images.

const TEN_YEARS = 315360000

/**
 * Upload any `data:` images to the trade-images bucket and return their URLs;
 * images that are already URLs pass through untouched. On any failure the
 * original value is kept so nothing is lost.
 */
export async function uploadTradeImages(images: string[], uploaderUid: string, tradeId: string): Promise<string[]> {
  const out: string[] = []
  for (let i = 0; i < images.length; i++) {
    const img = images[i]
    if (typeof img !== 'string' || !img.startsWith('data:')) {
      out.push(img)
      continue
    }
    try {
      const blob = await (await fetch(img)).blob()
      const ext = blob.type.includes('png') ? 'png' : blob.type.includes('jpeg') ? 'jpg' : 'webp'
      const path = `${uploaderUid}/${tradeId}/${Date.now()}-${i}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('trade-images')
        .upload(path, blob, { contentType: blob.type || 'image/webp', upsert: true })
      if (upErr) throw upErr
      const { data, error: signErr } = await supabase.storage.from('trade-images').createSignedUrl(path, TEN_YEARS)
      if (signErr || !data?.signedUrl) throw signErr ?? new Error('no url')
      out.push(data.signedUrl)
    } catch {
      out.push(img) // keep base64 rather than lose the image
    }
  }
  return out
}
