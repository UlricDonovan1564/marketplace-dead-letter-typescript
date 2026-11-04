import { createServer } from "node:http";
import { z } from "zod";
import { handoff, type MarketplaceJob } from "./dead_letter.ts";

const orderBody = z.object({
  orderId: z.string().min(1),
  sellerAssetId: z.string().min(1),
  buyerUpdate: z.string().min(1),
  attempts: z.number().int().nonnegative().default(0)
});

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/orders") {
    response.writeHead(404).end();
    return;
  }
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  let body: unknown;
  try {
    body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    response.writeHead(400, { "content-type": "application/json" }).end(JSON.stringify({ error: "Invalid JSON" }));
    return;
  }
  const parsed = orderBody.safeParse(body);
  if (!parsed.success) {
    response.writeHead(400, { "content-type": "application/json" }).end(JSON.stringify({ error: parsed.error.flatten() }));
    return;
  }
  const job = parsed.data as MarketplaceJob;
  const decision = await handoff(job);
  response.writeHead(202, { "content-type": "application/json" }).end(JSON.stringify({ orderId: parsed.data.orderId, decision }));
});

server.listen(Number(process.env.PORT ?? 3000), () => console.log("marketplace handoff listening"));
