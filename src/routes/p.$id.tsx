import { createFileRoute } from "@tanstack/react-router";
import { Computer } from "@/components/machine/Computer";
import { getPostcard } from "@/lib/postcard.functions";

const SITE = "https://dialup-ansi-archive.lovable.app";
export const Route = createFileRoute("/p/$id")({
  loader: async ({ params }) => {
    try { return await getPostcard({ data: { id: params.id } }); }
    catch { return { status: "missing" as const, origin: SITE, image: null }; }
  },
  head: ({ params, loaderData }) => {
    const ok = loaderData?.status === "ok" ? loaderData : null;
    const title = ok ? `A postcard from ${ok.card.signature} — Dial-Up` : "No answer — Dial-Up";
    const first = ok?.card.lines.find((l) => l.trim());
    // stored cards all passed the filter, so their text may appear in the description
    const desc = ok ? `${first ? `"${first.trim()}" ` : ""}You have mail. A 1992 PC dials the board and delivers it at 2400 baud.` : "This postcard has expired or was withdrawn. Dial a 1990s BBS anyway.";
    const url = `${SITE}/p/${params.id}`;
    const meta: { title?: string; name?: string; property?: string; content?: string }[] = [
      { title }, { name: "description", content: desc },
      { property: "og:title", content: title }, { property: "og:description", content: desc },
      { property: "og:type", content: "website" }, { property: "og:url", content: url },
      { name: "twitter:card", content: "summary_large_image" }, { name: "twitter:title", content: title }, { name: "twitter:description", content: desc },
    ];
    if (ok?.image) meta.push({ property: "og:image", content: ok.image }, { property: "og:image:width", content: "1200" }, { property: "og:image:height", content: "630" }, { name: "twitter:image", content: ok.image });
    return { meta, links: [{ rel: "canonical", href: url }] };
  },
  component: PostcardPage,
});

function PostcardPage() {
  const d = Route.useLoaderData();
  const { id } = Route.useParams();
  return <Computer key={id} postcard={d.status === "ok" ? { card: d.card, number: d.number } : { missing: d.status }} />;
}
