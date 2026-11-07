import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AlertCircle, Clock, BookMarked, ArrowUpRight, ArrowDownLeft } from 'lucide-react-native';
import { colors } from '@/core/theme/colors';
import { BookLoan } from '@/db/schema/bookLoans';
import { evaluateLoanDueStatus } from '../utils/loanDueStatus';

export interface LoanCoverRibbonProps {
  loan: BookLoan | null | undefined;
  nowMs?: number;
}

export const LoanCoverRibbon: React.FC<LoanCoverRibbonProps> = ({ loan, nowMs }) => {
  if (!loan || loan.returnedAt !== null) {
    return null;
  }

  const evaluation = evaluateLoanDueStatus(loan, nowMs);
  const isLentOut = loan.loanDirection === 'LENT_OUT';
  const directionLabel = isLentOut ? 'Prestado' : 'Me prestaron';
  const isOverdue = evaluation.status === 'OVERDUE';
  const isDueSoon = evaluation.status === 'DUE_SOON';

  return (
    <View
      style={[
        styles.ribbonContainer,
        isOverdue
          ? styles.ribbonOverdue
          : isDueSoon
          ? styles.ribbonDueSoon
          : isLentOut
          ? styles.ribbonLent
          : styles.ribbonBorrowed,
      ]}
      testID="loan-cover-ribbon"
    >
      <View style={styles.directionRow}>
        {isLentOut ? (
          <ArrowUpRight size={11} color="#FFFFFF" />
        ) : (
          <ArrowDownLeft size={11} color="#FFFFFF" />
        )}
        <Text style={styles.directionText}>{directionLabel}</Text>
      </View>

      {isOverdue ? (
        <View style={styles.statusBadge}>
          <AlertCircle size={10} color="#FFFFFF" />
          <Text style={styles.statusText}>Vencido</Text>
        </View>
      ) : isDueSoon ? (
        <View style={styles.statusBadge}>
          <Clock size={10} color="#FFFFFF" />
          <Text style={styles.statusText}>Por vencer</Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  ribbonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 6,
    alignSelf: 'flex-start',
  },
  ribbonLent: {
    backgroundColor: colors.light.primary,
  },
  ribbonBorrowed: {
    backgroundColor: colors.light.accent,
  },
  ribbonDueSoon: {
    backgroundColor: colors.light.warning,
  },
  ribbonOverdue: {
    backgroundColor: colors.light.danger,
  },
  directionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  directionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
