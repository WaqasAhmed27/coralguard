export type RetryDecision = {
  shouldRetry: boolean;
  retryAfterMs: number;
  idempotencyKey: string;
};

export function decidePaymentRetry(attempt: number, paymentIntentId: string): RetryDecision {
  const retryAfterMs = Math.min(30_000, 500 * 2 ** attempt);

  return {
    shouldRetry: attempt < 4,
    retryAfterMs,
    idempotencyKey: `${paymentIntentId}:${Date.now()}`
  };
}
