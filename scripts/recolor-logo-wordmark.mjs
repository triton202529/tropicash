/**
 * Restores public/tropicash-logo-*.png from git originals and applies
 * transparent backgrounds plus #159669 wordmark color.
 */
import sharp from "sharp";
import { execSync } from "child_process";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const GIT_SOURCE = "e8bab9d";
const BRAND_GREEN = { r: 0x15, g: 0x96, b: 0x69 };

const FILES = ["tropicash-logo-dark.png", "tropicash-logo-light.png"];

execSync(`git restore --source=${GIT_SOURCE} --worktree -- ${FILES.map((f) => `public/${f}`).join(" ")}`, {
  cwd: ROOT,
  stdio: "inherit",
});

function isNavyWordmarkPixel(r, g, b, a) {
  if (a < 40) return false;
  return b > r + 25 && b > g + 15 && r < 90 && g < 90 && b > 70 && b < 200;
}

function isBackgroundPixel(r, g, b, a) {
  if (a < 40) return false;
  if (r < 24 && g < 24 && b < 24) return true;
  return r > 245 && g > 245 && b > 245;
}

function floodClearBackground(data, width, height) {
  const visited = new Uint8Array(width * height);
  const queue = [];

  const tryPush = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const idx = y * width + x;
    if (visited[idx]) return;
    const i = idx * 4;
    if (!isBackgroundPixel(data[i], data[i + 1], data[i + 2], data[i + 3])) return;
    visited[idx] = 1;
    queue.push(idx);
  };

  for (let x = 0; x < width; x++) {
    tryPush(x, 0);
    tryPush(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    tryPush(0, y);
    tryPush(width - 1, y);
  }

  while (queue.length) {
    const idx = queue.pop();
    const i = idx * 4;
    data[i + 3] = 0;
    const x = idx % width;
    const y = (idx - x) / width;
    tryPush(x - 1, y);
    tryPush(x + 1, y);
    tryPush(x, y - 1);
    tryPush(x, y + 1);
  }
}

async function processLogo(name) {
  const path = join(ROOT, "public", name);
  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const wordmarkMinX = Math.floor(width * 0.34);

  floodClearBackground(data, width, height);

  for (let y = 0; y < height; y++) {
    for (let x = wordmarkMinX; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (!isNavyWordmarkPixel(r, g, b, a)) continue;
      data[i] = BRAND_GREEN.r;
      data[i + 1] = BRAND_GREEN.g;
      data[i + 2] = BRAND_GREEN.b;
    }
  }

  await sharp(data, { raw: { width, height, channels: 4 } }).png().toFile(path);
  console.log("Processed", path);
}

await processLogo("tropicash-logo-light.png");
// Homepage expects horizontal logo; git dark asset is portrait — reuse light export.
await sharp(join(ROOT, "public", "tropicash-logo-light.png")).toFile(
  join(ROOT, "public", "tropicash-logo-dark.png")
);
console.log("Copied light logo to tropicash-logo-dark.png");
