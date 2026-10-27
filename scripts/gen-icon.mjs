// 生成 1024x1024 应用图标源文件：墨金底 + 紫微星 + 十二地支环。
// 纯 Node 内置模块（zlib 手写 PNG 编码），零第三方依赖 —— 遵守「不安装任何软件」约束。
// 产物 scripts/icon-source.png 随后由 `npm run tauri icon` 展开为全套格式。
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

const S = 1024; // 输出尺寸
const SS = 2; // 2x 超采样抗锯齿

// ── 最小 PNG 写入器 ─────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

// ── 绘图（纯数学，无图像库）──────────────────────────────────────
const BG_IN = [30, 24, 16]; // 底色（中心，墨色暖调）
const BG_OUT = [13, 10, 7]; // 底色（边缘，暗角）
const GOLD = [212, 168, 67]; // 墨金（与前端 --ac 暗色值一致）
const GOLD_HI = [232, 196, 110]; // 亮金（地支点）

const C = (SS * S) / 2;
const RING_R = 0.375 * SS * S; // 十二宫环半径
const RING_W = 0.011 * SS * S; // 环宽（线性过渡做柔边）
const DOT_R = 0.021 * SS * S; // 十二地支点半径
const STAR_OUT = 0.235 * SS * S; // 中央紫微星外半径
const STAR_IN = 0.094 * SS * S; // 内半径（五角星比例）

// 五角星 10 顶点（从正上方起，外/内交替）
const star = [];
for (let i = 0; i < 10; i++) {
  const ang = -Math.PI / 2 + (i * Math.PI) / 5;
  const r = i % 2 === 0 ? STAR_OUT : STAR_IN;
  star.push([C + r * Math.cos(ang), C + r * Math.sin(ang)]);
}

function inPolygon(x, y) {
  let inside = false;
  for (let i = 0, j = star.length - 1; i < star.length; j = i++) {
    const [xi, yi] = star[i];
    const [xj, yj] = star[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const big = SS * S;
const rgba = Buffer.alloc(big * big * 4);
for (let y = 0; y < big; y++) {
  for (let x = 0; x < big; x++) {
    const dx = x - C;
    const dy = y - C;
    const d = Math.hypot(dx, dy);
    // 背景径向渐变
    const t = Math.min(1, d / (0.72 * SS * S));
    let r = BG_IN[0] + (BG_OUT[0] - BG_IN[0]) * t;
    let g = BG_IN[1] + (BG_OUT[1] - BG_IN[1]) * t;
    let b = BG_IN[2] + (BG_OUT[2] - BG_IN[2]) * t;
    // 十二宫环
    if (Math.abs(d - RING_R) <= RING_W) {
      const e = 1 - Math.abs(d - RING_R) / RING_W;
      r += (GOLD[0] - r) * e;
      g += (GOLD[1] - g) * e;
      b += (GOLD[2] - b) * e;
    }
    // 十二地支点（子位正上起，顺时针）
    for (let k = 0; k < 12; k++) {
      const ang = -Math.PI / 2 + (k * Math.PI) / 6;
      const px = C + RING_R * Math.cos(ang);
      const py = C + RING_R * Math.sin(ang);
      if (Math.hypot(x - px, y - py) <= DOT_R) {
        r = GOLD_HI[0];
        g = GOLD_HI[1];
        b = GOLD_HI[2];
        break;
      }
    }
    // 中央紫微星
    if (inPolygon(x, y)) {
      r = GOLD[0];
      g = GOLD[1];
      b = GOLD[2];
    }
    const o = (y * big + x) * 4;
    rgba[o] = Math.round(r);
    rgba[o + 1] = Math.round(g);
    rgba[o + 2] = Math.round(b);
    rgba[o + 3] = 255;
  }
}

// 2x2 盒式降采样
const out = Buffer.alloc(S * S * 4);
for (let y = 0; y < S; y++) {
  for (let x = 0; x < S; x++) {
    let rr = 0,
      gg = 0,
      bb = 0;
    for (let sy = 0; sy < SS; sy++) {
      for (let sx = 0; sx < SS; sx++) {
        const o = ((y * SS + sy) * big + (x * SS + sx)) * 4;
        rr += rgba[o];
        gg += rgba[o + 1];
        bb += rgba[o + 2];
      }
    }
    const o = (y * S + x) * 4;
    out[o] = Math.round(rr / (SS * SS));
    out[o + 1] = Math.round(gg / (SS * SS));
    out[o + 2] = Math.round(bb / (SS * SS));
    out[o + 3] = 255;
  }
}

writeFileSync(new URL("./icon-source.png", import.meta.url), encodePng(S, S, out));
console.log("wrote scripts/icon-source.png (1024x1024)");
