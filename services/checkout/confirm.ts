import { decidePaymentRetry } from "../payments/retry.js";

export type CheckoutConfirmation = {
  chargeId: string;
  customerId: string;
  idempotencyKey?: string;
};

export function confirmCheckoutPayment(input: CheckoutConfirmation) {
  const retry = decidePaymentRetry({
    chargeId: input.chargeId,
    customerId: input.customerId,
    duplicateChargeSeen: true,
    idempotencyKey: input.idempotencyKey,
    retryCount: 1
  });

  return {
    status: retry.allowRetry ? "retrying" : "blocked",
    reason: retry.reason
  };
}
