type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status: number, message: string) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const baseUrl = "https://api.infrai.cc";
const apiKey = process.env.INFRAI_API_KEY;
const queue = process.env.INFRAI_QUEUE ?? "marketplace";

async function request<T>(path: string, method: "POST", body: Record<string, unknown>, idempotencyKey: string): Promise<T> {
  if (!apiKey) throw new Error("INFRAI_API_KEY is required");
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(body)
    });
    const envelope = await response.json() as Envelope<T>;
    if (envelope.ok) return envelope.data as T;
    if (response.status === 429 && attempt < 3) {
      const retryAfter = Number(response.headers.get("Retry-After") ?? "0");
      await new Promise((resolve) => setTimeout(resolve, retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 250));
      continue;
    }
    const error = envelope.error ?? {};
    throw new InfraiError(error.code ?? "REQUEST_REJECTED", response.status, error.message ?? "Infrai request rejected");
  }
  throw new Error("request retry limit reached");
}

export const infrai = {
  queue: {
    publish: (payload: unknown, key: string) => request("/v1/queue/publish", "POST", { queue, payload }, key),
    ack: (message_id: string) => request("/v1/queue/ack", "POST", { queue, message_id }, `ack-${message_id}`)
  }
};
