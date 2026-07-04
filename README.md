# text2emoji

Traducción de texto a pictogramas poéticos para Hydra.

No es una traducción literal palabra por palabra — busca la resonancia emocional y conceptual de una frase y la convierte en una secuencia de emojis que admita múltiples lecturas, como un rebus o un poema visual.

```
"te quiero a morir"  →  🔥❤️💀
"estoy hecho polvo"  →  🌫️⌛
"todo se derrumba"   →  🏛️💨
```

Los emojis se renderizan en un canvas HTML que Hydra recibe como fuente externa `s0`, permitiendo procesar visualmente el resultado en tiempo real.

---

## Requisitos

- [Node.js](https://nodejs.org) v18+
- Acceso a Claude Code (autenticación vía claude.ai — no requiere API key separada)

---

## Instalación

```bash
git clone <repo>
cd text2emoji
npm install
```

Los SVGs de OpenMoji ya están incluidos en `public/openmoji/` (4495 emojis, v17.0.0 color).

---

## Uso

```bash
node server/api.js
```

Abre **http://localhost:3001** en el browser.

### Interfaz

| Elemento | Descripción |
|----------|-------------|
| Input inferior | Escribe una frase y pulsa **Enter** o **→** para traducir |
| Editor Hydra (arriba izquierda) | Escribe el sketch y pulsa **Ctrl+Enter** para ejecutar |
| **Tab** | Oculta/muestra el editor (modo performance) |

### Editor Hydra

Los emojis se cargan en `s0`. Ejemplos de sketches:

```javascript
// directo
src(s0).out(o0)

// banda en la franja inferior
src(s0).scale(1, 0.25).scrollY(0.38).out(o0)

// con saturación
src(s0).saturate(2).contrast(1.2).out(o0)

// caleidoscopio
src(s0).kaleid(6).rotate(0.1, 0.01).out(o0)
```

---

## Arquitectura

```
text2emoji/
├── src/
│   ├── translator/
│   │   ├── prompt.js        # prompt poético — el artefacto central
│   │   └── translator.js    # llamadas a Claude + cache JSON
│   ├── emojis/
│   │   └── loader.js        # carga SVGs de OpenMoji a tamaño exacto
│   └── renderer/
│       ├── canvas.js        # dibuja banda de emojis en canvas
│       └── hydra.js         # conecta canvas → s0
├── server/
│   └── api.js               # servidor único: estáticos + POST /translate
├── public/
│   ├── openmoji/            # 4495 SVGs (OpenMoji v17.0.0 color)
│   ├── data/
│   │   └── openmoji.json    # metadata de emojis (lookup emoji → hexcode)
│   └── index.html           # UI + Hydra
└── data/
    └── translations.json    # cache de traducciones (crece con el uso)
```

### Flujo de traducción

```
texto → POST /translate → Claude Code CLI (--print)
      → respuesta emoji string → cache en translations.json
      → fetch SVG por emoji → inject width/height en XML
      → rasterizar a canvas full-viewport × dpr
      → Hydra lee canvas como s0 cada frame
```

### Decisiones técnicas

**Sin API key** — el servidor usa el binario de Claude Code local (`claude --print --system-prompt ...`), heredando la autenticación de la sesión activa. No se necesita `ANTHROPIC_API_KEY`.

**Cache persistente** — las traducciones se guardan en `data/translations.json`. Las frases ya traducidas responden sin llamada a la IA.

**SVGs nítidos** — los SVGs de OpenMoji tienen `viewBox="0 0 72 72"` sin dimensiones explícitas. El loader inyecta `width`/`height` en el XML antes de rasterizar para evitar upscaling desde 72px.

**Canvas full-res** — el canvas de emojis se crea a `innerWidth × innerHeight × devicePixelRatio` para que Hydra lo mapee 1:1 sin escalar.

---

## Prompt

El prompt está en [`src/translator/prompt.js`](src/translator/prompt.js). Es el artefacto más importante del proyecto — ajustarlo cambia radicalmente el carácter de las traducciones.

El criterio actual prioriza **ambigüedad poética** sobre claridad: metáforas visuales, resonancia emocional, espacio para la interpretación del espectador.

---

## Créditos

- Emojis: [OpenMoji](https://openmoji.org) — CC BY-SA 4.0
- Síntesis visual: [Hydra](https://hydra.ojack.xyz) — Olivia Jack
- Traducción: [Claude](https://anthropic.com) — Anthropic
