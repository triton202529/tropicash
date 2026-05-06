/**
 * Generates public/backgrounds/tropicash-bg.png (2048×2048, seamless, transparent outside motifs).
 * Palm/coin only — narrow crop, no wordmark.
 * Run: npm run generate:bg-pattern
 */
import sharp from "sharp";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const TILE = 2048;
/** Peak stamp alpha (~0.62) × CSS layer opacity 0.35 ≈ perceptible ~18–22% on screen */
const SILHOUETTE_ALPHA = 0.62;
const ICON_BLUE = { r: 96, g: 165, b: 250 };
const ICON_TARGET_HEIGHT = 296;
const CROP_WIDTH_RATIO = 0.28;
const ACCENT_DOT = 0.045;
const ACCENT_STAR = 0.038;

function accentSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${TILE}" height="${TILE}">
  <defs>
    <pattern id="d" width="512" height="512" patternUnits="userSpaceOnUse">
      <circle cx="256" cy="256" r="1" fill="rgba(96,165,250,${ACCENT_DOT})"/>
    </pattern>
    <pattern id="s" width="512" height="512" patternUnits="userSpaceOnUse">
      <path d="M256 250 L258 256 L264 256 L258 257 L256 263 L254 257 L248 256 L254 256 Z" fill="rgba(96,165,250,${ACCENT_STAR})"/>
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="url(#d)"/>
  <rect width="100%" height="100%" fill="url(#s)"/>
</svg>`;
}

async function buildIconStamp() {
  const logoPath = join(ROOT, "public", "tropicash_logo_monochrome.png");
  const img = sharp(logoPath);
  const { width, height } = await img.metadata();
  if (!width || !height) throw new Error("Could not read logo dimensions");

  const cw = Math.round(width * CROP_WIDTH_RATIO);
  const { data, info } = await img
    .extract({ left: 0, top: 0, width: cw, height })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const ch = info.channels;
  const out = Buffer.alloc(info.width * info.height * 4);

  for (let i = 0; i < info.width * info.height; i++) {
    const r = data[i * ch];
    const g = data[i * ch + 1];
    const b = data[i * ch + 2];
    const a = ch >= 4 ? data[i * ch + 3] : 255;
    const lum = (r + g + b) / (3 * 255);
    const ink = (1 - lum) * (a / 255);
    out[i * 4] = ICON_BLUE.r;
    out[i * 4 + 1] = ICON_BLUE.g;
    out[i * 4 + 2] = ICON_BLUE.b;
    out[i * 4 + 3] = Math.min(255, Math.round(255 * ink * SILHOUETTE_ALPHA));
  }

  const rawPng = await sharp(out, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer();

  return sharp(rawPng).resize({ height: ICON_TARGET_HEIGHT }).png().toBuffer();
}

async function main() {
  const stamp = await buildIconStamp();
  const sm = await sharp(stamp).metadata();
  const iw = sm.width ?? 0;
  const ih = sm.height ?? 0;

  /** Six large marks, staggered diagonal — ~6–10 read across desktop at 380px tile repeat */
  const centers = [
    [200, 200],
    [1280, 280],
    [740, 820],
    [200, 1460],
    [1280, 1380],
    [740, 1820],
  ];

  const composites = [];
  for (const [cx, cy] of centers) {
    composites.push({
      input: stamp,
      left: Math.round(cx - iw / 2),
      top: Math.round(cy - ih / 2),
    });
  }

  const accents = await sharp(Buffer.from(accentSvg())).resize(TILE, TILE).png().toBuffer();
  composites.push({ input: accents, left: 0, top: 0 });

  const outPath = join(ROOT, "public", "backgrounds", "tropicash-bg.png");

  await sharp({
    create: {
      width: TILE,
      height: TILE,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toFile(outPath);

  console.log("Wrote", outPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
