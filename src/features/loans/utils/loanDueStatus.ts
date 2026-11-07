import { BookLoan } from '@/db/schema/bookLoans';

export interface LoanDueEvaluation {
  status: 'RETURNED' | 'ON_TIME' | 'DUE_SOON' | 'OVERDUE';
  daysRemaining: number;
}

/**
 * Evalua el estado de vencimiento de un prestamo.
 * - RETURNED: si el prestamo ya fue devuelto (returnedAt !== null).
 * - OVERDUE: si la fecha limite ya vencio (daysRemaining < 0).
 * - DUE_SOON: si faltan entre 0 y 2 dias inclusive para la fecha limite.
 * - ON_TIME: si faltan mas de 2 dias o si no tiene fecha limite establecida.
 */
export function evaluateLoanDueStatus(
  loan: BookLoan,
  nowMs?: number
): LoanDueEvaluation {
  if (loan.returnedAt !== null) {
    return {
      status: 'RETURNED',
      daysRemaining: 0,
    };
  }

  if (loan.dueDate === null || loan.dueDate === undefined) {
    return {
      status: 'ON_TIME',
      daysRemaining: Infinity,
    };
  }

  const currentMs = nowMs ?? Date.now();
  const diffMs = loan.dueDate - currentMs;

  const daysRemaining =
    diffMs < 0 ? Math.floor(diffMs / 86400000) : Math.ceil(diffMs / 86400000);

  if (daysRemaining < 0) {
    return {
      status: 'OVERDUE',
      daysRemaining,
    };
  }

  if (daysRemaining <= 2) {
    return {
      status: 'DUE_SOON',
      daysRemaining,
    };
  }

  return {
    status: 'ON_TIME',
    daysRemaining,
  };
}
