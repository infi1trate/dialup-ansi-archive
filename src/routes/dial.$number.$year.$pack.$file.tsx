import { createFileRoute } from "@tanstack/react-router";
import { Computer } from "@/components/machine/Computer";

export const Route = createFileRoute("/dial/$number/$year/$pack/$file")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.file} from ${params.pack} — Dial-Up` },
      { name: "description", content: `Dial ${params.number} and watch ${params.file} (${params.pack}, ${params.year}) stream in at modem speed.` },
      { property: "og:title", content: `${params.file} · ${params.pack} — Dial-Up` },
      { property: "og:description", content: `ANSI art from ${params.year}, sent byte by byte over a simulated modem.` },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DeepLinkPage,
});

function DeepLinkPage() {
  const p = Route.useParams();
  return <Computer deepLink={{ number: p.number, year: Number(p.year) || 1993, pack: p.pack, file: p.file }} />;
}
