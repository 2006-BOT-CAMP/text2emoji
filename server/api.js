import { createServer } from 'http'
import { spawn } from 'child_process'
import { readFileSync, writeFileSync, existsSync, createReadStream } from 'fs'
import { join, extname, resolve } from 'path'
import { buildSystemPrompt, buildUserPrompt } from '../src/translator/prompt.js'

const PORT       = 3001
const PUBLIC     = resolve('./public')
const SRC        = resolve('./src')
const CACHE_PATH = './data/translations.json'
const PROMPT_FILE = './data/system-prompt.txt'
const CLAUDE_BIN = '/Users/galdu/.vscode/extensions/anthropic.claude-code-2.1.196-darwin-arm64/resources/native-binary/claude'

const MIME = {
  '.html': 'text/html',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.svg':  'image/svg+xml',
  '.css':  'text/css',
  '.png':  'image/png',
}

// — build enriched system prompt at startup —

function buildEmojiCatalog() {
  const data = JSON.parse(readFileSync('./public/data/openmoji.json', 'utf-8'))
  const SKIP = new Set(['component', 'flags'])

  const byGroup = {}
  for (const e of data) {
    if (e.unicode === '' || e.skintone !== '' || SKIP.has(e.group)) continue
    if (!byGroup[e.group]) byGroup[e.group] = []
    const tags = (e.tags || e.openmoji_tags || '').trim()
    byGroup[e.group].push(`  ${e.emoji} ${e.annotation}${tags ? ' — ' + tags : ''}`)
  }

  return Object.entries(byGroup)
    .map(([g, entries]) => `[${g}]\n${entries.join('\n')}`)
    .join('\n\n')
}

const catalog = buildEmojiCatalog()
const systemPrompt = buildSystemPrompt(catalog)
writeFileSync(PROMPT_FILE, systemPrompt)
console.log(`system prompt: ${(systemPrompt.length / 1024).toFixed(1)} KB — ${catalog.split('\n').filter(l => l.startsWith('  ')).length} emojis`)

// — translation —

const loadCache = () => existsSync(CACHE_PATH) ? JSON.parse(readFileSync(CACHE_PATH, 'utf-8')) : {}
const saveCache = (c) => writeFileSync(CACHE_PATH, JSON.stringify(c, null, 2))

function callClaude(text) {
  return new Promise((resolve, reject) => {
    const proc = spawn(CLAUDE_BIN, [
      '--print',
      '--system-prompt-file', PROMPT_FILE,
      '--model', 'claude-haiku-4-5-20251001',
      buildUserPrompt(text),
    ])
    let out = '', err = ''
    proc.stdout.on('data', (d) => (out += d))
    proc.stderr.on('data', (d) => (err += d))
    proc.on('close', (code) => code !== 0 ? reject(new Error(err || `exit ${code}`)) : resolve(out.trim()))
  })
}

// — server —

function serveStatic(req, res) {
  const urlPath = req.url === '/' ? '/index.html' : req.url
  const isSrc   = urlPath.startsWith('/src/')
  const root     = isSrc ? SRC : PUBLIC
  const filePath = join(root, isSrc ? urlPath.slice(4) : urlPath)

  if (!filePath.startsWith(root)) { res.writeHead(403); res.end(); return }

  const mime   = MIME[extname(filePath)] ?? 'application/octet-stream'
  const stream = createReadStream(filePath)
  stream.on('error', () => { res.writeHead(404); res.end() })
  stream.on('open', () => res.writeHead(200, { 'Content-Type': mime }))
  stream.pipe(res)
}

const server = createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/translate') {
    let body = ''
    req.on('data', (d) => (body += d))
    req.on('end', async () => {
      try {
        const { text } = JSON.parse(body)
        if (!text) throw new Error('Missing text')

        const key = text.toLowerCase().trim()
        const cache = loadCache()
        if (cache[key]) {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ emojis: cache[key], cached: true }))
          return
        }

        const emojis = await callClaude(text)
        cache[key] = emojis
        saveCache(cache)

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ emojis }))
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: e.message }))
      }
    })
    return
  }

  serveStatic(req, res)
})

server.listen(PORT, () => {
  console.log(`text2emoji → http://localhost:${PORT}`)
})
