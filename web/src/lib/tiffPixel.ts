import { inflateSync } from "node:zlib";

/** Decode a small single-band GeoTIFF (e.g. a WCS GetCoverage window): strips or tiles,
 *  uncompressed or deflate, horizontal predictor, 16/32-bit int or 32-bit float. Null if unsupported. */
export function readRaster(buf: Buffer): { w: number; h: number; values: number[] } | null {
  const le = buf.toString("latin1", 0, 2) === "II";
  const u16 = (o: number) => (le ? buf.readUInt16LE(o) : buf.readUInt16BE(o));
  const u32 = (o: number) => (le ? buf.readUInt32LE(o) : buf.readUInt32BE(o));
  if (u16(2) !== 42) return null; // not classic TIFF
  const ifd = u32(4);
  const tags: Record<number, number[]> = {};
  for (let i = 0, n = u16(ifd); i < n; i++) {
    const e = ifd + 2 + i * 12;
    const tag = u16(e), type = u16(e + 2), count = u32(e + 4);
    const size = type === 3 ? 2 : 4;
    const at = size * count <= 4 ? e + 8 : u32(e + 8);
    if (type !== 3 && type !== 4) continue; // only SHORT/LONG tags are needed here
    tags[tag] = Array.from({ length: Math.min(count, 4096) }, (_, k) => (type === 3 ? u16(at + 2 * k) : u32(at + 4 * k)));
  }
  const w = tags[256]?.[0], h = tags[257]?.[0];
  if (!w || !h) return null;
  const bits = tags[258]?.[0] ?? 16, fmt = tags[339]?.[0] ?? 1, comp = tags[259]?.[0] ?? 1, pred = tags[317]?.[0] ?? 1;
  const bpp = bits / 8;
  if (![2, 4].includes(bpp) || (comp !== 1 && comp !== 8 && comp !== 32946)) return null;
  const tiled = !!tags[324];
  const offs = tiled ? tags[324] : tags[273], cnts = tiled ? tags[325] : tags[279];
  if (!offs || !cnts) return null;
  const tw = tiled ? tags[322][0] : w;
  const th = tiled ? tags[323][0] : (tags[278]?.[0] ?? h);
  const across = Math.ceil(w / tw);
  const values = new Array<number>(w * h).fill(NaN);
  offs.forEach((off, k) => {
    let d = buf.subarray(off, off + cnts[k]);
    if (comp !== 1) d = inflateSync(d);
    const rd = (i: number) =>
      bpp === 2
        ? fmt === 2 ? (le ? d.readInt16LE(i) : d.readInt16BE(i)) : le ? d.readUInt16LE(i) : d.readUInt16BE(i)
        : fmt === 3 ? (le ? d.readFloatLE(i) : d.readFloatBE(i)) : fmt === 2 ? (le ? d.readInt32LE(i) : d.readInt32BE(i)) : le ? d.readUInt32LE(i) : d.readUInt32BE(i);
    const x0 = tiled ? (k % across) * tw : 0, y0 = tiled ? Math.floor(k / across) * th : k * th;
    for (let r = 0; r < th; r++) {
      let prev = 0;
      for (let c = 0; c < tw; c++) {
        const i = (r * tw + c) * bpp;
        if (i + bpp > d.length) return;
        let v = rd(i);
        if (pred === 2) v = prev = c ? (bpp === 2 && fmt !== 3 ? ((prev + v) << 16) >> 16 : prev + v) : v;
        const x = x0 + c, y = y0 + r;
        if (x < w && y < h) values[y * w + x] = v;
      }
    }
  });
  return { w, h, values };
}

/** The value at the window centre if valid, else the median of the valid pixels (null if none).
 *  `valid` excludes nodata (SoilGrids' map server writes 0 for masked pixels: water, towns, rock). */
export function centreOrMedian(r: { w: number; h: number; values: number[] }, valid = (v: number) => v > 0 && v !== 32767): number | null {
  const c = r.values[Math.floor(r.h / 2) * r.w + Math.floor(r.w / 2)];
  if (valid(c)) return c;
  const ok = r.values.filter((v) => Number.isFinite(v) && valid(v)).sort((a, b) => a - b);
  return ok.length ? ok[Math.floor(ok.length / 2)] : null;
}
