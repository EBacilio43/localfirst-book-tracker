import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleProp,
  ViewStyle,
} from 'react-native';
import {
  X,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  User,
  Phone,
  Clock,
  CheckCircle2,
  AlertCircle,
  Info,
  History,
  FileText,
} from 'lucide-react-native';
import { colors } from '@/core/theme/colors';
import { SafeButton } from '@/shared/components/SafeButton';
import { BookLoan } from '@/db/schema/bookLoans';
import { evaluateLoanDueStatus } from '../utils/loanDueStatus';

export interface LoanManagerModalProps {
  visible: boolean;
  bookTitle: string;
  activeLoan: BookLoan | null;
  loanHistory?: BookLoan[];
  onClose: () => void;
  onCreateLoan: (params: {
    loanDirection: 'LENT_OUT' | 'BORROWED_IN';
    borrowerName: string;
    borrowerContact?: string;
    dueDays: number;
    notes?: string;
  }) => Promise<void> | void;
  onMarkReturned: (loanId: string) => Promise<void> | void;
  onExtendLoan: (loanId: string, extraDays: number) => Promise<void> | void;
}

const DUE_DAYS_OPTIONS = [
  { days: 7, label: '7 días' },
  { days: 14, label: '14 días' },
  { days: 30, label: '30 días' },
];

export const LoanManagerModal: React.FC<LoanManagerModalProps> = ({
  visible,
  bookTitle,
  activeLoan,
  loanHistory = [],
  onClose,
  onCreateLoan,
  onMarkReturned,
  onExtendLoan,
}) => {
  const [loanDirection, setLoanDirection] = useState<'LENT_OUT' | 'BORROWED_IN'>('LENT_OUT');
  const [borrowerName, setBorrowerName] = useState('');
  const [borrowerContact, setBorrowerContact] = useState('');
  const [selectedDueDays, setSelectedDueDays] = useState(14);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (visible && !activeLoan) {
      setLoanDirection('LENT_OUT');
      setBorrowerName('');
      setBorrowerContact('');
      setSelectedDueDays(14);
      setNotes('');
    }
  }, [visible, activeLoan]);

  const handleCreate = async () => {
    if (!borrowerName.trim()) {
      return;
    }
    await onCreateLoan({
      loanDirection,
      borrowerName: borrowerName.trim(),
      borrowerContact: borrowerContact.trim() || undefined,
      dueDays: selectedDueDays,
      notes: notes.trim() || undefined,
    });
  };

  const renderActiveLoanView = (loan: BookLoan) => {
    const evaluation = evaluateLoanDueStatus(loan);
    const isLentOut = loan.loanDirection === 'LENT_OUT';

    let statusLabel = 'En plazo';
    let statusStyle: StyleProp<ViewStyle> = styles.statusOnTime;
    let statusIcon = <Clock size={14} color={colors.light.primary} />;

    if (evaluation.status === 'OVERDUE') {
      statusLabel = 'Vencido';
      statusStyle = styles.statusOverdue;
      statusIcon = <AlertCircle size={14} color={colors.light.danger} />;
    } else if (evaluation.status === 'DUE_SOON') {
      statusLabel = 'Próximo a vencer';
      statusStyle = styles.statusDueSoon;
      statusIcon = <Clock size={14} color={colors.light.warning} />;
    }

    return (
      <View style={styles.activeLoanContainer}>
        {/* Tarjeta de estado activo */}
        <View style={styles.activeLoanCard}>
          <View style={styles.loanTypeHeader}>
            <View style={styles.loanDirectionTag}>
              {isLentOut ? (
                <ArrowUpRight size={14} color={colors.light.primary} />
              ) : (
                <ArrowDownLeft size={14} color={colors.light.accent} />
              )}
              <Text
                style={[
                  styles.loanDirectionText,
                  { color: isLentOut ? colors.light.primary : colors.light.accent },
                ]}
              >
                {isLentOut ? 'Presté este libro' : 'Me prestaron este libro'}
              </Text>
            </View>

            <View style={[styles.statusBadge, statusStyle]}>
              {statusIcon}
              <Text style={styles.statusBadgeText}>{statusLabel}</Text>
            </View>
          </View>

          <View style={styles.loanDetailsBox}>
            <View style={styles.detailRow}>
              <User size={16} color={colors.light.textMuted} />
              <Text style={styles.detailTitle}>
                {isLentOut ? 'En manos de:' : 'Prestado por:'}
              </Text>
              <Text style={styles.detailValueBold}>{loan.borrowerName}</Text>
            </View>

            {loan.borrowerContact ? (
              <View style={styles.detailRow}>
                <Phone size={16} color={colors.light.textMuted} />
                <Text style={styles.detailTitle}>Contacto:</Text>
                <Text style={styles.detailValue}>{loan.borrowerContact}</Text>
              </View>
            ) : null}

            {loan.dueDate ? (
              <View style={styles.detailRow}>
                <Calendar size={16} color={colors.light.textMuted} />
                <Text style={styles.detailTitle}>Plazo límite:</Text>
                <Text style={styles.detailValue}>
                  {evaluation.daysRemaining < 0
                    ? `Venció hace ${Math.abs(evaluation.daysRemaining)} días`
                    : evaluation.daysRemaining === 0
                    ? 'Vence hoy'
                    : `Quedan ${evaluation.daysRemaining} días`}
                </Text>
              </View>
            ) : null}

            {loan.notes ? (
              <View style={styles.detailRow}>
                <FileText size={16} color={colors.light.textMuted} />
                <Text style={styles.detailTitle}>Notas:</Text>
                <Text style={styles.detailValue}>{loan.notes}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Acciones de ampliación y devolución */}
        <View style={styles.activeActionsRow}>
          <SafeButton
            title="+7 días plazo"
            variant="outline"
            size="md"
            leftIcon={<Clock size={16} color={colors.light.primary} />}
            onPress={() => onExtendLoan(loan.id, 7)}
            style={styles.actionBtnFlex}
            testID="extend-loan-button"
          />
          <SafeButton
            title="Marcar como devuelto"
            variant="primary"
            size="md"
            leftIcon={<CheckCircle2 size={16} color="#FFFFFF" />}
            onPress={() => onMarkReturned(loan.id)}
            style={styles.actionBtnFlex}
            testID="mark-returned-button"
          />
        </View>

        {/* Historial anterior si existe */}
        {loanHistory.length > 0 ? (
          <View style={styles.historySection}>
            <View style={styles.historyHeader}>
              <History size={14} color={colors.light.textMuted} />
              <Text style={styles.historyTitle}>Préstamos anteriores de este libro</Text>
            </View>
            {loanHistory.map((past) => (
              <View key={past.id} style={styles.historyItem}>
                <Text style={styles.historyItemText}>
                  {past.borrowerName} ({past.loanDirection === 'LENT_OUT' ? 'Prestado' : 'Tomado'})
                </Text>
                <Text style={styles.historyItemDate}>Devuelto</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    );
  };

  const renderNewLoanForm = () => {
    return (
      <View style={styles.formContainer}>
        {/* Selector de Dirección */}
        <Text style={styles.sectionLabel}>Tipo de movimiento</Text>
        <View style={styles.directionSelectorRow}>
          <Pressable
            onPress={() => setLoanDirection('LENT_OUT')}
            style={[
              styles.directionOption,
              loanDirection === 'LENT_OUT' && styles.directionOptionSelectedLent,
            ]}
            accessibilityRole="radio"
            accessibilityState={{ selected: loanDirection === 'LENT_OUT' }}
          >
            <ArrowUpRight
              size={16}
              color={
                loanDirection === 'LENT_OUT'
                  ? colors.light.primary
                  : colors.light.textMuted
              }
            />
            <Text
              style={[
                styles.directionOptionText,
                loanDirection === 'LENT_OUT' && styles.directionOptionTextSelectedLent,
              ]}
            >
              Presté mi libro
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setLoanDirection('BORROWED_IN')}
            style={[
              styles.directionOption,
              loanDirection === 'BORROWED_IN' && styles.directionOptionSelectedBorrowed,
            ]}
            accessibilityRole="radio"
            accessibilityState={{ selected: loanDirection === 'BORROWED_IN' }}
          >
            <ArrowDownLeft
              size={16}
              color={
                loanDirection === 'BORROWED_IN'
                  ? colors.light.accent
                  : colors.light.textMuted
              }
            />
            <Text
              style={[
                styles.directionOptionText,
                loanDirection === 'BORROWED_IN' && styles.directionOptionTextSelectedBorrowed,
              ]}
            >
              Me prestaron / Biblioteca
            </Text>
          </Pressable>
        </View>

        {/* Nota explicativa si es libro prestado a mí */}
        {loanDirection === 'BORROWED_IN' ? (
          <View style={styles.inventoryNoticeBox}>
            <Info size={16} color={colors.light.accent} />
            <Text style={styles.inventoryNoticeText}>
              Los libros prestados por terceros o bibliotecas no se contabilizan en el inventario propio de tu biblioteca.
            </Text>
          </View>
        ) : null}

        {/* Persona o Entidad */}
        <Text style={styles.sectionLabel}>
          {loanDirection === 'LENT_OUT'
            ? 'Nombre de la persona'
            : 'Persona o Biblioteca que presta'}
        </Text>
        <TextInput
          style={styles.input}
          value={borrowerName}
          onChangeText={setBorrowerName}
          placeholder="Ej. Sofía Mendoza / Biblioteca Central"
          placeholderTextColor={colors.light.textMuted}
          testID="borrower-name-input"
        />

        {/* Contacto */}
        <Text style={styles.sectionLabel}>Contacto o referencia (opcional)</Text>
        <TextInput
          style={styles.input}
          value={borrowerContact}
          onChangeText={setBorrowerContact}
          placeholder="Teléfono, correo o nota..."
          placeholderTextColor={colors.light.textMuted}
          testID="borrower-contact-input"
        />

        {/* Selector de Plazo Rápido */}
        <Text style={styles.sectionLabel}>Plazo estimado de préstamo</Text>
        <View style={styles.dueDaysRow}>
          {DUE_DAYS_OPTIONS.map((item) => {
            const isSelected = selectedDueDays === item.days;
            return (
              <Pressable
                key={item.days}
                onPress={() => setSelectedDueDays(item.days)}
                style={[
                  styles.dueDayPill,
                  isSelected && styles.dueDayPillSelected,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
              >
                <Calendar
                  size={14}
                  color={isSelected ? colors.light.primary : colors.light.textMuted}
                />
                <Text
                  style={[
                    styles.dueDayPillText,
                    isSelected && styles.dueDayPillTextSelected,
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Notas adicionales */}
        <Text style={styles.sectionLabel}>Notas adicionales (opcional)</Text>
        <TextInput
          style={[styles.input, styles.notesInput]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Estado del libro o notas del préstamo..."
          placeholderTextColor={colors.light.textMuted}
          multiline={true}
          numberOfLines={2}
          textAlignVertical="top"
          testID="loan-notes-input"
        />

        {/* Botón de guardado */}
        <View style={styles.formFooter}>
          <SafeButton
            title="Guardar préstamo y programar alerta"
            variant="primary"
            size="lg"
            onPress={handleCreate}
            disabled={!borrowerName.trim()}
            testID="save-loan-button"
          />
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalContent} testID="loan-manager-modal">
          <View style={styles.header}>
            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerTitle}>
                {activeLoan ? 'Control de préstamo' : 'Registrar préstamo'}
              </Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {bookTitle}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              style={styles.closeButton}
              accessibilityLabel="Cerrar modal"
              accessibilityRole="button"
            >
              <X size={20} color={colors.light.textMuted} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {activeLoan ? renderActiveLoanView(activeLoan) : renderNewLoanForm()}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.light.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    minHeight: '55%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  headerTitleContainer: {
    flex: 1,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.light.text,
  },
  headerSubtitle: {
    fontSize: 13,
    color: colors.light.textMuted,
    marginTop: 2,
  },
  closeButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: colors.light.surfaceAlt,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 28,
  },
  activeLoanContainer: {
    gap: 16,
  },
  activeLoanCard: {
    backgroundColor: colors.light.surfaceAlt,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.light.border,
    padding: 16,
    gap: 14,
  },
  loanTypeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  loanDirectionTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  loanDirectionText: {
    fontSize: 14,
    fontWeight: '700',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  statusOnTime: {
    backgroundColor: colors.light.successBg,
  },
  statusDueSoon: {
    backgroundColor: colors.light.warningBg,
  },
  statusOverdue: {
    backgroundColor: colors.light.dangerBg,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.light.text,
  },
  loanDetailsBox: {
    gap: 8,
    backgroundColor: colors.light.surface,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailTitle: {
    fontSize: 13,
    color: colors.light.textMuted,
  },
  detailValueBold: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.light.text,
  },
  detailValue: {
    fontSize: 13,
    color: colors.light.text,
    flex: 1,
  },
  activeActionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtnFlex: {
    flex: 1,
  },
  historySection: {
    marginTop: 10,
    backgroundColor: colors.light.surfaceAlt,
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  historyTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.light.textMuted,
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  historyItemText: {
    fontSize: 12,
    color: colors.light.text,
  },
  historyItemDate: {
    fontSize: 11,
    color: colors.light.textMuted,
  },
  formContainer: {
    gap: 12,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.light.text,
  },
  directionSelectorRow: {
    flexDirection: 'row',
    gap: 10,
  },
  directionOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.light.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    gap: 6,
  },
  directionOptionSelectedLent: {
    backgroundColor: '#EBF4F0',
    borderColor: colors.light.primary,
  },
  directionOptionSelectedBorrowed: {
    backgroundColor: '#FDF2ED',
    borderColor: colors.light.accent,
  },
  directionOptionText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.light.textMuted,
  },
  directionOptionTextSelectedLent: {
    color: colors.light.primary,
    fontWeight: '700',
  },
  directionOptionTextSelectedBorrowed: {
    color: colors.light.accent,
    fontWeight: '700',
  },
  inventoryNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FDF6F2',
    borderWidth: 1,
    borderColor: '#F9DDD0',
    borderRadius: 8,
    padding: 10,
    gap: 8,
  },
  inventoryNoticeText: {
    fontSize: 12,
    color: colors.light.accent,
    flex: 1,
    lineHeight: 16,
  },
  input: {
    backgroundColor: colors.light.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.light.text,
  },
  dueDaysRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dueDayPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.light.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: 8,
    paddingVertical: 8,
    gap: 6,
  },
  dueDayPillSelected: {
    backgroundColor: '#EBF4F0',
    borderColor: colors.light.primary,
    borderWidth: 1.5,
  },
  dueDayPillText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.light.textMuted,
  },
  dueDayPillTextSelected: {
    color: colors.light.primary,
    fontWeight: '700',
  },
  notesInput: {
    minHeight: 50,
  },
  formFooter: {
    marginTop: 8,
  },
});
