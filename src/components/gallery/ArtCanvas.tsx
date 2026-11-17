import { useEffect, useRef, useState } from "react";

interface Props { name: string; bytes: Uint8Array | null; label: string }

/** A whole piece drawn instantly by our text-mode renderer on a plain canvas: no CRT, no modem. */
export function ArtCanvas({ name, bytes, label }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!bytes || !ref.current) return;
    let live = true;
    void (async () => {
      try {
        const [{ Terminal }, { prepareArt }, { rasterize }] = await Promise.all([import("@/term/terminal"), import("@/term/prepare"), import("@/term/raster")]);
        if (!live || !ref.current) return;
        const prep = prepareArt(name, bytes);
        const t = new Terminal(prep.mode);
        t.setMode(prep.mode);
        t.feed(prep.stream);
        // trim trailing blank rows
        let last = t.lines.length - 1;
        while (last > 0 && t.lines[last].every((c) => (c & 0xff) === 0x20 && ((c >> 12) & 7) === 0)) last--;
        const { fb, fw, fh } = rasterize(t, Math.min(last + 1, 2400));
        const c = ref.current;
        c.width = fw; c.height = fh;
        const ctx = c.getContext("2d")!;
        const img = ctx.createImageData(fw, fh);
        for (let i = 0, j = 0; i < fb.length; i += 3, j += 4) { img.data[j] = fb[i]; img.data[j + 1] = fb[i + 1]; img.data[j + 2] = fb[i + 2]; img.data[j + 3] = 255; }
        ctx.putImageData(img, 0, 0);
      } catch (e) { setErr((e as Error).message); }
    })();
    return () => { live = false; };
  }, [name, bytes]);
  if (err) return <p className="gallery-err">Could not draw {name}: {err}</p>;
  return <canvas ref={ref} className="gallery-canvas" role="img" aria-label={label} />;
}
