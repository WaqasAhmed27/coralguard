import { describe, expect, it } from "vitest";
import { decidePaymentRetry } from "../../services/payments/retry.js";

describe("live demo payment retry guard", () => {
  it("blocks duplicate charge retries when idempotency is missing", () => {
    const decision = decidePaymentRetry({
      chargeId: "ch_live_demo_123",
      customerId: "cust_live_demo_456",
      duplicateChargeSeen: true,
      retryCount: 1
    });

    expect(decision.allowRetry).toBe(false);
  });
});
