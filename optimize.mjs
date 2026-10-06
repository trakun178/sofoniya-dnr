import sharp from "sharp";
import { readdir, stat } from "fs/promises";
import { join } from "path";

const FORMATS = [".jpg", ".jpeg", ".png"];
const QUALITY = 80;
const MAX_WIDTH = 1600;
const MIN_KB = 30;

// аргументы: папки или файлы; без аргументов — весь public
const args = process.argv.slice(2);
const targets = args.length ? args : ["public"];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const out = [];
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}

const files = [];
for (const t of targets) {
  const s = await stat(t);
  if (s.isFile()) files.push(t);
  else
    files.push(
      ...(await walk(t)).filter((f) =>
        FORMATS.some((e) => f.toLowerCase().endsWith(e)),
      ),
    );
}

let count = 0,
  savedTotal = 0;
for (const f of files) {
  const orig = (await stat(f)).size;
  if (orig < MIN_KB * 1024) continue;
  try {
    let pipe = sharp(f).rotate();
    const meta = await sharp(f).metadata();
    if (meta.width && meta.width > MAX_WIDTH) {
      pipe = pipe.resize({ width: MAX_WIDTH, withoutEnlargement: true });
    }
    const isPng = f.toLowerCase().endsWith(".png");
    const buf = isPng
      ? await pipe
          .png({ compressionLevel: 9, palette: true, quality: 80 })
          .toBuffer()
      : await pipe.jpeg({ quality: QUALITY, mozjpeg: true }).toBuffer();
    if (orig - buf.length > 0) {
      await sharp(buf).toFile(f + ".opt");
      savedTotal += orig - buf.length;
      count++;
      console.log(
        `✓ ${f}: ${(orig / 1024) | 0} → ${(buf.length / 1024) | 0} KB`,
      );
    }
  } catch (e) {
    console.log(`✗ ${f}: ${e.message}`);
  }
}
console.log(
  `\n🎯 Файлов: ${count}, экономия ${(savedTotal / 1024 / 1024).toFixed(2)} МБ. Теперь запусти замену.`,
);
