const OPENMOJI_PATH = '/openmoji'
let emojiMap = null

async function getEmojiMap() {
  if (emojiMap) return emojiMap
  const res  = await fetch('/data/openmoji.json')
  const data = await res.json()
  emojiMap   = new Map()
  for (const e of data) {
    emojiMap.set(e.emoji, e.hexcode)
    // also index without trailing U+FE0F (variation selector-16) so lookups
    // work whether Claude returns ❤ (U+2764) or ❤️ (U+2764 + U+FE0F)
    const stripped = e.emoji.replace(/️$/, '')
    if (stripped !== e.emoji) emojiMap.set(stripped, e.hexcode)
  }
  return emojiMap
}

export function emojiToSvgPath(hexcode) {
  return `${OPENMOJI_PATH}/${hexcode}.svg`
}

export function splitEmojis(emojiString) {
  return [...new Intl.Segmenter().segment(emojiString)].map((s) => s.segment)
}

// Fetches SVG text, injects explicit width/height, loads as Image.
// Forces the browser to rasterize the vector at exactly `size` px
// instead of defaulting to the 72×72 viewBox.
async function loadSvgAtSize(url, size) {
  const text   = await fetch(url).then((r) => r.text())
  const sized  = text.replace('<svg ', `<svg width="${size}" height="${size}" `)
  const blob   = new Blob([sized], { type: 'image/svg+xml' })
  const blobUrl = URL.createObjectURL(blob)

  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(blobUrl); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(blobUrl); reject() }
    img.src = blobUrl
  })
}

export async function loadEmojiImages(emojiString, size = 256) {
  const map    = await getEmojiMap()
  const emojis = splitEmojis(emojiString)
  console.log(`[loader] loading ${emojis.length} emojis at ${size}px: ${emojiString}`)

  const results = await Promise.all(
    emojis.map(async (emoji) => {
      const hexcode = map.get(emoji)
      if (!hexcode) {
        console.warn(`[loader] ✗ no hexcode for "${emoji}" (U+${emoji.codePointAt(0).toString(16).toUpperCase()})`)
        return { emoji, hexcode: null, img: null, loaded: false }
      }
      try {
        const img = await loadSvgAtSize(emojiToSvgPath(hexcode), size)
        console.log(`[loader] ✓ ${emoji} (${hexcode})`)
        return { emoji, hexcode, img, loaded: true }
      } catch {
        console.warn(`[loader] ✗ failed to load ${emoji} (${hexcode})`)
        return { emoji, hexcode, img: null, loaded: false }
      }
    })
  )

  const loaded = results.filter(r => r.loaded).length
  console.log(`[loader] done: ${loaded}/${emojis.length} loaded`)
  return results
}
