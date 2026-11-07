import {
  scheduleLoanReminder,
  cancelLoanReminder,
  LoanNotificationAdapter,
} from '../../src/features/loans/services/loanNotificationAdapter';

describe('loanNotificationAdapter Unit Tests', () => {
  it('retorna null si la fecha de vencimiento ya paso', async () => {
    const pastDueDate = Date.now() - 10000;
    const result = await scheduleLoanReminder({
      bookTitle: 'El Quijote',
      borrowerName: 'Sancho',
      loanDirection: 'LENT_OUT',
      dueDateMs: pastDueDate,
    });

    expect(result).toBeNull();
  });

  it('retorna un notificationId determinista si la fecha es futura', async () => {
    const futureDueDate = Date.now() + 86400000 * 5;
    const result = await scheduleLoanReminder({
      bookTitle: 'Cien Anos de Soledad',
      borrowerName: 'Aureliano',
      loanDirection: 'BORROWED_IN',
      dueDateMs: futureDueDate,
    });

    expect(result).toBe(`notif_loan_${futureDueDate}`);
  });

  it('cancela recordatorios retornando true para ids validos y false para vacios', async () => {
    expect(await cancelLoanReminder('notif_loan_12345')).toBe(true);
    expect(await cancelLoanReminder(null)).toBe(false);
    expect(await cancelLoanReminder(undefined)).toBe(false);
  });

  it('expone metodos estaticos en la clase LoanNotificationAdapter', async () => {
    const futureDueDate = Date.now() + 100000;
    const id = await LoanNotificationAdapter.scheduleReminder({
      bookTitle: 'Ficciones',
      borrowerName: 'Borges',
      loanDirection: 'LENT_OUT',
      dueDateMs: futureDueDate,
    });

    expect(id).toBe(`notif_loan_${futureDueDate}`);
    expect(await LoanNotificationAdapter.cancelReminder(id)).toBe(true);
  });
});
