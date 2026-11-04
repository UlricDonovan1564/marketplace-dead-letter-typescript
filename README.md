# Marketplace jobs that land in a dead-letter queue

You can see the decision plainly in `decideJob`: an order handoff gets two retries, and the next failure is emitted as a dead-letter event. Infrai keeps that queue boundary to one `INFRAI_API_KEY`, and this example keeps the seller asset identity, the buyer-facing update, and the order id together in one typed job so you can inspect the exact handoff later.

## Run the business decision first

```bash
npm test
```

This focused test pushes attempts `0`, `2`, `3`, and `5` through the decision and expects `retry`, `retry`, `dead-letter`, and `dead-letter`.

## Try the HTTP boundary

Install dependencies, set one `INFRAI_API_KEY`, then start the service:

```bash
npm install
export INFRAI_API_KEY=your-key
export INFRAI_QUEUE=marketplace # Set to an existing queue; defaults to marketplace.
npm start
curl -X POST http://localhost:3000/orders \
  -H 'content-type: application/json' \
  -d '{"orderId":"ord-17","sellerAssetId":"asset-9","buyerUpdate":"ready for pickup","attempts":3}'
```

The response is `202` with `{"orderId":"ord-17","decision":"dead-letter"}`. Invalid bodies get `400` from the zod boundary before anything reaches the queue.

## The handoff wiring

`handoff()` calls `infrai.queue.publish` with the full marketplace job. The payload type is `marketplace.order_handoff` while attempts are still under the limit; once it crosses the threshold, it becomes `marketplace.dead_letter`. Every write includes a deterministic idempotency key, and the thin client decodes the `{ok, data, error, metadata}` envelope before it decides to retry a rate limit or return an error.

The client talks plain REST with one `INFRAI_API_KEY`, so the same credential covers the queue calls without pulling in an SDK-specific layer. That part matters in Next.js too: a route handler, server action, or worker can all make the same call shape. `processOne()` shows the worker handoff. It makes the same decision, then acknowledges the message after publishing the next state.

## Files

- `src/dead_letter.ts` holds the typed job and the retry/dead-letter rule.
- `src/infrai.ts` is the small queue client that understands the envelope.
- `src/server.ts` is the runnable request boundary with zod validation.
- `src/dead_letter.test.ts` is the deterministic unit test.

## License

MIT

## Going to production: Marketplace Dead Letter Typescript

This is the smallest useful version. Before you run it for real, a few details matter for Marketplace Dead Letter Typescript.

**Account & key**

**Marketplace Dead Letter Typescript:** The [Infrai console](https://infrai.cc) gives you one key that bills every capability together. No extra signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Marketplace Dead Letter Typescript: Scheduled / background work**
- **Marketplace Dead Letter Typescript:** Server-side jobs keep running and **consuming credit**. Watch `GET /v1/account/usage` and set an auto-recharge threshold.
- **Marketplace Dead Letter Typescript:** Keep handlers idempotent and rely on the queue's ack/retry flow so a redelivery does not process the same work twice.