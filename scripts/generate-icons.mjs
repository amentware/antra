/**
 * Antra — icon & splash generator.
 *
 * Zero native dependencies: this rasterises the "A" mark into an RGBA buffer
 * and encodes real PNGs using Node's built-in zlib. Run with:
 *
 *   npm run icons
 *
 * Outputs live in `public/` so Vite copies them verbatim into `dist/`.
 */
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const publicDir = resolve(here, '..', 'public')

// ---------------------------------------------------------------------------
// PNG encoding
// ---------------------------------------------------------------------------
const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii')
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 0)
  return Buffer.concat([length, typeBytes, data, crcBuf])
}

/** Encode an RGBA Uint8ClampedArray (width*height*4) as a PNG buffer. */
function encodePng(rgba, width, height) {
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 4 + 1)
    raw[rowStart] = 0 // filter: none
    for (let x = 0; x < width * 4; x++) raw[rowStart + 1 + x] = rgba[y * width * 4 + x]
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // colour type: RGBA
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ---------------------------------------------------------------------------
// Tiny raster helpers
// ---------------------------------------------------------------------------
function hexToRgb(hex) {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

function blend(px, offset, r, g, b, a) {
  if (a <= 0) return
  const inv = 1 - a
  px[offset] = px[offset] * inv + r * a
  px[offset + 1] = px[offset + 1] * inv + g * a
  px[offset + 2] = px[offset + 2] * inv + b * a
  px[offset + 3] = Math.min(255, px[offset + 3] * inv + 255 * a)
}

function fillBackground(px, width, height, topHex, bottomHex) {
  const [r1, g1, b1] = hexToRgb(topHex)
  const [r2, g2, b2] = hexToRgb(bottomHex)
  for (let y = 0; y < height; y++) {
    const t = height > 1 ? y / (height - 1) : 0
    const r = r1 + (r2 - r1) * t
    const g = g1 + (g2 - g1) * t
    const b = b1 + (b2 - b1) * t
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4
      px[o] = r
      px[o + 1] = g
      px[o + 2] = b
      px[o + 3] = 255
    }
  }
}

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

function distanceToSegment(px_, py, x1, y1, x2, y2) {
  const dx = x2 - x1
  const dy = y2 - y1
  const lenSq = dx * dx + dy * dy
  let t = lenSq === 0 ? 0 : ((px_ - x1) * dx + (py - y1) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  const cx = x1 + t * dx
  const cy = y1 + t * dy
  return Math.hypot(px_ - cx, py - cy)
}

/** Draw an anti-aliased thick line segment. */
function strokeSegment(px, width, height, x1, y1, x2, y2, thickness, hex, alpha = 1) {
  const [r, g, b] = hexToRgb(hex)
  const half = thickness / 2
  const minX = Math.max(0, Math.floor(Math.min(x1, x2) - half - 2))
  const maxX = Math.min(width - 1, Math.ceil(Math.max(x1, x2) + half + 2))
  const minY = Math.max(0, Math.floor(Math.min(y1, y2) - half - 2))
  const maxY = Math.min(height - 1, Math.ceil(Math.max(y1, y2) + half + 2))
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const d = distanceToSegment(x + 0.5, y + 0.5, x1, y1, x2, y2)
      const cov = 1 - smoothstep(half - 1, half + 1, d)
      if (cov > 0) blend(px, (y * width + x) * 4, r, g, b, cov * alpha)
    }
  }
}

/**
 * Draw the Antra "A" mark inside a box. `box` = {cx, cy, size} where size is the
 * mark's height. Returns nothing; mutates the pixel buffer.
 */
function drawMark(px, width, height, box, hex) {
  const { cx, cy, size } = box
  const half = size / 2
  const apex = { x: cx, y: cy - half }
  const left = { x: cx - half * 0.82, y: cy + half }
  const right = { x: cx + half * 0.82, y: cy + half }
  const stroke = size * 0.15
  strokeSegment(px, width, height, apex.x, apex.y, left.x, left.y, stroke, hex)
  strokeSegment(px, width, height, apex.x, apex.y, right.x, right.y, stroke, hex)
  // Crossbar sits a little below the middle.
  const barY = cy + half * 0.34
  const barHalf = half * 0.36
  strokeSegment(px, width, height, cx - barHalf, barY, cx + barHalf, barY, stroke * 0.92, hex)
}

function renderIcon(size, { markScale = 0.62, top = '#FF8A3D', bottom = '#F26B1D', mark = '#FFFFFF', pad = 0 } = {}) {
  const px = new Uint8ClampedArray(size * size * 4)
  const inner = size - pad * 2
  const scaledTop = top
  const scaledBottom = bottom
  fillBackground(px, size, size, scaledTop, scaledBottom)
  if (pad > 0) {
    // Clear a transparent border for maskable variants' visual safe zone.
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const inside = x >= pad && y >= pad && x < size - pad && y < size - pad
        if (!inside) {
          const o = (y * size + x) * 4
          px[o] = 0
          px[o + 1] = 0
          px[o + 2] = 0
          px[o + 3] = 0
        }
      }
    }
  }
  drawMark(px, size, size, { cx: size / 2, cy: size / 2, size: inner * markScale }, mark)
  return px
}

function renderSplash(width, height, { bg = '#F5F5F7', mark = '#F26B1D', markScale = 0.16 } = {}) {
  const px = new Uint8ClampedArray(width * height * 4)
  fillBackground(px, width, height, bg, bg)
  drawMark(px, width, height, { cx: width / 2, cy: height / 2, size: width * markScale }, mark)
  return px
}

function write(path, px, width, height) {
  const buf = encodePng(px, width, height)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, buf)
  return buf.length
}

// ---------------------------------------------------------------------------
// Generate
// ---------------------------------------------------------------------------
const outputs = []

function out(relPath, px, w, h) {
  const bytes = write(resolve(publicDir, relPath), px, w, h)
  outputs.push(`${relPath} (${w}×${h}, ${(bytes / 1024).toFixed(1)} KB)`)
}

// Standard icons — full-bleed so iOS/Android apply their own masking.
out('icons/icon-192.png', renderIcon(192), 192, 192)
out('icons/icon-512.png', renderIcon(512), 512, 512)
out('apple-touch-icon.png', renderIcon(180), 180, 180)

// Maskable icons — mark kept inside the ~80% safe zone.
out('icons/maskable-192.png', renderIcon(192, { markScale: 0.46 }), 192, 192)
out('icons/maskable-512.png', renderIcon(512, { markScale: 0.46 }), 512, 512)

// iOS splash screens.
const splashes = [
  [1170, 2532],
  [1179, 2556],
  [1284, 2778],
  [1290, 2796],
  [1125, 2436],
  [750, 1334],
]
for (const [w, h] of splashes) {
  out(`splash/splash-${w}x${h}.png`, renderSplash(w, h), w, h)
}

// A vector favicon for browsers that prefer it.
const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Antra">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FF8A3D"/>
      <stop offset="1" stop-color="#F26B1D"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="16" fill="url(#g)"/>
  <g fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round">
    <path d="M32 14 L16 52"/>
    <path d="M32 14 L48 52"/>
    <path d="M22 40 H42"/>
  </g>
</svg>
`
writeFileSync(resolve(publicDir, 'favicon.svg'), faviconSvg, 'utf8')
outputs.push('favicon.svg')

console.log('Antra icons generated:')
for (const line of outputs) console.log('  •', line)
