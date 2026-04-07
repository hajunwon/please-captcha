import sharp from "sharp";

export function toBase64(buffer: Buffer): string {
  return buffer.toString("base64");
}

export async function sliceGrid(
  screenshot: Buffer,
  rows: number,
  cols: number,
): Promise<Buffer[]> {
  const meta = await sharp(screenshot).metadata();
  const w = meta.width!;
  const h = meta.height!;
  const cellW = Math.floor(w / cols);
  const cellH = Math.floor(h / rows);

  const cells: Buffer[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = await sharp(screenshot)
        .extract({
          left: c * cellW,
          top: r * cellH,
          width: cellW,
          height: cellH,
        })
        .png()
        .toBuffer();
      cells.push(cell);
    }
  }
  return cells;
}

export async function resizeIfNeeded(
  buffer: Buffer,
  maxDim = 1024,
): Promise<Buffer> {
  const meta = await sharp(buffer).metadata();
  if ((meta.width ?? 0) <= maxDim && (meta.height ?? 0) <= maxDim) {
    return buffer;
  }
  return sharp(buffer)
    .resize(maxDim, maxDim, { fit: "inside" })
    .png()
    .toBuffer();
}
