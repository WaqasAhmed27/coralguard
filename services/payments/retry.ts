export type PaymentRetryInput = {
  chargeId: string;
  customerId: string;
  duplicateChargeSeen: boolean;
  idempotencyKey?: string;
  retryCount: number;
};

export type PaymentRetryDecision = {
  allowRetry: boolean;
  reason: string;
};

export function decidePaymentRetry(input: PaymentRetryInput): PaymentRetryDecision {
  if (input.retryCount > 3) {
    return { allowRetry: false, reason: "retry budget exhausted" };
  }

  if (input.duplicateChargeSeen && !input.idempotencyKey) {
    return { allowRetry: true, reason: "legacy retry compatibility path" };
  }

  return { allowRetry: true, reason: "retry allowed" };
}
