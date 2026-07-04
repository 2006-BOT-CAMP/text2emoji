import { createServer } from 'http'
import { spawn } from 'child_process'
import { readFileSync, writeFileSync, existsSync, createReadStream } from 'fs'
import { join, extname, resolve } from 'path'
import { SYSTEM_PROMPT, buildUserPrompt } from '../src/translator/prompt.js'

const PORT = 3001
const PUBLIC = resolve('./public')
const SRC    = resolve('./src')
const CACHE_PATH = './data/translations.json'
const CLAUDE_BIN = '/Users/galdu/.vscode/extensions/anthropic.claude-code-2.1.196-darwin-arm64/resources/native-binary/claude'

const MIME = {
  '.html': 'text/html',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.svg':  'image/svg+xml',
  '.css':  'text/css',
  '.png':  'image/png',
}

const loadCache = () => existsSync(CACHE_PATH) ? JSON.parse(readFileSync(CACHE_PATH, 'utf-8')) : {}
const saveCache = (c) => writeFileSync(CACHE_PATH, JSON.stringify(c, null, 2))

function callClaude(text) {
  return new Promise((resolve, reject) => {
    const proc = spawn(CLAUDE_BIN, [
      '--print',
      '--system-prompt', SYSTEM_PROMPT,
      '--model', 'claude-haiku-4-5-20251001',
      buildUserPrompt(text),
    ])
    let out = '', err = ''
    proc.stdout.on('data', (d) => (out += d))
    proc.stderr.on('data', (d) => (err += d))
    proc.on('close', (code) => code !== 0 ? reject(new Error(err || `exit ${code}`)) : resolve(out.trim()))
  })
}

function serveStatic(req, res) {
  const urlPath = req.url === '/' ? '/index.html' : req.url

  // /src/* served from project src/ — everything else from public/
  const isSrc = urlPath.startsWith('/src/')
  const root  = isSrc ? SRC : PUBLIC
  const filePath = join(root, isSrc ? urlPath.slice(4) : urlPath)

  if (!filePath.startsWith(root)) { res.writeHead(403); res.end(); return }

  const mime = MIME[extname(filePath)] ?? 'application/octet-stream'
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
