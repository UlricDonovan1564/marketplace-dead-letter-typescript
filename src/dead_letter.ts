import { infrai } from "./infrai.ts";

export type MarketplaceJob = {
  orderId: string;
  sellerAssetId: string;
  buyerUpdate: string;
  attempts: number;
};

export type JobDecision = "retry" | "dead-letter";

export function decideJob(attempts: number, maxAttempts = 3): JobDecision {
  return attempts < maxAttempts ? "retry" : "dead-letter";
}

export async function handoff(job: MarketplaceJob): Promise<JobDecision> {
  const decision = decideJob(job.attempts);
  const payload = { type: decision === "dead-letter" ? "marketplace.dead_letter" : "marketplace.order_handoff", job };
  await infrai.queue.publish(payload, `${payload.type}-${job.orderId}-${job.attempts}`);
  return decision;
}

export async function processOne(message: { message_id: string; payload: MarketplaceJob }): Promise<JobDecision> {
  const decision = await handoff(message.payload);
  await infrai.queue.ack(message.message_id);
  return decision;
}
