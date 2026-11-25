/**
 * utils_qr.js - Lightweight Pure JavaScript QR Code SVG Generator
 * Generates standards-compliant SVG QR codes for dynamic UPI URLs & digital passes
 */
(function (global) {
  "use strict";

  const GF256 = new Uint8Array(512);
  const LOG = new Uint8Array(256);
  for (let i = 0, x = 1; i < 255; i++) {
    GF256[i] = GF256[i + 255] = x;
    LOG[x] = i;
    x = (x << 1) ^ (x >= 128 ? 0x11d : 0);
  }

  function polyMul(p1, p2) {
    const res = new Uint8Array(p1.length + p2.length - 1);
    for (let i = 0; i < p1.length; i++) {
      for (let j = 0; j < p2.length; j++) {
        if (p1[i] && p2[j]) {
          res[i + j] ^= GF256[LOG[p1[i]] + LOG[p2[j]]];
        }
      }
    }
    return res;
  }

  function getGenerator(degree) {
    let g = new Uint8Array([1]);
    for (let i = 0; i < degree; i++) {
      g = polyMul(g, new Uint8Array([1, GF256[i]]));
    }
    return g;
  }

  // Version 4-M QR Matrix (33x33 modules, capacity 64 data bytes, 36 EC bytes)
  function createQRMatrix(text) {
    const size = 33;
    const matrix = Array.from({ length: size }, () => new Int8Array(size));
    const reserved = Array.from({ length: size }, () => new Uint8Array(size));

    function setModule(r, c, val) {
      matrix[r][c] = val ? 1 : 0;
      reserved[r][c] = 1;
    }

    // 1. Finder patterns (top-left, top-right, bottom-left)
    function addFinder(or, oc) {
      for (let r = -1; r <= 7; r++) {
        for (let c = -1; c <= 7; c++) {
          const row = or + r, col = oc + c;
          if (row < 0 || row >= size || col < 0 || col >= size) continue;
          const isBlack = (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
                          (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
                          (r >= 2 && r <= 4 && c >= 2 && c <= 4);
          setModule(row, col, isBlack);
        }
      }
    }
    addFinder(0, 0);
    addFinder(0, size - 7);
    addFinder(size - 7, 0);

    // 2. Alignment pattern at (26, 26)
    for (let r = -2; r <= 2; r++) {
      for (let c = -2; c <= 2; c++) {
        const isBlack = Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0);
        setModule(26 + r, 26 + c, isBlack);
      }
    }

    // 3. Timing patterns
    for (let i = 8; i < size - 8; i++) {
      if (!reserved[6][i]) setModule(6, i, i % 2 === 0);
      if (!reserved[i][6]) setModule(i, 6, i % 2 === 0);
    }
    setModule(size - 8, 8, 1); // Dark module

    // Reserve format information areas
    for (let i = 0; i < 9; i++) {
      if (i !== 6) { reserved[8][i] = 1; reserved[i][8] = 1; }
    }
    for (let i = 0; i < 8; i++) {
      reserved[8][size - 1 - i] = 1;
      reserved[size - 1 - i][8] = 1;
    }

    // 4. Encode data bits in Byte Mode
    const dataBytes = [];
    let bitBuf = 0b0100, bitLen = 4;
    const str = String(text);
    bitBuf = (bitBuf << 8) | (str.length & 0xff);
    bitLen += 8;

    for (let i = 0; i < str.length; i++) {
      bitBuf = (bitBuf << 8) | (str.charCodeAt(i) & 0xff);
      bitLen += 8;
      while (bitLen >= 8) {
        bitLen -= 8;
        dataBytes.push((bitBuf >> bitLen) & 0xff);
      }
    }
    if (bitLen > 0) dataBytes.push((bitBuf << (8 - bitLen)) & 0xff);

    // Pad to 64 bytes
    const pad = [0xec, 0x11];
    let pIdx = 0;
    while (dataBytes.length < 64) {
      dataBytes.push(pad[pIdx++ % 2]);
    }

    // 5. Calculate Reed-Solomon EC bytes
    const gen = getGenerator(18);
    function calcEC(bytes) {
      const msg = new Uint8Array(bytes.length + 18);
      msg.set(bytes);
      for (let i = 0; i < bytes.length; i++) {
        const coef = msg[i];
        if (coef !== 0) {
          const logC = LOG[coef];
          for (let j = 0; j < gen.length; j++) {
            msg[i + j] ^= GF256[logC + LOG[gen[j]]];
          }
        }
      }
      return msg.slice(bytes.length);
    }

    const b1Data = dataBytes.slice(0, 32);
    const b2Data = dataBytes.slice(32, 64);
    const b1EC = calcEC(b1Data);
    const b2EC = calcEC(b2Data);

    const allCodewords = [];
    for (let i = 0; i < 32; i++) allCodewords.push(b1Data[i], b2Data[i]);
    for (let i = 0; i < 18; i++) allCodewords.push(b1EC[i], b2EC[i]);

    // 6. Place data in matrix
    let bitIndex = 0;
    const totalBits = allCodewords.length * 8;
    let up = true;
    for (let right = size - 1; right > 0; right -= 2) {
      if (right === 6) right--;
      for (let vert = 0; vert < size; vert++) {
        const r = up ? size - 1 - vert : vert;
        for (let col = 0; col < 2; col++) {
          const c = right - col;
          if (!reserved[r][c]) {
            let bit = 0;
            if (bitIndex < totalBits) {
              const byteVal = allCodewords[Math.floor(bitIndex / 8)];
              bit = (byteVal >> (7 - (bitIndex % 8))) & 1;
              bitIndex++;
            }
            const mask = (r + c) % 2 === 0;
            matrix[r][c] = bit ^ (mask ? 1 : 0);
          }
        }
      }
      up = !up;
    }

    // 7. Format info for Mask 0, ECC Level M: 0b101010000010010
    const formatBits = 0b101010000010010;
    for (let i = 0; i < 15; i++) {
      const bit = (formatBits >> (14 - i)) & 1;
      if (i < 6) setModule(8, i, bit);
      else if (i === 6) setModule(8, 7, bit);
      else if (i === 7) setModule(8, 8, bit);
      else if (i === 8) setModule(7, 8, bit);
      else setModule(14 - i, 8, bit);

      if (i < 8) setModule(size - 1 - i, 8, bit);
      else setModule(8, size - 15 + i, bit);
    }

    return matrix;
  }

  function generateQRCodeSVG(text, sizePx = 200) {
    try {
      const matrix = createQRMatrix(text);
      const modCount = matrix.length;
      const margin = 2;
      const totalUnits = modCount + margin * 2;
      const scale = sizePx / totalUnits;

      let pathData = "";
      for (let r = 0; r < modCount; r++) {
        for (let c = 0; c < modCount; c++) {
          if (matrix[r][c]) {
            const x = Math.round((c + margin) * scale);
            const y = Math.round((r + margin) * scale);
            const w = Math.ceil(scale);
            pathData += `M${x},${y}h${w}v${w}h-${w}z `;
          }
        }
      }

      return `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${sizePx} ${sizePx}" width="${sizePx}" height="${sizePx}" class="upi-qr-svg" aria-label="Scan &amp; Pay QR Code">
          <rect width="${sizePx}" height="${sizePx}" fill="#ffffff" rx="14" />
          <path d="${pathData.trim()}" fill="#0d2238" />
        </svg>
      `.trim();
    } catch (_) {
      // Fallback clean SVG QR placeholder
      return `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${sizePx} ${sizePx}" width="${sizePx}" height="${sizePx}" class="upi-qr-svg">
          <rect width="${sizePx}" height="${sizePx}" fill="#ffffff" rx="14" stroke="#d0e3ee" stroke-width="2"/>
          <text x="50%" y="45%" text-anchor="middle" font-size="12" fill="#265074" font-weight="700">UPI SCAN &amp; PAY</text>
          <text x="50%" y="60%" text-anchor="middle" font-size="10" fill="#78afd0">sportsfacility@upi</text>
        </svg>
      `.trim();
    }
  }

  global.generateQRCodeSVG = generateQRCodeSVG;

})(typeof window !== "undefined" ? window : global);
