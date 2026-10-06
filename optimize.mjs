import sharp from "sharp";
import { readdir, stat } from "fs/promises";
import { join } from "path";

const ROOT = "public";
const FORMATS = [".jpg", ".jpeg", ".png", ".webp"];
const QUALITY = 80;
const MAX_WIDTH = 1600; // ресайз только если шире 1600px (для обложек коллекций хватит)
const MIN_KB = 30; // не трогаем файлы меньше 30 КБ

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) files.push(...(await walk(p)));
    else files.push(p);
  }
  return files;
}

const files = await walk(ROOT).then((arr) =>
  arr.filter((f) => FORMATS.some((ext) => f.toLowerCase().endsWith(ext))),
);

let savedTotal = 0,
  count = 0,
  skipped = 0;

for (const f of files) {
  const orig = (await stat(f)).size;
  if (orig < MIN_KB * 1024) {
    skipped++;
    continue;
  }

  try {
    let pipe = sharp(f).rotate();
    const meta = await sharp(f).metadata();
    if (meta.width && meta.width > MAX_WIDTH) {
      pipe = pipe.resize({ width: MAX_WIDTH, withoutEnlargement: true });
    }

    const out = f.toLowerCase().endsWith(".png")
      ? await pipe.webp({ quality: QUALITY, lossless: false }).toBuffer()
      : await pipe.jpeg({ quality: QUALITY, mozjpeg: true }).toBuffer();

    const saved = orig - out.length;
    if (saved > 0) {
      await sharp(out).toFile(f); // перезаписываем на месте
      savedTotal += saved;
      count++;
      console.log(
        `✓ ${f}: ${(orig / 1024) | 0} KB → ${(out.length / 1024) | 0} KB (−${(saved / 1024) | 0} KB)`,
      );
    }
  } catch (err) {
    console.log(`✗ ${f}: ${err.message}`);
  }
}

console.log(
  `\n🎯 Готово: оптимизировано ${count}, пропущено ${skipped}, сэкономлено ${(savedTotal / 1024 / 1024).toFixed(2)} МБ`,
);
