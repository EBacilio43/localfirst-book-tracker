export interface ScheduleLoanReminderParams {
  bookTitle: string;
  borrowerName: string;
  loanDirection: 'LENT_OUT' | 'BORROWED_IN';
  dueDateMs: number;
}

interface NotificationsModule {
  scheduleNotificationAsync?: (options: unknown) => Promise<string>;
  cancelScheduledNotificationAsync?: (id: string) => Promise<void>;
}

let expoNotificationsModule: NotificationsModule | null = null;
try {
  const notif = require('expo-notifications');
  expoNotificationsModule = (notif.default || notif) as NotificationsModule;
} catch {
  expoNotificationsModule = null;
}

/**
 * Programa un recordatorio local para la fecha limite de un prestamo.
 * Retorna un identifier determinista `notif_loan_<timestamp>` si la fecha es futura,
 * o null si la fecha ya paso. Encapsula expo-notifications para total compatibilidad con Expo Go.
 */
export async function scheduleLoanReminder(
  params: ScheduleLoanReminderParams
): Promise<string | null> {
  if (params.dueDateMs <= Date.now()) {
    return null;
  }

  const notificationId = `notif_loan_${params.dueDateMs}`;

  if (
    expoNotificationsModule &&
    typeof expoNotificationsModule.scheduleNotificationAsync === 'function'
  ) {
    try {
      const secondsUntilDue = Math.max(1, Math.floor((params.dueDateMs - Date.now()) / 1000));
      await expoNotificationsModule.scheduleNotificationAsync({
        identifier: notificationId,
        content: {
          title:
            params.loanDirection === 'LENT_OUT'
              ? 'Recordatorio de prestamo'
              : 'Devolucion de libro prestado',
          body:
            params.loanDirection === 'LENT_OUT'
              ? `Es momento de consultar con ${params.borrowerName} sobre "${params.bookTitle}".`
              : `Es momento de devolver "${params.bookTitle}" a ${params.borrowerName}.`,
          data: {
            bookTitle: params.bookTitle,
            borrowerName: params.borrowerName,
            loanDirection: params.loanDirection,
          },
        },
        trigger: { seconds: secondsUntilDue },
      });
    } catch {
      // Fallback seguro en Expo Go o entornos sin soporte de notificaciones
    }
  }

  return notificationId;
}

/**
 * Cancela el recordatorio local asociado a un prestamo.
 */
export async function cancelLoanReminder(
  notificationId?: string | null
): Promise<boolean> {
  if (!notificationId) {
    return false;
  }

  if (
    expoNotificationsModule &&
    typeof expoNotificationsModule.cancelScheduledNotificationAsync === 'function'
  ) {
    try {
      await expoNotificationsModule.cancelScheduledNotificationAsync(notificationId);
    } catch {
      // Fallback seguro si falla la cancelacion
    }
  }

  return true;
}

export class LoanNotificationAdapter {
  static scheduleReminder = scheduleLoanReminder;
  static cancelReminder = cancelLoanReminder;
}
