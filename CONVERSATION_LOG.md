# text2emoji — log de conversación

---

## 2026-07-03

### [user]
Quiero construir un proyecto visual que traduzca texto a emojis, no palabra por palabra sino en modo pictograma, por conceptos. Por ejemplo: "te quiero a morir" sería ❤💀.

Los emojis vendrían de https://openmoji.org/ o de un scrape en local si no puedo obtenerlos directamente por la configuración de CORS.

Pensando en crear una banda tipo subtítulos que pintaría en Hydra. Usar algún tipo de solución para traducir de texto a conjunto de emojis creando algún tipo de base de datos o utilizando alguna IA para encontrar equivalencias entre conceptos y grupos de emojis.

### [assistant]
Propuse abordar el proyecto en tres capas:

1. **Traducción texto → emojis** — LLM con prompt diseñado para pictogramas poéticos. Recomendé Claude Haiku por velocidad y coste. El prompt es el artefacto clave.
2. **Emojis (OpenMoji)** — descargar el pack local para evitar CORS. Su `openmoji.json` contiene metadata útil.
3. **Hydra** — canvas externo como fuente `s0`. Flujo: texto → API LLM → array de emojis → canvas HTML → `s0.init({src: canvas})`.

Stack sugerido: Claude API, OpenMoji SVGs local, Canvas API / p5.js, Hydra, Node.js opcional como proxy de API key.

---

### [user]
Vamos a crear la estructura del proyecto según las capas que propones. En cuanto al diseño del prompt me interesa más una ambigüedad poética. Puedes además guardar log en un md de toda nuestra conversación.

### [assistant]
Creé la estructura de proyecto con los siguientes archivos:

```
text2emoji/
├── src/
│   ├── translator/
│   │   ├── prompt.js          # prompt con ambigüedad poética + ejemplos
│   │   └── translator.js      # llamadas a API + cache en JSON local
│   ├── emojis/
│   │   └── loader.js          # carga SVGs de OpenMoji, split de emoji strings
│   └── renderer/
│       ├── canvas.js          # dibuja banda horizontal, transición fade
│       └── hydra.js           # wire canvas → s0, sketch Hydra de ejemplo
├── public/
│   ├── openmoji/              # aquí van los SVGs descargados
│   └── index.html             # UI mínima + Hydra inicializado
├── server/
│   └── api.js                 # proxy Node.js para no exponer API key
├── data/
│   └── translations.json      # cache de traducciones
├── CONVERSATION_LOG.md        # este archivo
└── package.json
```

El prompt fue diseñado con énfasis en **ambigüedad poética**: busca resonancia emocional sobre claridad, metáforas visuales sobre denotaciones directas. Ejemplos en el prompt:
- "estoy hecho polvo" → 🌫️⌛
- "no puedo más" → 🪨🌊
- "todo se derrumba" → 🏛️💨

**Próximos pasos:**
- Descargar OpenMoji SVG Color pack → extraer en `public/openmoji/`
- Crear `.env` con `ANTHROPIC_API_KEY`
- `npm install` + `npm run server` para arrancar el proxy
- Abrir `public/index.html` con `npm run dev`

---

### [user]
Vamos a montar los SVGs de OpenMoji.

### [assistant]
Sin Node.js disponible, descargué el pack directamente desde GitHub releases v17.0.0 con curl:
- `openmoji-svg-color.zip` → extraído en `public/openmoji/` (4495 SVGs)
- `openmoji.json` → `public/data/openmoji.json` (2.1MB, 4495 entradas)

Descubrí un problema de naming: OpenMoji usa hexcodes sin FE0F en emojis simples (`2764.svg` para ❤) pero con FE0F en secuencias ZWJ (`2764-FE0F-200D-1F525.svg` para ❤️‍🔥). Filtrar FE0F siempre rompería los compound emojis.

Solución: actualicé `src/emojis/loader.js` para usar `openmoji.json` como tabla de lookup (emoji char → hexcode) en lugar de calcular el hexcode desde el codepoint. Más robusto y sin casos edge.

---

### [user]
Vamos a instalar Node.js con brew.

### [assistant]
Instalado Node.js v26.4.0 + npm v11.17.0 vía `brew install node`. Ejecutado `npm install` en el proyecto — dependencia `@anthropic-ai/sdk` instalada.

---

### [user]
Vamos a hacerlo sencillo — el servidor de estáticos integrado en el mismo `server/api.js`.

### [assistant]
Integré el servidor de archivos estáticos en `server/api.js` usando `fs.createReadStream` y un mapa de MIME types. El servidor ahora maneja:
- `POST /translate` → traducción con cache
- `GET /*` → archivos estáticos desde `public/`

Actualicé `index.html` para usar `/translate` (mismo origen) en lugar de `http://localhost:3001/translate`. Un solo proceso, un solo puerto.

---

### [user]
Vamos hacia la parte de Hydra.

### [assistant]
Conecté el canvas de emojis a Hydra como fuente `s0`:

- `server/api.js` — añadida ruta `/src/*` que sirve los módulos ES de `src/` al browser
- `src/renderer/hydra.js` — `initHydra()` crea el canvas off-DOM y llama a `window.s0.init({ src: canvas, dynamic: true })`
- `public/index.html` — importa los módulos vía `<script type="module">`, inicializa Hydra y llama a `initHydra()`, usa `showEmojis()` en lugar de `textContent`

El sketch por defecto es `src(s0).out(o0)`. Los emojis ahora se renderizan en canvas y Hydra los lee cada frame.

---

### [user]
¿Podemos tener una caja de texto para controlar el procesado de Hydra y no utilizar la consola del browser?

### [assistant]
Añadí un editor de código Hydra en `public/index.html`:
- Textarea verde sobre negro, arriba a la izquierda, pre-cargado con el sketch actual
- **Ctrl+Enter** — evalúa el código con `eval()`
- **Tab** — oculta/muestra el editor (para modo performance)
- Status line que confirma ejecución o muestra el error

---

### [user]
Los emojis aparecen con aliasing y pixelados aunque solo tenga `src(s0).out(o0)`. ¿Cómo conseguimos mejor calidad?

### [assistant]
Dos problemas encadenados:

1. **Canvas pequeño estirado**: el canvas era 1280×160 y Hydra lo expandía a todo el viewport → upscaling masivo. Solución: `createEmojiCanvas()` ahora crea el canvas a `window.innerWidth × window.innerHeight × devicePixelRatio` — mismo tamaño que el output de Hydra, sin escalar.

2. **SVG rasterizado a 72×72 por defecto**: los SVGs de OpenMoji tienen `viewBox="0 0 72 72"` sin `width`/`height` explícito. El browser los rasterizaba a 72px y luego `drawImage` los escalaba.

Intenté `createImageBitmap` con `resizeWidth`/`resizeHeight` pero falló silenciosamente con blobs SVG. Solución definitiva en `src/emojis/loader.js`: fetch del SVG como texto → inyección de `width="N" height="N"` en el XML → Blob URL → `new Image()`. El browser rasteriza el vector exactamente al tamaño de render.

También corregí el bug de la transición: `putImageData` ignora `globalAlpha`, reescrito con dos offscreen canvases y `drawImage` para un crossfade real.

`EMOJI_RATIO` subido de 0.14 a 0.22 (22% del alto del canvas).

---

## 2026-07-04

### [user]
Vamos a probar el emoji_ratio, porque se siguen viendo pixelados.

### [assistant]
Ver entrada anterior — la solución de fetch+inject+blob fue la definitiva para el pixelado. `EMOJI_RATIO = 0.22` activo.

---

### [user]
¿Puedes añadir un README.md con la descripción del proyecto y cómo utilizarlo?

### [assistant]
Creado `README.md` con: descripción del proyecto y ejemplos de traducción, requisitos e instalación, tabla de controles de la UI, ejemplos de sketches Hydra, diagrama de arquitectura y árbol de ficheros, decisiones técnicas documentadas (sin API key, cache, SVGs nítidos, canvas full-res), sección de créditos (OpenMoji CC BY-SA 4.0, Hydra, Claude).

---

### [user]
La frase de entrada debería mostrarse en el canvas de Hydra durante unos segundos o hasta que llegue la respuesta en emojis, con un indicador tipo rueda de "procesando".

### [assistant]
Añadida animación de loading en `src/renderer/canvas.js`:
- `startLoading(canvas, text)` — dibuja el texto centrado + arco giratorio animado con `requestAnimationFrame`
- `stopLoading()` — cancela el loop de animación
- `transitionTo` actualizado: carga los SVGs mientras el spinner sigue activo, lo para justo antes del snapshot para el crossfade

Nuevas funciones expuestas en `src/renderer/hydra.js`:
- `showText(text)` — llama a `startLoading` 
- `clearCanvas()` — para el spinner y limpia (usado en caso de error)

`public/index.html` actualizado: `showText(text)` se llama inmediatamente al submit, antes del fetch. El flujo es: texto+spinner → (Claude procesa) → crossfade a emojis.

---

### [user]
¿En el prompt puedo hacer referencia a que utilice openmoji.json como fuente para interpretar mejor la traducción? En concreto los campos group, subgroups, tags.

### [assistant]
Implementado catálogo semántico de emojis inyectado en el system prompt al arrancar el servidor:

- `src/translator/prompt.js` — separado en `BASE_PROMPT` + `buildSystemPrompt(catalog)`. El catálogo se append tras las instrucciones con la sección "CATÁLOGO DE EMOJIS".
- `server/api.js` — `buildEmojiCatalog()` al startup: carga `openmoji.json`, filtra a emojis Unicode estándar sin variantes de skintone (excluye `component` y `flags`), agrupa por categoría, escribe el prompt enriquecido en `data/system-prompt.txt`.
- `callClaude()` actualizado para usar `--system-prompt-file` en lugar de `--system-prompt` (evita límites de tamaño de argumentos shell).

Resultado: 113.5KB de system prompt, 1781 emojis con annotation + tags. Prueba: "noche sin fondo" → 🌌🕳️ (agujero negro para "sin fondo"). Caché limpiado para regenerar con el nuevo prompt.

---

### [user]
¿Es posible que en la caja de comandos de Hydra no pueda utilizar variables como `time`?

### [assistant]
El problema es que `<script type="module">` corre en modo estricto y su `eval()` tiene scope aislado — los globales de Hydra (`time`, `mouse`, `osc`, etc.) no son accesibles como identificadores libres desde dentro del módulo.

Solución: añadido un script no-módulo en `index.html` que expone `window._hydraEval = function(code) { return eval(code) }`. El editor llama a `window._hydraEval()` en lugar de `eval()`, con acceso completo al scope global de Hydra.

Nota importante: `time` debe usarse como `() => time` (función) para que se evalúe cada frame. Como valor directo solo captura el instante de ejecución.

Ejemplo añadido al README:
```javascript
src(s0)
  .scrollX(() => Math.sin(time) * 2)
  .out(o0)
```

---

### [user]
El texto aparece pixelado en el canvas de Hydra — se sigue viendo pixelado tras el intento anterior de pasar `width × dpr` al constructor de Hydra.

### [assistant]
Causa encontrada: si Hydra ignora los parámetros `width`/`height` del constructor (la versión CDN puede no respetarlos), el output canvas queda en resolución CSS (~1440×900). Nuestro emoji canvas estaba creado a 2880×1800 (físico × dpr). Hydra hace el mapeado texture→output con downsampling 2:1 usando filtro NEAREST, que convierte texto suavemente anti-aliased en el aspecto exacto de una pixel/bitmap font: bordes cuadrados, pixelado.

Tres cambios:

1. **`src/renderer/hydra.js`** — `initHydra()` lee `hCanvas.width`/`hCanvas.height` DESPUÉS de que Hydra inicialice, pasa esas dimensiones a `createEmojiCanvas()`. Garantiza mapeado 1:1 de textura a output.

2. **`src/renderer/canvas.js`** — `createEmojiCanvas(w, h)` acepta dimensiones explícitas con fallback a `dpr × viewport`.

3. **`src/renderer/canvas.js`** — Font del spinner cambiado de `300 Xpx system-ui` a `-apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial` (sin peso 300). El stack es más robusto en contextos canvas.

Añadido log `[init] hydra canvas after init: WxH` en `public/index.html` para verificar la resolución real de Hydra en consola.

---

### [user]
El resultado es peor — la imagen muestra texto con aspecto de pixel/bitmap font distinto pero igual de pixelado (ahora outline en vez de blocky). El spinner también se ve pixelado.

### [assistant]
El problema es arquitectural, no de configuración: **cualquier texto renderizado en canvas 2D y procesado por el pipeline WebGL de Hydra perderá calidad**. Los strokes finos de las tipografías son destruidos por el filtrado de textura, independientemente de la fuente o de la resolución del canvas. El spinner (trazo grueso) sobrevive algo mejor; el texto con strokes finos, no.

Solución definitiva: **overlay CSS** para el estado de carga. El browser renderiza el texto como DOM nativo — siempre nítido, anti-aliased por el sistema operativo, sin pasar por WebGL. El canvas de Hydra solo muestra emojis (donde la calidad SVG es aceptable).

Cambios en `public/index.html`:
- Eliminado `showText(text)` — ya no se llama al canvas durante la carga
- Añadido `<div id="loading-overlay">` con `<div id="loading-text">` y `<div id="loading-spinner">`
- CSS: overlay centrado, `font-family: -apple-system`, `font-weight: 300`, `clamp(1rem, 4vw, 3rem)`, spinner CSS puro con `border-top-color` + animación `@keyframes spin`
- `submit()` activa/desactiva el overlay con `.classList.add/remove('active')`
- Ya no importa `showText` de hydra.js

Durante la carga, el canvas muestra los emojis anteriores (o negro en la primera traducción). El overlay flota encima con z-index:5. Al llegar la respuesta, el overlay desaparece y el canvas hace el crossfade a los nuevos emojis.

---
