// One place that turns a downloaded file into a terminal mode + the byte stream to send.
// Used by the board's viewer, /lab, /gallery and the share card, so they always agree.
import { parseSauce, type Sauce } from "./sauce";
import { binaryKind, cellsToAnsi, decodeBinary } from "./formats";
import type { TermMode } from "./terminal";

export function modeFor(name: string, s: Sauce | null): TermMode {
  const isBin = /\.bin$/i.test(name);
  let cols = 80;
  if (s) {
    if (isBin && s.dataType === 5 && s.fileType > 0) cols = s.fileType * 2;
    else if (isBin && s.tInfo1 >= 40) cols = s.tInfo1;
    else if (s.dataType === 1 && s.tInfo1 > 80 && s.tInfo1 <= 320 && (s.fileType === 1 || s.fileType === 2)) cols = s.tInfo1;
  } else if (isBin) cols = 160;
  return { cols, ice: /\.ice$/i.test(name) || isBin || !!s?.ice, ninePixel: s?.letterSpacing !== 8 };
}

export interface Prepared { mode: TermMode; stream: Uint8Array; sauce: Sauce | null; format: string }

export function prepareArt(name: string, bytes: Uint8Array): Prepared {
  const art = parseSauce(bytes);
  let mode = modeFor(name, art.sauce);
  if (!binaryKind(name)) return { mode, stream: art.body, sauce: art.sauce, format: /\.ice$/i.test(name) ? "iCE" : "ANSI" };
  const img = decodeBinary(name, art.raw, mode.cols);
  mode = {
    cols: Math.max(40, Math.min(320, img.cols)), ice: img.ice || mode.ice,
    ninePixel: img.font ? false : mode.ninePixel, palette: img.palette ?? null, font: img.font ?? null,
  };
  return { mode, stream: cellsToAnsi(img.cells, img.cols, img.rows), sauce: art.sauce, format: img.format };
}
