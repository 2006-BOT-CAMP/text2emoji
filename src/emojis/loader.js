const OPENMOJI_PATH = '/openmoji'
let emojiMap = null

async function getEmojiMap() {
  if (emojiMap) return emojiMap
  const res = await fetch('/data/openmoji.json')
  const data = await res.json()
  emojiMap = new Map(data.map((e) => [e.emoji, e.hexcode]))
  return emojiMap
}

export function emojiToSvgPath(hexcode) {
  return `${OPENMOJI_PATH}/${hexcode}.svg`
}

export function splitEmojis(emojiString) {
  return [...new Intl.Segmenter().segment(emojiString)].map((s) => s.segment)
}

// Fetches SVG text, injects explicit width/height, loads as Image.
// This forces the browser to rasterize the vector at exactly `size` px
// instead of defaulting to the 72×72 viewBox.
async function loadSvgAtSize(url, size) {
  const text = await fetch(url).then((r) => r.text())
  const sized = text.replace('<svg ', `<svg width="${size}" height="${size}" `)
  const blob = new Blob([sized], { type: 'image/svg+xml' })
  const blobUrl = URL.createObjectURL(blob)

  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(blobUrl); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(blobUrl); reject() }
    img.src = blobUrl
  })
}

export async function loadEmojiImages(emojiString, size = 256) {
  const map = await getEmojiMap()
  const emojis = splitEmojis(emojiString)

  return Promise.all(
    emojis.map(async (emoji) => {
      const hexcode = map.get(emoji)
      if (!hexcode) return { emoji, hexcode: null, img: null, loaded: false }

      try {
        const img = await loadSvgAtSize(emojiToSvgPath(hexcode), size)
        return { emoji, hexcode, img, loaded: true }
      } catch {
        return { emoji, hexcode, img: null, loaded: false }
      }
    })
  )
}
