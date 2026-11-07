import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
} from 'react-native';
import {
  X,
  Cloud,
  HardDrive,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Trash2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Users,
  Lock,
  BookOpen,
  Calendar,
} from 'lucide-react-native';
import { colors } from '@/core/theme/colors';
import { SafeButton } from '@/shared/components/SafeButton';

export type CloudSyncTabKey = 'RESPALDO' | 'PENDIENTES' | 'IMPORTAR' | 'PRIVACIDAD';

export interface ProgressConflictInfo {
  bookTitle: string;
  localPage: number;
  cloudPage: number;
  totalPages?: number;
}

export interface BackupSummaryInfo {
  booksCount: number;
  sessionsCount: number;
  quotesCount: number;
  lastBackupDate?: string | number | null;
}

export interface CloudSyncAndSettingsModalProps {
  visible: boolean;
  onClose: () => void;
  // Tab 1: Respaldo
  accountEmail?: string | null;
  isDriveConnected?: boolean;
  backupSummary?: BackupSummaryInfo;
  onBackupNow?: () => Promise<void> | void;
  onRestoreBackup?: () => Promise<void> | void;
  progressConflict?: ProgressConflictInfo | null;
  onResolveConflictLocal?: () => Promise<void> | void;
  onResolveConflictCloud?: () => Promise<void> | void;
  onConnectDrive?: () => Promise<void> | void;
  onDisconnectDrive?: () => Promise<void> | void;
  // Tab 2: Pendientes
  pendingOfflineBooksCount?: number;
  onSyncPendingIsbn?: () => Promise<void> | void;
  sharedCommunityEditionsCount?: number;
  // Tab 3: Importar y Espacio
  onImportCsv?: () => Promise<void> | void;
  onExportCsv?: () => Promise<void> | void;
  coversStorageMb?: number | string;
  reclaimableStorageMb?: number | string;
  onCleanUnusedCovers?: () => Promise<void> | void;
  // Tab 4: Privacidad y Plan
  membershipType?: string;
  onWipeAllData?: () => Promise<void> | void;
  initialTab?: CloudSyncTabKey;
}

interface LegalClause {
  id: string;
  title: string;
  content: string;
}

const LEGAL_CLAUSES: LegalClause[] = [
  {
    id: 'covers-quotes',
    title: 'Uso personal de portadas y citas',
    content:
      'Todas las portadas, títulos, sellos editoriales y sinopsis mostrados en BaciBooks pertenecen a sus respectivos autores y editoriales. Se muestran únicamente para identificación bibliográfica y catalogación personal. Las citas y fragmentos escaneados están destinados exclusivamente a tu uso y estudio personal sin fines comerciales.',
  },
  {
    id: 'smart-detective',
    title: 'Sobre las sugerencias del Detective Literario',
    content:
      'La búsqueda inteligente utiliza modelos avanzados de lenguaje para ayudarte a recordar libros a partir de recuerdos, tramas o descripciones. Las sugerencias tienen carácter orientativo y están diseñadas para guiar tu búsqueda sin revelar spoilers ni sustituir la lectura.',
  },
  {
    id: 'privacy-cloud',
    title: 'Cómo protegemos tu privacidad y tu nube',
    content:
      'Tus lecturas, notas personales y citas son tuyas. La copia de seguridad se guarda exclusivamente en una carpeta privada de tu cuenta personal de Google Drive. BaciBooks nunca accede a tus correos, fotos ni archivos ajenos a tu biblioteca.',
  },
  {
    id: 'terms-subs',
    title: 'Términos de uso y suscripciones',
    content:
      'Las suscripciones de BaciBooks Pro se gestionan directamente a través de las tiendas oficiales de aplicaciones (Google Play y App Store). Puedes cancelar tu renovación automática en cualquier momento desde los ajustes de tu cuenta sin perder el acceso durante el periodo ya pagado.',
  },
];

export const CloudSyncAndSettingsModal: React.FC<CloudSyncAndSettingsModalProps> = ({
  visible,
  onClose,
  accountEmail,
  isDriveConnected = true,
  backupSummary = {
    booksCount: 142,
    sessionsCount: 86,
    quotesCount: 34,
    lastBackupDate: 'Hoy a las 10:15',
  },
  onBackupNow,
  onRestoreBackup,
  progressConflict,
  onResolveConflictLocal,
  onResolveConflictCloud,
  onConnectDrive,
  onDisconnectDrive,
  pendingOfflineBooksCount = 0,
  onSyncPendingIsbn,
  sharedCommunityEditionsCount = 12,
  onImportCsv,
  onExportCsv,
  coversStorageMb = '14.2 MB',
  reclaimableStorageMb = '3.8 MB',
  onCleanUnusedCovers,
  membershipType = 'BaciBooks Pro',
  onWipeAllData,
  initialTab = 'RESPALDO',
}) => {
  const [activeTab, setActiveTab] = useState<CloudSyncTabKey>(initialTab);
  const [expandedClauseId, setExpandedClauseId] = useState<string | null>(null);
  const [isWipeConfirming, setIsWipeConfirming] = useState<boolean>(false);

  const toggleClause = (id: string) => {
    setExpandedClauseId((prev) => (prev === id ? null : id));
  };

  const handleWipePress = async () => {
    if (!isWipeConfirming) {
      setIsWipeConfirming(true);
      return;
    }
    if (onWipeAllData) {
      await onWipeAllData();
    }
    setIsWipeConfirming(false);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheetContainer} testID="cloud-sync-settings-modal">
          {/* Cabecera del Modal */}
          <View style={styles.header}>
            <View style={styles.headerTitles}>
              <View style={styles.headerBadge}>
                <Cloud size={14} color={colors.light.primary} />
                <Text style={styles.headerBadgeText}>Copia en la Nube y Ajustes</Text>
              </View>
              <Text style={styles.titleText}>Mi Biblioteca y Privacidad</Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Cerrar ajustes"
            >
              <X size={20} color={colors.light.textMuted} />
            </Pressable>
          </View>

          {/* Selector de Pestañas (4 segmentos amigables) */}
          <View style={styles.tabsRow}>
            <Pressable
              style={[styles.tabButton, activeTab === 'RESPALDO' && styles.tabButtonActive]}
              onPress={() => {
                setActiveTab('RESPALDO');
                setIsWipeConfirming(false);
              }}
              testID="tab-respaldo"
            >
              <Text
                style={[
                  styles.tabButtonText,
                  activeTab === 'RESPALDO' && styles.tabButtonTextActive,
                ]}
              >
                Respaldo
              </Text>
            </Pressable>

            <Pressable
              style={[styles.tabButton, activeTab === 'PENDIENTES' && styles.tabButtonActive]}
              onPress={() => {
                setActiveTab('PENDIENTES');
                setIsWipeConfirming(false);
              }}
              testID="tab-pendientes"
            >
              <Text
                style={[
                  styles.tabButtonText,
                  activeTab === 'PENDIENTES' && styles.tabButtonTextActive,
                ]}
              >
                Pendientes
              </Text>
            </Pressable>

            <Pressable
              style={[styles.tabButton, activeTab === 'IMPORTAR' && styles.tabButtonActive]}
              onPress={() => {
                setActiveTab('IMPORTAR');
                setIsWipeConfirming(false);
              }}
              testID="tab-importar"
            >
              <Text
                style={[
                  styles.tabButtonText,
                  activeTab === 'IMPORTAR' && styles.tabButtonTextActive,
                ]}
              >
                Importar
              </Text>
            </Pressable>

            <Pressable
              style={[styles.tabButton, activeTab === 'PRIVACIDAD' && styles.tabButtonActive]}
              onPress={() => {
                setActiveTab('PRIVACIDAD');
                setIsWipeConfirming(false);
              }}
              testID="tab-privacidad"
            >
              <Text
                style={[
                  styles.tabButtonText,
                  activeTab === 'PRIVACIDAD' && styles.tabButtonTextActive,
                ]}
              >
                Privacidad
              </Text>
            </Pressable>
          </View>

          {/* Contenido scrolleable por pestaña */}
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* =========================================================================
                PESTAÑA 1: RESPALDO
                ========================================================================= */}
            {activeTab === 'RESPALDO' && (
              <View style={styles.tabContentContainer}>
                {/* Tarjeta de Estado de Cuenta Google Drive */}
                <View style={styles.card}>
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.accountIconWrap}>
                      <Cloud size={22} color={colors.light.primary} />
                    </View>
                    <View style={styles.accountTextCol}>
                      <Text style={styles.accountTitle}>
                        {accountEmail || 'Tu cuenta de Google Drive'}
                      </Text>
                      <Text style={styles.accountSubtitle}>
                        {isDriveConnected ? 'Conexión activa y segura' : 'Sin conectar'}
                      </Text>
                    </View>
                    <View style={styles.badgeSuccess}>
                      <Text style={styles.badgeSuccessText}>Respaldo Automático</Text>
                    </View>
                  </View>

                  {/* Resumen de la última copia guardada */}
                  <View style={styles.summaryGrid}>
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryNumber}>{backupSummary.booksCount}</Text>
                      <Text style={styles.summaryLabel}>Libros</Text>
                    </View>
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryNumber}>{backupSummary.sessionsCount}</Text>
                      <Text style={styles.summaryLabel}>Sesiones</Text>
                    </View>
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryNumber}>{backupSummary.quotesCount}</Text>
                      <Text style={styles.summaryLabel}>Citas</Text>
                    </View>
                  </View>

                  {backupSummary.lastBackupDate && (
                    <Text style={styles.lastBackupText}>
                      Última copia guardada: {backupSummary.lastBackupDate}
                    </Text>
                  )}

                  {/* Botones de acción de respaldo */}
                  <View style={styles.buttonsGroup}>
                    <SafeButton
                      title="Guardar copia ahora"
                      variant="primary"
                      size="md"
                      testID="backup-now-button"
                      leftIcon={<Cloud size={18} color="#FFFFFF" />}
                      onPress={async () => {
                        if (onBackupNow) await onBackupNow();
                      }}
                    />

                    <SafeButton
                      title="Recuperar biblioteca en este teléfono"
                      variant="outline"
                      size="md"
                      testID="restore-backup-button"
                      leftIcon={<RefreshCw size={18} color={colors.light.primary} />}
                      onPress={async () => {
                        if (onRestoreBackup) await onRestoreBackup();
                      }}
                      style={styles.mt8}
                    />
                  </View>
                </View>

                {/* Tarjeta de Conflicto de Progreso (si existe) */}
                {progressConflict && (
                  <View style={styles.conflictCard}>
                    <View style={styles.conflictHeaderRow}>
                      <View style={styles.conflictIconWrap}>
                        <AlertTriangle size={20} color={colors.light.warning} />
                      </View>
                      <View style={styles.accountTextCol}>
                        <Text style={styles.conflictTitle}>¿En qué página vas?</Text>
                        <Text style={styles.conflictSubtitle}>
                          Detectamos un avance diferente en &quot;{progressConflict.bookTitle}&quot;
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.conflictDescription}>
                      En este teléfono registraste la página {progressConflict.localPage}, mientras que en tu copia en la nube guardaste la página {progressConflict.cloudPage}. ¿Cuál prefieres mantener?
                    </Text>

                    <View style={styles.conflictButtonsRow}>
                      <SafeButton
                        title={`Quedarme en la página ${progressConflict.localPage}`}
                        variant="primary"
                        size="sm"
                        testID="resolve-conflict-local-button"
                        onPress={async () => {
                          if (onResolveConflictLocal) await onResolveConflictLocal();
                        }}
                        style={styles.flex1}
                      />

                      <SafeButton
                        title={`Avanzar a la página ${progressConflict.cloudPage}`}
                        variant="outline"
                        size="sm"
                        testID="resolve-conflict-cloud-button"
                        onPress={async () => {
                          if (onResolveConflictCloud) await onResolveConflictCloud();
                        }}
                        style={styles.flex1}
                      />
                    </View>
                  </View>
                )}

                {/* Nota de Privacidad en Respaldo */}
                <View style={styles.privacyNoteCard}>
                  <View style={styles.privacyNoteHeaderRow}>
                    <ShieldCheck size={18} color={colors.light.primary} />
                    <Text style={styles.privacyNoteTitle}>Privacidad garantizada</Text>
                  </View>
                  <Text style={styles.privacyNoteBody}>
                    Tu privacidad primero: BaciBooks guarda tu copia en un espacio privado de tu cuenta y nunca puede ver tus fotos, correos ni archivos personales.
                  </Text>
                </View>
              </View>
            )}

            {/* =========================================================================
                PESTAÑA 2: PENDIENTES
                ========================================================================= */}
            {activeTab === 'PENDIENTES' && (
              <View style={styles.tabContentContainer}>
                {/* Libros escaneados sin internet */}
                <View style={styles.card}>
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.accountIconWrap}>
                      <HardDrive size={20} color={colors.light.primary} />
                    </View>
                    <View style={styles.accountTextCol}>
                      <Text style={styles.cardTitle}>Libros escaneados sin internet</Text>
                      <Text style={styles.cardSubtitle}>
                        {pendingOfflineBooksCount > 0
                          ? `${pendingOfflineBooksCount} ${
                              pendingOfflineBooksCount === 1 ? 'libro' : 'libros'
                            } en espera de conexión`
                          : 'No tienes libros escaneados pendientes'}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.cardBodyText}>
                    Cuando escaneas libros sin señal móvil o wifi, BaciBooks guarda el código y tu estantería al instante para que no detengas tu catalogación.
                  </Text>

                  {pendingOfflineBooksCount > 0 && (
                    <View style={styles.pendingCounterBanner}>
                      <Text style={styles.pendingCounterBannerText}>
                        {pendingOfflineBooksCount}{' '}
                        {pendingOfflineBooksCount === 1
                          ? 'ejemplar listo para completar'
                          : 'ejemplares listos para completar'}
                      </Text>
                    </View>
                  )}

                  <SafeButton
                    title="Completar portadas y datos"
                    variant="primary"
                    size="md"
                    testID="sync-pending-isbn-button"
                    leftIcon={<RefreshCw size={18} color="#FFFFFF" />}
                    onPress={async () => {
                      if (onSyncPendingIsbn) await onSyncPendingIsbn();
                    }}
                    style={styles.mt12}
                  />
                </View>

                {/* Ediciones compartidas con la comunidad */}
                <View style={styles.card}>
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.accountIconWrap}>
                      <Users size={20} color={colors.light.accent} />
                    </View>
                    <View style={styles.accountTextCol}>
                      <Text style={styles.cardTitle}>
                        Ediciones compartidas con otros lectores
                      </Text>
                      <Text style={styles.cardSubtitle}>
                        {sharedCommunityEditionsCount} aportaciones validadas
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.cardBodyText}>
                    Al fotografiar portadas reales y corregir sellos editoriales de ediciones en español, colaboras con una base comunitaria cuidada por y para amantes de la lectura.
                  </Text>

                  <View style={styles.communityBadgeStrip}>
                    <View style={styles.badgeAccent}>
                      <Text style={styles.badgeAccentText}>
                        {sharedCommunityEditionsCount} ediciones compartidas
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* =========================================================================
                PESTAÑA 3: IMPORTAR Y ESPACIO
                ========================================================================= */}
            {activeTab === 'IMPORTAR' && (
              <View style={styles.tabContentContainer}>
                {/* Traer libros desde Goodreads / StoryGraph / Excel */}
                <View style={styles.card}>
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.accountIconWrap}>
                      <FileSpreadsheet size={20} color={colors.light.primary} />
                    </View>
                    <View style={styles.accountTextCol}>
                      <Text style={styles.cardTitle}>
                        Traer mis libros de Goodreads, StoryGraph o Excel
                      </Text>
                      <Text style={styles.cardSubtitle}>
                        Migración sencilla sin perder tu historial
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.cardBodyText}>
                    Importa tus lecturas previas subiendo un archivo exportado o descarga tu biblioteca en una hoja de cálculo para consultarla libremente.
                  </Text>

                  <View style={styles.buttonsGroup}>
                    <SafeButton
                      title="Importar libros desde archivo"
                      variant="primary"
                      size="md"
                      testID="import-csv-button"
                      leftIcon={<FileSpreadsheet size={18} color="#FFFFFF" />}
                      onPress={async () => {
                        if (onImportCsv) await onImportCsv();
                      }}
                    />

                    <SafeButton
                      title="Descargar lista para Excel"
                      variant="outline"
                      size="md"
                      testID="export-csv-button"
                      leftIcon={<FileSpreadsheet size={18} color={colors.light.primary} />}
                      onPress={async () => {
                        if (onExportCsv) await onExportCsv();
                      }}
                      style={styles.mt8}
                    />
                  </View>
                </View>

                {/* Espacio ocupado por portadas */}
                <View style={styles.card}>
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.accountIconWrap}>
                      <HardDrive size={20} color={colors.light.text} />
                    </View>
                    <View style={styles.accountTextCol}>
                      <Text style={styles.cardTitle}>Espacio ocupado por portadas</Text>
                      <Text style={styles.cardSubtitle}>
                        Optimización de memoria en tu dispositivo
                      </Text>
                    </View>
                  </View>

                  <View style={styles.storageStatsRow}>
                    <View style={styles.storageStatCol}>
                      <Text style={styles.storageStatLabel}>Espacio en uso</Text>
                      <Text style={styles.storageStatValue}>{coversStorageMb}</Text>
                    </View>
                    <View style={styles.storageStatDivider} />
                    <View style={styles.storageStatCol}>
                      <Text style={styles.storageStatLabel}>Espacio recuperable</Text>
                      <Text style={styles.storageStatValueAccent}>{reclaimableStorageMb}</Text>
                    </View>
                  </View>

                  <Text style={styles.cardBodyText}>
                    Al cambiar portadas o eliminar libros antiguos de tu estantería, puedes limpiar los archivos que ya no utilizas para mantener tu teléfono ligero.
                  </Text>

                  <SafeButton
                    title="Liberar espacio de portadas no usadas"
                    variant="outline"
                    size="md"
                    testID="clean-unused-covers-button"
                    leftIcon={<Trash2 size={18} color={colors.light.primary} />}
                    onPress={async () => {
                      if (onCleanUnusedCovers) await onCleanUnusedCovers();
                    }}
                    style={styles.mt12}
                  />
                </View>
              </View>
            )}

            {/* =========================================================================
                PESTAÑA 4: PRIVACIDAD Y MI PLAN
                ========================================================================= */}
            {activeTab === 'PRIVACIDAD' && (
              <View style={styles.tabContentContainer}>
                {/* Membresía actual */}
                <View style={styles.card}>
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.accountIconWrap}>
                      <Sparkles size={20} color={colors.light.gold} />
                    </View>
                    <View style={styles.accountTextCol}>
                      <Text style={styles.cardTitle}>Tu membresía actual</Text>
                      <Text style={styles.cardSubtitle}>{membershipType}</Text>
                    </View>
                    <View style={styles.badgeGold}>
                      <Text style={styles.badgeGoldText}>Activa</Text>
                    </View>
                  </View>

                  <View style={styles.pillsRow}>
                    <View style={styles.pillFeature}>
                      <CheckCircle2 size={14} color={colors.light.primary} />
                      <Text style={styles.pillFeatureText}>Sin anuncios</Text>
                    </View>
                    <View style={styles.pillFeature}>
                      <CheckCircle2 size={14} color={colors.light.primary} />
                      <Text style={styles.pillFeatureText}>Ilimitado</Text>
                    </View>
                    <View style={styles.pillFeature}>
                      <CheckCircle2 size={14} color={colors.light.primary} />
                      <Text style={styles.pillFeatureText}>Copia en la nube</Text>
                    </View>
                  </View>
                </View>

                {/* Acuerdos Legales y Cláusulas Desplegables */}
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Información Legal y Privacidad</Text>
                  <Text style={styles.cardSubtitle}>
                    Consulta con claridad las políticas editoriales y el uso de tus datos
                  </Text>

                  <View style={styles.clausesList}>
                    {LEGAL_CLAUSES.map((clause) => {
                      const isExpanded = expandedClauseId === clause.id;
                      return (
                        <View key={clause.id} style={styles.clauseItem}>
                          <Pressable
                            style={styles.clauseHeader}
                            onPress={() => toggleClause(clause.id)}
                            accessibilityRole="button"
                            accessibilityLabel={`Expandir ${clause.title}`}
                          >
                            <Text style={styles.clauseTitle}>{clause.title}</Text>
                            {isExpanded ? (
                              <ChevronUp size={18} color={colors.light.textMuted} />
                            ) : (
                              <ChevronDown size={18} color={colors.light.textMuted} />
                            )}
                          </Pressable>
                          {isExpanded && (
                            <View style={styles.clauseBody}>
                              <Text style={styles.clauseContent}>{clause.content}</Text>
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                </View>

                {/* Zona de peligro: Borrar biblioteca y datos */}
                <View style={[styles.card, styles.dangerCard]}>
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.dangerIconWrap}>
                      <Trash2 size={20} color={colors.light.danger} />
                    </View>
                    <View style={styles.accountTextCol}>
                      <Text style={styles.dangerTitle}>Borrar mi biblioteca y mis datos</Text>
                      <Text style={styles.dangerSubtitle}>
                        Acción permanente para restablecer la aplicación
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.cardBodyText}>
                    Esta acción borrará de forma definitiva tus libros, notas, citas y copias de seguridad en este dispositivo.
                  </Text>

                  {isWipeConfirming && (
                    <View style={styles.wipeWarningBox}>
                      <AlertTriangle size={18} color={colors.light.danger} />
                      <Text style={styles.wipeWarningText}>
                        ¿Seguro que deseas continuar? Esta acción no se puede deshacer. Toca nuevamente para confirmar el borrado total.
                      </Text>
                    </View>
                  )}

                  <SafeButton
                    title={
                      isWipeConfirming
                        ? 'Confirmar y eliminar todos mis datos'
                        : 'Eliminar todos mis datos'
                    }
                    variant="danger"
                    size="md"
                    cooldownMs={0}
                    testID="wipe-all-data-button"
                    leftIcon={<Trash2 size={18} color="#FFFFFF" />}
                    onPress={handleWipePress}
                    style={styles.mt12}
                  />
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(20, 18, 16, 0.65)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: colors.light.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.borderSubtle,
  },
  headerTitles: {
    flex: 1,
    paddingRight: 12,
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  headerBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.light.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  titleText: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.light.text,
  },
  closeButton: {
    padding: 6,
    borderRadius: 999,
    backgroundColor: colors.light.surfaceAlt,
  },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 6,
    backgroundColor: colors.light.background,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.light.surfaceAlt,
  },
  tabButtonActive: {
    backgroundColor: colors.light.primary,
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.light.textMuted,
  },
  tabButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  scrollArea: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },
  tabContentContainer: {
    gap: 14,
  },
  card: {
    backgroundColor: colors.light.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  accountIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.light.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountTextCol: {
    flex: 1,
  },
  accountTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.light.text,
  },
  accountSubtitle: {
    fontSize: 13,
    color: colors.light.textMuted,
    marginTop: 2,
  },
  badgeSuccess: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: colors.light.successBg,
  },
  badgeSuccessText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.light.success,
  },
  badgeGold: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#FEF3C7',
  },
  badgeGoldText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.light.gold,
  },
  summaryGrid: {
    flexDirection: 'row',
    backgroundColor: colors.light.surfaceAlt,
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.light.primary,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.light.textMuted,
    marginTop: 2,
  },
  lastBackupText: {
    fontSize: 12,
    color: colors.light.textMuted,
    marginTop: 10,
    textAlign: 'center',
  },
  buttonsGroup: {
    marginTop: 14,
  },
  conflictCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  conflictHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  conflictIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  conflictTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#92400E',
  },
  conflictSubtitle: {
    fontSize: 12,
    color: '#B45309',
    marginTop: 1,
  },
  conflictDescription: {
    fontSize: 13,
    color: '#78350F',
    lineHeight: 18,
    marginTop: 10,
  },
  conflictButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  flex1: {
    flex: 1,
  },
  privacyNoteCard: {
    backgroundColor: colors.light.surfaceAlt,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.light.borderSubtle,
  },
  privacyNoteHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  privacyNoteTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.light.primary,
  },
  privacyNoteBody: {
    fontSize: 12,
    color: colors.light.textMuted,
    lineHeight: 17,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.light.text,
  },
  cardSubtitle: {
    fontSize: 13,
    color: colors.light.textMuted,
    marginTop: 2,
  },
  cardBodyText: {
    fontSize: 13,
    color: colors.light.textMuted,
    lineHeight: 19,
    marginTop: 10,
  },
  pendingCounterBanner: {
    backgroundColor: '#EFF6FF',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  pendingCounterBannerText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E40AF',
  },
  communityBadgeStrip: {
    marginTop: 12,
    flexDirection: 'row',
  },
  badgeAccent: {
    backgroundColor: '#FFEDD5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  badgeAccentText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.light.accent,
  },
  storageStatsRow: {
    flexDirection: 'row',
    backgroundColor: colors.light.surfaceAlt,
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    alignItems: 'center',
  },
  storageStatCol: {
    flex: 1,
    alignItems: 'center',
  },
  storageStatDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.light.border,
  },
  storageStatLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.light.textMuted,
  },
  storageStatValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.light.text,
    marginTop: 2,
  },
  storageStatValueAccent: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.light.primary,
    marginTop: 2,
  },
  pillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    flexWrap: 'wrap',
  },
  pillFeature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.light.surfaceAlt,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  pillFeatureText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.light.text,
  },
  clausesList: {
    marginTop: 12,
    gap: 8,
  },
  clauseItem: {
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: 10,
    overflow: 'hidden',
  },
  clauseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: colors.light.surfaceAlt,
  },
  clauseTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.light.text,
    flex: 1,
    paddingRight: 8,
  },
  clauseBody: {
    padding: 12,
    backgroundColor: colors.light.surface,
  },
  clauseContent: {
    fontSize: 12,
    color: colors.light.textMuted,
    lineHeight: 18,
  },
  dangerCard: {
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  dangerIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.light.danger,
  },
  dangerSubtitle: {
    fontSize: 12,
    color: '#991B1B',
    marginTop: 2,
  },
  wipeWarningBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.light.danger,
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
    alignItems: 'center',
  },
  wipeWarningText: {
    fontSize: 12,
    color: colors.light.danger,
    fontWeight: '600',
    flex: 1,
    lineHeight: 16,
  },
  mt8: {
    marginTop: 8,
  },
  mt12: {
    marginTop: 12,
  },
});
