import { createFileRoute } from "@tanstack/react-router";
import { Computer } from "@/components/machine/Computer";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dial-Up" },
      { name: "description", content: "Power on a 486, dial a 1990s bulletin board and watch real ANSI art from the scene archive draw at modem speed." },
      { property: "og:title", content: "Dial-Up — call The Crawlspace BBS" },
      { property: "og:description", content: "An early-90s BBS in your browser: dial in, browse the ANSI art archive, watch it stream at 9600 baud." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return <Computer />;
}
