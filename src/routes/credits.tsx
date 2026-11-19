import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/credits")({
  head: () => ({
    meta: [
      { title: "Credits — Dial-Up" },
      { name: "description", content: "Who made the art, who preserved it, and the font and tools behind Dial-Up, a non-commercial ANSI art BBS experience." },
      { property: "og:title", content: "Credits — Dial-Up" },
      { property: "og:description", content: "The art belongs to its artists. Archives preserved by Sixteen Colors and artpacks.org." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Credits,
});

function Credits() {
  return (
    <main className="credits-page">
      <h1>Credits</h1>
      <p>Dial-Up is a non-commercial tribute to the BBS and ANSI art scene of the early 1990s.</p>
      <h2>The art</h2>
      <p>Every piece of art shown belongs to its artists and their groups. The artist, group, pack and year are shown for every piece: press <kbd>I</kbd> in the viewer.</p>
      <h2>The archives</h2>
      <ul>
        <li>Sixteen Colors (16colo.rs), which preserves the artpacks and their metadata.</li>
        <li>artpacks.org, which kept the packs alive for decades.</li>
      </ul>
      <h2>The font</h2>
      <p>IBM VGA 8x16 glyphs from "The Ultimate Oldschool PC Font Pack" by VileR (int10h.org), licensed CC BY-SA 4.0, via the pcface package.</p>
      <p>Additional VGA50, code-page and Amiga bitmap tables from libansilove, © Stefan Vogt, Brian Cassidy and Frederic Cambus, BSD-2-Clause. License included with this project.</p>
      <h2>Sound</h2>
      <p>Tracker music (.MOD, .S3M, .XM, .IT) plays through libopenmpt by the OpenMPT developers (BSD license), via the chiptune3 package by DrSnuggles (MIT license).</p>
      <p>Every other sound is synthesized live in the browser. No recordings are used.</p>
      <h2>Brands</h2>
      <p>Kestrel, Telewire, Corvid, Nitewatch and Zapp are invented. The Crawlspace BBS, its sysop Static and its callers are fictional.</p>
      <h2>Takedown requests</h2>
      <p>If you made a piece shown here and want it removed, write to sysop@ (placeholder address).</p>
      <h2>Plain gallery</h2>
      <p>Prefer the art without the dark room, sound or CRT effects? The <Link to="/gallery">plain gallery</Link> lists every piece with its credits as text.</p>
      <p><Link to="/">Back to the basement</Link></p>
    </main>
  );
}
