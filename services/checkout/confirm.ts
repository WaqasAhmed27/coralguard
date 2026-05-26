import { decidePaymentRetry } from "../payments/retry";

export async function confirmCheckout(paymentIntentId: string, attempt: number) {
  const retry = decidePaymentRetry(attempt, paymentIntentId);

  return {
    paymentIntentId,
    retry,
    status: retry.shouldRetry ? "retrying" : "failed"
  };
}
