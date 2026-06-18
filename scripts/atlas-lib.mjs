// Helpers puros para o pipeline de atlas. Sem dependência de jimp (recebem
// buffers RGBA crus), para serem testáveis no Vitest.

/** Retângulos inteiros que cobrem um grid cols×rows sem sobra nem buraco. */
export function cellRects(width, height, cols, rows) {
  const xAt = (c) => Math.round((c * width) / cols);
  const yAt = (r) => Math.round((r * height) / rows);
  const rects = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = xAt(c);
      const y = yAt(r);
      rects.push({ x, y, w: xAt(c + 1) - x, h: yAt(r + 1) - y });
    }
  }
  return rects;
}

/**
 * Bounding box (em coordenadas absolutas do sheet) dos pixels com alpha > threshold
 * dentro de `cell`. `data` é RGBA (Uint8Array/Buffer) de largura `sheetWidth`.
 * Retorna null se a célula for totalmente transparente.
 */
export function alphaBoundingBox(data, sheetWidth, cell, threshold = 8) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let y = cell.y; y < cell.y + cell.h; y++) {
    for (let x = cell.x; x < cell.x + cell.w; x++) {
      const alpha = data[(y * sheetWidth + x) * 4 + 3];
      if (alpha > threshold) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/** Célula uniforme = maior largura/altura entre as bboxes + margem dos dois lados. */
export function uniformCell(bboxes, margin) {
  const maxW = Math.max(...bboxes.map((b) => b.w));
  const maxH = Math.max(...bboxes.map((b) => b.h));
  return { w: maxW + 2 * margin, h: maxH + 2 * margin };
}
