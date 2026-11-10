#!/usr/bin/env node
'use strict';
/**
 * 预压缩静态资源。
 *
 * 目的：学生机首次进入 Godot 关卡需下载 index.wasm + index.pck 共约 64 MB，
 * 在教室无线网下明显偏慢。wasm 的 gzip 压缩率约 74%（37.7 MB -> 9.7 MB），
 * 因此构建后为可压缩文件生成 .gz 伴生文件，由 server.cjs 按 Accept-Encoding 直接发送，
 * 运行时不做实时压缩，避免每次请求都占用 CPU。
 *
 * 收益不足 MIN_GAIN 的文件不生成（例如 index.pck 内部已是压缩资源，gzip 后无变化）。
 * 由 `npm run build` 自动调用，也可单独执行：node tools/precompress.cjs
 */
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const BASE = path.join(__dirname, '..');
const MIN_GAIN = 0.1;
const MIN_SIZE = 8 * 1024;

const TARGETS = [
  { dir: 'public/godot', exts: ['.wasm', '.js', '.html'] },
  { dir: 'dist/godot', exts: ['.wasm', '.js', '.html'] },
  { dir: 'dist/assets', exts: ['.js', '.css', '.svg', '.json'] },
  { dir: 'dist/lesson', exts: ['.svg', '.json'] },
];

function listFiles(dir, exts) {
  const out = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listFiles(full, exts));
      continue;
    }
    if (!entry.isFile()) continue;
    if (entry.name.endsWith('.gz')) continue;
    if (exts.includes(path.extname(entry.name).toLowerCase())) out.push(full);
  }
  return out;
}

let totalBefore = 0;
let totalAfter = 0;
let written = 0;
let skipped = 0;

for (const target of TARGETS) {
  const absDir = path.join(BASE, target.dir);
  for (const file of listFiles(absDir, target.exts)) {
    const gzPath = file + '.gz';
    const srcStat = fs.statSync(file);
    if (srcStat.size < MIN_SIZE) continue;

    let gzStat = null;
    try {
      gzStat = fs.statSync(gzPath);
    } catch {
      gzStat = null;
    }
    // 伴生文件比源文件新则复用，避免每次构建重复压缩
    if (gzStat && gzStat.mtimeMs >= srcStat.mtimeMs) {
      totalBefore += srcStat.size;
      totalAfter += gzStat.size;
      skipped += 1;
      continue;
    }

    const buffer = fs.readFileSync(file);
    const gz = zlib.gzipSync(buffer, { level: 9 });
    const gain = 1 - gz.length / buffer.length;
    if (gain < MIN_GAIN) {
      // 压缩无收益（如已压缩的媒体资源），删除可能残留的旧文件
      if (gzStat) fs.rmSync(gzPath, { force: true });
      skipped += 1;
      continue;
    }
    fs.writeFileSync(gzPath, gz);
    totalBefore += buffer.length;
    totalAfter += gz.length;
    written += 1;
    console.log(
      `  压缩 ${path.relative(BASE, file).split(path.sep).join('/')}  ` +
        `${(buffer.length / 1048576).toFixed(1)}MB -> ${(gz.length / 1048576).toFixed(1)}MB  (省 ${(gain * 100).toFixed(0)}%)`
    );
  }
}

if (written === 0 && skipped === 0) {
  console.log('  没有需要压缩的静态资源');
} else {
  const saved = totalBefore - totalAfter;
  console.log(
    `  预压缩完成：${written} 个文件新生成，${skipped} 个跳过` +
      (totalBefore ? `；命中压缩的文件共 ${(totalBefore / 1048576).toFixed(1)}MB -> ${(totalAfter / 1048576).toFixed(1)}MB，省 ${(saved / 1048576).toFixed(1)}MB` : '')
  );
}
