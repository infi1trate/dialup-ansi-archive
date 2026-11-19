import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { GalleryPack } from "@/components/gallery/GalleryPack";

export const Route = createFileRoute("/gallery")({
  head: () => ({
    meta: [
      { title: "Plain gallery — Dial-Up" },
      { name: "description", content: "A plain, fast, screen-reader-friendly list of DEAD CARRIER house pack and any ANSI art pack, with title, artist, group and year as text." },
      { property: "og:title", content: "Plain gallery — Dial-Up" },
      { property: "og:description", content: "ANSI art without the basement: every piece drawn instantly with full credits as text." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Gallery,
});

function Gallery() {
  const navigate = useNavigate();
  const [year, setYear] = useState("1993");
  const [pack, setPack] = useState("");
  return (
    <main className="credits-page gallery-page">
      <h1>Plain gallery</h1>
      <p>The same art as the BBS, without the dark room, the modem or the CRT effects. Every piece is drawn instantly by the same text-mode renderer. The art belongs to its artists.</p>
      <form className="gallery-form" onSubmit={(e) => { e.preventDefault(); if (/^[A-Za-z0-9._-]+$/.test(pack.trim())) void navigate({ to: "/gallery/$year/$pack", params: { year: year || "1993", pack: pack.trim().toLowerCase() } }); }}>
        <label>Year <input value={year} onChange={(e) => setYear(e.target.value)} inputMode="numeric" size={5} /></label>
        <label>Pack name <input value={pack} onChange={(e) => setPack(e.target.value)} placeholder="acdu0193" /></label>
        <button type="submit">Open pack</button>
      </form>
      <GalleryPack pack="crawl-01" year={1994} />
      <p><Link to="/credits">Credits</Link> · <Link to="/">Back to the basement</Link></p>
    </main>
  );
}
