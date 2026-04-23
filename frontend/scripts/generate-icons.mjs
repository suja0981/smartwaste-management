/**
 * scripts/generate-icons.mjs
 * Resizes public/icons/icon-base.png into every PWA icon size.
 * Run: node scripts/generate-icons.mjs
 * Requires: sharp  (already a Next.js transitive dep — npm i sharp if missing)
 */
import sharp from "sharp"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const src = path.resolve(__dirname, "../public/icons/icon-base.png")
const dst = path.resolve(__dirname, "../public/icons")

const sizes = [72, 96, 128, 192, 384, 512]

for (const size of sizes) {
  await sharp(src)
    .resize(size, size, { fit: "cover" })
    .png()
    .toFile(path.join(dst, `icon-${size}.png`))
  console.log(`✓ icon-${size}.png`)
}

console.log("✅ All PWA icons generated.")
