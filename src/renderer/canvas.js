import { loadEmojiImages } from '../emojis/loader.js'

const EMOJI_RATIO = 0.22

let loadingAnimId = null

export function createEmojiCanvas() {
  const dpr = window.devicePixelRatio || 1
  const canvas = document.createElement('canvas')
  canvas.width  = Math.round(window.innerWidth  * dpr)
  canvas.height = Math.round(window.innerHeight * dpr)
  return canvas
}

// Animates text + spinner on canvas until stopLoading() is called
export function startLoading(canvas, text) {
  stopLoading()
  const ctx      = canvas.getContext('2d')
  const cx       = canvas.width / 2
  const cy       = canvas.height / 2
  const fontSize = Math.round(canvas.height * 0.055)
  const spinR    = Math.round(canvas.height * 0.032)
  const spinY    = cy + fontSize * 1.4

  ctx.textAlign    = 'center'
  ctx.textBaseline = 'middle'
  ctx.font         = `300 ${fontSize}px system-ui, sans-serif`

  const draw = (ts) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // text
    ctx.fillStyle = 'rgba(255,255,255,0.75)'
    ctx.fillText(text, cx, cy)

    // spinning arc
    const angle = (ts / 900) * Math.PI * 2
    ctx.beginPath()
    ctx.arc(cx, spinY, spinR, angle, angle + Math.PI * 1.3)
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'
    ctx.lineWidth   = Math.max(2, Math.round(spinR * 0.14))
    ctx.lineCap     = 'round'
    ctx.stroke()

    loadingAnimId = requestAnimationFrame(draw)
  }

  loadingAnimId = requestAnimationFrame(draw)
}

export function stopLoading() {
  if (loadingAnimId) {
    cancelAnimationFrame(loadingAnimId)
    loadingAnimId = null
  }
}

export async function renderEmojiStrip(canvas, emojiString) {
  const ctx  = canvas.getContext('2d')
  const size = Math.round(canvas.height * EMOJI_RATIO)
  console.log(`[canvas] render strip: "${emojiString}" at ${size}px on ${canvas.width}×${canvas.height}`)
  const images = await loadEmojiImages(emojiString, size)
  const loaded = images.filter((i) => i.loaded)

  const padding = Math.round(size * 0.2)

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  const totalWidth = loaded.length * (size + padding) - padding
  let x = (canvas.width - totalWidth) / 2
  const y = (canvas.height - size) / 2

  for (const { img } of loaded) {
    ctx.drawImage(img, x, y, size, size)
    x += size + padding
  }
}

export async function transitionTo(canvas, emojiString, duration = 600) {
  console.log(`[canvas] transition → "${emojiString}"`)
  const to = document.createElement('canvas')
  to.width  = canvas.width
  to.height = canvas.height
  await renderEmojiStrip(to, emojiString)

  // stop spinner and snapshot last frame
  stopLoading()
  const from = document.createElement('canvas')
  from.width  = canvas.width
  from.height = canvas.height
  from.getContext('2d').drawImage(canvas, 0, 0)

  const ctx = canvas.getContext('2d')
  let start = null

  const step = (ts) => {
    if (!start) start = ts
    const t    = Math.min((ts - start) / duration, 1)
    const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.globalAlpha = 1 - ease
    ctx.drawImage(from, 0, 0)
    ctx.globalAlpha = ease
    ctx.drawImage(to, 0, 0)
    ctx.globalAlpha = 1

    if (t < 1) requestAnimationFrame(step)
  }

  requestAnimationFrame(step)
}
