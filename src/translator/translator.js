import Anthropic from '@anthropic-ai/sdk'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { SYSTEM_PROMPT, buildUserPrompt } from './prompt.js'

const CACHE_PATH = './data/translations.json'

const loadCache = () => {
  if (!existsSync(CACHE_PATH)) return {}
  return JSON.parse(readFileSync(CACHE_PATH, 'utf-8'))
}

const saveCache = (cache) =>
  writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), 'utf-8')

export async function translate(text) {
  const cache = loadCache()
  const key = text.toLowerCase().trim()

  if (cache[key]) return cache[key]

  const client = new Anthropic()
  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 64,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildUserPrompt(text) }],
  })

  const emojis = message.content[0].text.trim()
  cache[key] = emojis
  saveCache(cache)

  return emojis
}
