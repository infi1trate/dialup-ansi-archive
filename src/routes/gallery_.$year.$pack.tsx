import { createFileRoute, Link } from "@tanstack/react-router";
import { GalleryPack } from "@/components/gallery/GalleryPack";

export const Route = createFileRoute("/gallery_/$year/$pack")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.pack.toUpperCase()} (${params.year}) — Dial-Up plain gallery` },
      { name: "description", content: `Every piece in the ${params.pack} art pack from ${params.year}, drawn instantly with artist, group and year as text.` },
      { property: "og:title", content: `${params.pack.toUpperCase()} (${params.year}) — Dial-Up plain gallery` },
      { property: "og:description", content: `ANSI art from ${params.pack}, ${params.year}. The art belongs to its artists.` },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PackPage,
});

function PackPage() {
  const { year, pack } = Route.useParams();
  return (
    <main className="credits-page gallery-page">
      <p><Link to="/gallery">Plain gallery</Link></p>
      <h1>Plain gallery</h1>
      <GalleryPack pack={pack} year={Number(year) || 1993} />
      <p><Link to="/credits">Credits</Link> · <Link to="/">Back to the basement</Link></p>
    </main>
  );
}
