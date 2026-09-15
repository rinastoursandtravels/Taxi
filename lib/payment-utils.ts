/**
 * Payment utility functions (CLIENT-SIDE SAFE)
 * These functions contain no server dependencies and can be used in client components
 */

/**
 * Calculate online and cash payment amounts based on payment type.
 *
 * LEGACY. The 30% advance was removed — new bookings are either paid in full
 * online or submitted unpaid and settled in cash. The 'partial' branch is kept
 * only so historic 30% rows can still be reasoned about; do not use it to
 * create new payments.
 *
 * @param totalAmount - Total booking amount
 * @param paymentType - 'partial' (legacy 30% online) or 'full' (100% online)
 * @returns Object with amountOnlinePaid and amountCashPaid
 */
export function calculatePaymentAmounts(
  totalAmount: number,
  paymentType: 'partial' | 'full'
): { amountOnlinePaid: number; amountCashPaid: number } {
  if (paymentType === 'full') {
    return {
      amountOnlinePaid: totalAmount,
      amountCashPaid: 0,
    }
  } else {
    // Partial: 30% online, 70% cash
    const amountOnlinePaid = Math.round((totalAmount * 0.3) * 100) / 100
    const amountCashPaid = Math.round((totalAmount - amountOnlinePaid) * 100) / 100
    return {
      amountOnlinePaid,
      amountCashPaid,
    }
  }
}

/**
 * Verify payment amounts based on payment type
 * @param paymentType - 'partial' or 'full'
 * @param amountTotal - Total booking amount
 * @param amountOnlinePaid - Amount paid online
 * @returns true if amounts are valid, false otherwise
 */
export function validatePaymentAmounts(
  paymentType: 'partial' | 'full',
  amountTotal: number,
  amountOnlinePaid: number
): boolean {
  if (paymentType === 'full') {
    // For full payment, online amount must equal total
    return Math.abs(amountOnlinePaid - amountTotal) < 0.01 // Allow for floating point errors
  } else {
    // For partial, online amount should be 30% of total
    const expectedOnline = Math.round((amountTotal * 0.3) * 100) / 100
    return Math.abs(amountOnlinePaid - expectedOnline) < 0.01
  }
}
