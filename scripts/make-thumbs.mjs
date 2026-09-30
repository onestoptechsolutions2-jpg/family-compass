// Small versions of the sample photos for cards: node scripts/make-thumbs.mjs
import fs from "node:fs";
import sharp from "sharp";

const dir = new URL("../public/samples/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".jpg") && !x.startsWith("thumb-"))) {
  const out = `${dir}thumb-${f}`;
  await sharp(`${dir}${f}`).resize({ width: 640, withoutEnlargement: true }).jpeg({ quality: 76, mozjpeg: true }).toFile(out);
  console.log(`thumb-${f}`, (fs.statSync(out).size / 1024).toFixed(0) + " KB");
}
