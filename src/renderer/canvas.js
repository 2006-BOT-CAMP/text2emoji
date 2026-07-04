import { loadEmojiImages } from '../emojis/loader.js'

// emoji height as fraction of canvas height — sube para emojis más grandes
const EMOJI_RATIO = 0.22

export function createEmojiCanvas() {
  const dpr = window.devicePixelRatio || 1
  const canvas = document.createElement('canvas')
  canvas.width  = Math.round(window.innerWidth  * dpr)
  canvas.height = Math.round(window.innerHeight * dpr)
  return canvas
}

export async function renderEmojiStrip(canvas, emojiString) {
  const ctx  = canvas.getContext('2d')
  const size = Math.round(canvas.height * EMOJI_RATIO)
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
  const from = document.createElement('canvas')
  from.width  = canvas.width
  from.height = canvas.height
  from.getContext('2d').drawImage(canvas, 0, 0)

  const to = document.createElement('canvas')
  to.width  = canvas.width
  to.height = canvas.height
  await renderEmojiStrip(to, emojiString)

  const ctx = canvas.getContext('2d')
  let start = null

  const step = (ts) => {
    if (!start) start = ts
    const t = Math.min((ts - start) / duration, 1)
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
