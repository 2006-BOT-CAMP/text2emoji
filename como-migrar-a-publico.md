# Cómo migrar text2emoji a GitHub Pages

## Petición original

> si quisiera publicar este proyecto en github.io como debería modificarlo?
> como mínimo veo que la llamada a ia debería ser diferente, qué más debería cumplir?

## Diagnóstico

El proyecto no es solo "cambiar la llamada a IA" — la arquitectura entera asume un
servidor Node persistente, y GitHub Pages es hosting 100% estático (sin proceso,
sin filesystem de escritura, sin `spawn`).

## 1. La llamada a IA

- Hoy [server/api.js](server/api.js) (línea 56) hace `spawn('claude', ...)`, o sea
  depende de que el CLI de Claude Code esté instalado y logueado en esa máquina.
  Eso no existe en ningún hosting.
- Ya existe una base mejor en [src/translator/translator.js](src/translator/translator.js)
  que usa `@anthropic-ai/sdk` directo con `client.messages.create()` — pero está
  desactualizada (importa `SYSTEM_PROMPT`, que ya no existe en `prompt.js`) y sin usar.
- Solución: mover la llamada a una **función serverless** (Cloudflare Worker, Vercel
  Function o Netlify Function) que guarde la `ANTHROPIC_API_KEY` como secreto de
  servidor. **Nunca** meter la key en el bundle del frontend — cualquiera que abra
  devtools la robaría y la usaría a costa nuestra.

## 2. Rutas absolutas que dependen del servidor actual

- `import ... from '/src/renderer/hydra.js'` en `public/index.html` (línea 188)
  funciona solo porque el server mapea `/src/` a una carpeta fuera de `public/`.
  En Pages solo se sirve lo que se sube: hay que copiar/mover `src/` dentro de
  `public/`.
- Si se publica como *project page* (`usuario.github.io/repo/`) en vez de *user page*
  (`usuario.github.io`), las rutas que empiezan con `/` (`/data/openmoji.json`,
  `/openmoji/*.svg`, `/src/...`) apuntarán a la raíz del dominio, no a `/repo/`, y
  todo dará 404. Hay que usar rutas relativas o fijar un dominio propio / user page.

## 3. La cache en disco no existe en serverless

- `saveCache()` escribe en `./data/translations.json` — en una función serverless
  el filesystem es efímero o de solo lectura. Opciones:
  - (a) usar el JSON actual como "semilla" estática embebida y solo llamar a la IA
    en cache-miss sin persistir nada nuevo, o
  - (b) usar un KV/Redis (Cloudflare KV, Upstash) para persistir cache entre
    invocaciones.

## 4. Generación del system prompt

- Hoy se genera al arrancar el server Node leyendo `openmoji.json`. Hay que
  precalcularlo en build-time (un script que lo genera una vez) y empaquetarlo,
  no regenerarlo en cada request serverless.

## 5. Cosas nuevas necesarias por ser público

- CORS en la función serverless, restringido al dominio de Pages.
- Rate limiting / límite de longitud de texto — es una página pública gratuita y
  cada traducción cuesta dinero real en la API; sin límite, cualquiera puede
  vaciar la cuenta.
- Manejo de error en el frontend si el backend está caído o rate-limiteado (ahora
  mismo silenciosamente hace `clearCanvas()`).
- Workflow de GitHub Actions para publicar `public/` (Pages no sirve subcarpetas
  arbitrarias sin Actions, solo raíz, `/docs` o rama `gh-pages`).

## Pendiente para retomar

- Elegir dónde alojar la función serverless (Cloudflare Worker / Vercel / Netlify).
- Armar el plan concreto de migración con los cambios de código.
