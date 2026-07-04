import { createEmojiCanvas, renderEmojiStrip, transitionTo } from './canvas.js'

let emojiCanvas = null

export function initHydra() {
  emojiCanvas = createEmojiCanvas()
  // canvas off-DOM — Hydra reads it directly
  window.s0.init({ src: emojiCanvas, dynamic: true })
  return emojiCanvas
}

export async function showEmojis(emojiString, animate = true) {
  if (!emojiCanvas) throw new Error('Call initHydra() first')
  if (animate) {
    await transitionTo(emojiCanvas, emojiString)
  } else {
    await renderEmojiStrip(emojiCanvas, emojiString)
  }
}
