import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArtCanvas } from "./ArtCanvas";
import type { PackInfo } from "@/data/types";

interface Props { pack: string; year: number; number?: string }

interface Piece { name: string; title: string; artist: string; group: string; bytes: Uint8Array | null; error?: string }

/** Plain, screen-reader-friendly list of a pack: credits as real text, each piece drawn on a canvas. */
export function GalleryPack({ pack, year, number = "555-0142" }: Props) {
  const [info, setInfo] = useState<PackInfo | null>(null);
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const [{ getPack, getFile }, { parseSauce }] = await Promise.all([import("@/data/archive"), import("@/term/sauce")]);
        const p = await getPack(pack);
        if (!live) return;
        setInfo(p);
        const files = p.files.filter((f) => f.viewable && !/^file_id\.diz$/i.test(f.name));
        setPieces(files.map((f) => ({ name: f.name, title: f.name, artist: f.artists.join(", "), group: p.groups.join(", "), bytes: null })));
        // one at a time: polite to the archive
        for (const f of files) {
          let bytes: Uint8Array | null = null, err: string | undefined;
          try { bytes = await getFile(p.name, f.name); } catch (e) { err = (e as Error).message; }
          if (!live) return;
          const s = bytes ? parseSauce(bytes).sauce : null;
          setPieces((list) => list.map((x) => x.name === f.name ? { ...x, bytes, error: err, title: s?.title || x.title, artist: s?.author || x.artist, group: s?.group || x.group } : x));
        }
      } catch (e) { if (live) setError((e as Error).message); }
    })();
    return () => { live = false; };
  }, [pack]);

  if (error) return <p role="alert">This pack could not be loaded ({error}).</p>;
  if (!info) return <p aria-live="polite">Loading the pack listing…</p>;
  return (
    <section aria-labelledby="pack-h">
      <h2 id="pack-h">{info.name.toUpperCase()} <span className="gallery-sub">({info.year}{info.groups.length ? `, ${info.groups.join(", ")}` : ""})</span></h2>
      <ol className="gallery-list">
        {pieces.map((p) => {
          const credit = `${p.title} by ${p.artist || "unknown artist"}${p.group ? ` of ${p.group}` : ""}, pack ${info.name.toUpperCase()}, ${info.year}`;
          return (
            <li key={p.name} className="gallery-item">
              <h3>{p.title}</h3>
              <dl>
                <dt>Artist</dt><dd>{p.artist || "unknown"}</dd>
                <dt>Group</dt><dd>{p.group || "unknown"}</dd>
                <dt>Year</dt><dd>{info.year}</dd>
                <dt>File</dt><dd>{p.name}</dd>
              </dl>
              {p.error ? <p>Could not fetch this file ({p.error}).</p> : p.bytes ? <ArtCanvas name={p.name} bytes={p.bytes} label={credit} /> : <p aria-live="polite">Fetching…</p>}
              <p><Link to="/dial/$number/$year/$pack/$file" params={{ number, year: String(info.year || year), pack: info.name, file: p.name }}>Watch it draw at modem speed in the full experience</Link></p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
