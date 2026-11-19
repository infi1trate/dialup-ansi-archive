import { createFileRoute } from "@tanstack/react-router";
import { Computer } from "@/components/machine/Computer";
import { getShareMeta } from "@/lib/share.functions";

export const Route = createFileRoute("/dial/$number/$year/$pack/$file")({
  loader: async ({ params }) => {
    try { return await getShareMeta({ data: { pack: params.pack, file: params.file, year: params.year } }); }
    catch { return { line: `${params.file} (${params.pack}, ${params.year})`, card: null as string | null }; }
  },
  head: ({ params, loaderData }) => {
    const line = loaderData?.line ?? `${params.file} (${params.pack}, ${params.year})`;
    const desc = `Dial ${params.number} and watch it stream in at modem speed on DEAD CARRIER.`;
    const meta = [
      { title: `${line} — Dial-Up` },
      { name: "description", content: desc },
      { property: "og:title", content: line },
      { property: "og:description", content: desc },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: line },
      { name: "twitter:description", content: desc },
    ];
    const url = `https://dialup-ansi-archive.lovable.app/dial/${params.number}/${params.year}/${encodeURIComponent(params.pack)}/${encodeURIComponent(params.file)}`;
    meta.push({ property: "og:url", content: url });
    if (loaderData?.card) meta.push({ property: "og:image", content: loaderData.card }, { property: "og:image:width", content: "1200" }, { property: "og:image:height", content: "630" }, { name: "twitter:image", content: loaderData.card });
    return { meta, links: [{ rel: "canonical", href: url }] };
  },
  component: DeepLinkPage,
});

function DeepLinkPage() {
  const p = Route.useParams();
  return <Computer key={`${p.number}/${p.year}/${p.pack}/${p.file}`} deepLink={{ number: p.number, year: Number(p.year) || 1993, pack: p.pack, file: p.file }} />;
}
