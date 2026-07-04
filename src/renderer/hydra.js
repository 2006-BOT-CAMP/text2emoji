import { createEmojiCanvas, renderEmojiStrip, transitionTo, startLoading, stopLoading } from './canvas.js'

let emojiCanvas = null

export function initHydra() {
  emojiCanvas = createEmojiCanvas()
  console.log(`[hydra] canvas ${emojiCanvas.width}×${emojiCanvas.height} (dpr ${window.devicePixelRatio})`)
  window.s0.init({ src: emojiCanvas, dynamic: true })
  console.log('[hydra] s0 initialized')
  return emojiCanvas
}

export function showText(text) {
  if (!emojiCanvas) throw new Error('Call initHydra() first')
  startLoading(emojiCanvas, text)
}

export function clearCanvas() {
  if (!emojiCanvas) return
  stopLoading()
  const ctx = emojiCanvas.getContext('2d')
  ctx.clearRect(0, 0, emojiCanvas.width, emojiCanvas.height)
}

export async function showEmojis(emojiString, animate = true) {
  if (!emojiCanvas) throw new Error('Call initHydra() first')
  if (animate) {
    await transitionTo(emojiCanvas, emojiString)
  } else {
    stopLoading()
    await renderEmojiStrip(emojiCanvas, emojiString)
  }
}
