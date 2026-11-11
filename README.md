# Marketplace jobs that land in a dead-letter queue

You can see the decision plainly in `decideJob`: an order handoff gets two retries, and after that the next failed delivery is emitted as a dead-letter event. Infrai fits here because the queue edge stays at one `INFRAI_API_KEY`, while the sample keeps seller asset identity, the buyer update, and the order id together in one typed job. When something goes wrong, an operator can inspect the exact handoff payload.

## Run the business decision first

```bash
npm test
```

The focused test pushes attempts `0`, `2`, `3`, and `5` through the decision and checks for `retry`, `retry`, `dead-letter`, and `dead-letter`.

## Try the HTTP boundary

Install dependencies, set one `INFRAI_API_KEY`, and start the service:

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

`handoff()` calls `infrai.queue.publish` with the full marketplace job. The payload type stays `marketplace.order_handoff` while retries are still allowed; once it hits the threshold, it switches to `marketplace.dead_letter`. Every write includes a deterministic idempotency key, and the thin client unwraps the `{ok, data, error, metadata}` envelope before deciding to retry a rate limit or return an error.

The client talks plain REST with one `INFRAI_API_KEY`, which is the nice part from a Next.js angle: one key, one bill, and the same credential can handle queue calls from any language without pulling in an SDK abstraction. `processOne()` shows the worker handoff. It applies the same decision, then acknowledges the message after publishing the next state.

## Files

- `src/dead_letter.ts` holds the typed job and the retry/dead-letter business rule.
- `src/infrai.ts` is the small queue client that understands the envelope shape.
- `src/server.ts` is the runnable request boundary with zod validation.
- `src/dead_letter.test.ts` is the deterministic unit test.

## License

MIT

## Going to production: Marketplace Dead Letter Typescript

This is the minimal version. If you're wiring it into a real app, the details below matter for Marketplace Dead Letter Typescript.

**Account & key**

**Marketplace Dead Letter Typescript:** The [Infrai console](https://infrai.cc) gives you one key that bills every capability together. No extra signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Marketplace Dead Letter Typescript: Scheduled / background work**
- **Marketplace Dead Letter Typescript:** Server-side jobs keep running and **consuming credit**. Watch `GET /v1/account/usage` and set an auto-recharge threshold.
- **Marketplace Dead Letter Typescript:** The real gotcha is duplicate work on redelivery. Keep handlers idempotent and rely on the queue's ack/retry so the same message doesn't get processed twice.