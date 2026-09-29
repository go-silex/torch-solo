import { NextRequest } from "next/server";
import { getStore } from "@/lib/vault/store";

export const dynamic = "force-dynamic";

/** SSE : notifie l'UI quand une note change (watcher ou écriture d'une autre vue). */
export async function GET(req: NextRequest) {
  const store = await getStore();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const onChange = (event: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      store.on("change", onChange);
      const keepalive = setInterval(() => {
        controller.enqueue(encoder.encode(": keepalive\n\n"));
      }, 25000);

      req.signal.addEventListener("abort", () => {
        clearInterval(keepalive);
        store.off("change", onChange);
        try {
          controller.close();
        } catch {
          // déjà fermé
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
