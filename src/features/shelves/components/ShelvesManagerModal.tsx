import React, { useState } from 'react';
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
} from 'react-native';
import {
  X,
  Plus,
  Layers,
  BookMarked,
  Check,
  Tablet,
  Smartphone,
  FileText,
  BookOpen,
  MapPin,
  Trash2,
} from 'lucide-react-native';
import { colors } from '@/core/theme/colors';
import { SafeButton } from '@/shared/components/SafeButton';
import { Book } from '@/db/schema/books';
import { Shelf } from '@/db/schema/shelves';

export type DigitalCollectionKey = 'KINDLE' | 'KOBO' | 'APPLE_BOOKS' | 'EPUB_PDF';

export interface ShelvesManagerModalProps {
  visible: boolean;
  book: Book;
  shelves: Shelf[];
  existingEditionsCount?: number;
  onClose: () => void;
  onAssignPhysicalShelf: (shelfId: string) => Promise<void>;
  onAssignDigitalCollection: (
    collection: DigitalCollectionKey
  ) => Promise<void>;
  onCreateShelf: (data: {
    furnitureName: string;
    shelfLevel?: string;
    colorTag: string;
  }) => Promise<Shelf | void>;
  onRemoveFromShelf?: () => Promise<void>;
}

const COLOR_PRESETS = [
  { label: 'Verde Editorial', color: '#1E4635' },
  { label: 'Terracota', color: '#B85F30' },
  { label: 'Dorado Ocre', color: '#C98A2C' },
  { label: 'Verde Pino', color: '#2F6B52' },
  { label: 'Gris Pizarra', color: '#4B5563' },
  { label: 'Azul Clásico', color: '#1E3A8A' },
  { label: 'Madera Caoba', color: '#7C2D12' },
] as const;

const DIGITAL_COLLECTIONS: Array<{
  key: DigitalCollectionKey;
  title: string;
  description: string;
  icon: typeof Tablet;
}> = [
  {
    key: 'KINDLE',
    title: 'Amazon Kindle',
    description: 'Biblioteca de eBooks en Kindle (.azw3, .kfx o nube de Amazon)',
    icon: Tablet,
  },
  {
    key: 'KOBO',
    title: 'Rakuten Kobo',
    description: 'Lector Kobo eReader (.kepub, .epub)',
    icon: BookOpen,
  },
  {
    key: 'APPLE_BOOKS',
    title: 'Apple Books',
    description: 'Ecosistema de lectura en iPhone, iPad y Mac',
    icon: Smartphone,
  },
  {
    key: 'EPUB_PDF',
    title: 'Biblioteca ePub / PDF',
    description: 'Lector universal de archivos locales sin DRM o documentos PDF',
    icon: FileText,
  },
];

function parseAuthors(authorsJson?: string | null): string {
  if (!authorsJson) return 'Autor desconocido';
  try {
    const list = JSON.parse(authorsJson);
    if (Array.isArray(list) && list.length > 0) {
      return list.join(', ');
    }
  } catch {
    // Fallback silencioso
  }
  return 'Autor desconocido';
}

export function ShelvesManagerModal({
  visible,
  book,
  shelves,
  existingEditionsCount = 1,
  onClose,
  onAssignPhysicalShelf,
  onAssignDigitalCollection,
  onCreateShelf,
  onRemoveFromShelf,
}: ShelvesManagerModalProps) {
  const [activeTab, setActiveTab] = useState<'PHYSICAL' | 'DIGITAL'>(
    book.modality === 'DIGITAL' ? 'DIGITAL' : 'PHYSICAL'
  );

  // Formulario para nueva estantería
  const [isCreatingShelf, setIsCreatingShelf] = useState<boolean>(false);
  const [newFurnitureName, setNewFurnitureName] = useState<string>('');
  const [newShelfLevel, setNewShelfLevel] = useState<string>('');
  const [selectedColorTag, setSelectedColorTag] = useState<string>(
    COLOR_PRESETS[0].color
  );
  const [formError, setFormError] = useState<string | null>(null);

  const currentShelf = shelves.find((s) => s.id === book.shelfId);
  const authorName = parseAuthors(book.authorsJson);

  const handleCreateNewShelf = async () => {
    if (!newFurnitureName.trim()) {
      setFormError('Escribe el nombre del mueble o librero');
      return;
    }
    setFormError(null);
    try {
      await onCreateShelf({
        furnitureName: newFurnitureName.trim(),
        shelfLevel: newShelfLevel.trim() || undefined,
        colorTag: selectedColorTag,
      });
      setNewFurnitureName('');
      setNewShelfLevel('');
      setIsCreatingShelf(false);
    } catch {
      setFormError('No se pudo guardar la estantería. Intenta nuevamente.');
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <View style={styles.sheetContainer}>
          {/* Cabecera */}
          <View style={styles.header}>
            <View style={styles.headerTitles}>
              <Text style={styles.modalTitle}>Ubicación en estantería</Text>
              <Text style={styles.bookTitle} numberOfLines={1}>
                {book.title}
              </Text>
              <Text style={styles.bookAuthor} numberOfLines={1}>
                {authorName}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Cerrar modal"
            >
              <X size={20} color={colors.light.textMuted} />
            </Pressable>
          </View>

          {/* Banner de múltiples ediciones si existen */}
          {existingEditionsCount > 1 ? (
            <View style={styles.editionsBanner}>
              <Layers size={18} color={colors.light.accent} />
              <Text style={styles.editionsBannerText}>
                Tienes {existingEditionsCount} ediciones registradas de este
                libro. Puedes asignar cada edición a un mueble físico o colección
                digital independiente.
              </Text>
            </View>
          ) : null}

          {/* Pestañas: Estanterías Físicas vs Colecciones Digitales */}
          <View style={styles.tabBar}>
            <Pressable
              onPress={() => setActiveTab('PHYSICAL')}
              style={[
                styles.tabItem,
                activeTab === 'PHYSICAL' && styles.tabItemActive,
              ]}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === 'PHYSICAL' }}
            >
              <BookMarked
                size={16}
                color={
                  activeTab === 'PHYSICAL'
                    ? colors.light.primary
                    : colors.light.textMuted
                }
              />
              <Text
                style={[
                  styles.tabItemText,
                  activeTab === 'PHYSICAL' && styles.tabItemTextActive,
                ]}
              >
                Estanterías Físicas
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setActiveTab('DIGITAL')}
              style={[
                styles.tabItem,
                activeTab === 'DIGITAL' && styles.tabItemActive,
              ]}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === 'DIGITAL' }}
            >
              <Tablet
                size={16}
                color={
                  activeTab === 'DIGITAL'
                    ? colors.light.primary
                    : colors.light.textMuted
                }
              />
              <Text
                style={[
                  styles.tabItemText,
                  activeTab === 'DIGITAL' && styles.tabItemTextActive,
                ]}
              >
                Colección Digital
              </Text>
            </Pressable>
          </View>

          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* PESTAÑA FÍSICA */}
            {activeTab === 'PHYSICAL' ? (
              <View style={styles.sectionBody}>
                {/* Ubicación actual */}
                <View style={styles.currentLocationCard}>
                  <View style={styles.currentLocationHeader}>
                    <MapPin size={18} color={colors.light.primary} />
                    <Text style={styles.currentLocationTitle}>
                      Ubicación física actual
                    </Text>
                  </View>
                  {currentShelf ? (
                    <View style={styles.currentLocationInfo}>
                      <View
                        style={[
                          styles.colorTagCircle,
                          { backgroundColor: currentShelf.colorTag },
                        ]}
                      />
                      <View style={styles.currentLocationDetails}>
                        <Text style={styles.currentFurnitureName}>
                          {currentShelf.furnitureName}
                        </Text>
                        <Text style={styles.currentShelfLevel}>
                          {currentShelf.shelfLevel || 'Sin nivel especificado'}
                        </Text>
                      </View>
                      {onRemoveFromShelf ? (
                        <Pressable
                          onPress={onRemoveFromShelf}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          style={styles.unassignButton}
                          accessibilityRole="button"
                          accessibilityLabel="Quitar de esta estantería"
                        >
                          <Trash2 size={16} color={colors.light.danger} />
                        </Pressable>
                      ) : null}
                    </View>
                  ) : (
                    <Text style={styles.noLocationText}>
                      Este libro físico aún no tiene un mueble o repisa asignado.
                    </Text>
                  )}
                </View>

                {/* Lista de estanterías disponibles */}
                <View style={styles.listHeaderRow}>
                  <Text style={styles.listSectionTitle}>
                    Selecciona un mueble o repisa:
                  </Text>
                  <Pressable
                    onPress={() => setIsCreatingShelf(!isCreatingShelf)}
                    style={styles.addShelfToggleButton}
                  >
                    <Plus size={14} color={colors.light.primary} />
                    <Text style={styles.addShelfToggleText}>
                      {isCreatingShelf ? 'Cancelar' : 'Nueva repisa'}
                    </Text>
                  </Pressable>
                </View>

                {/* Formulario desplegable para nueva estantería */}
                {isCreatingShelf ? (
                  <View style={styles.createShelfCard}>
                    <Text style={styles.createShelfTitle}>
                      Registrar nuevo mueble o repisa
                    </Text>

                    {formError ? (
                      <Text style={styles.formErrorText}>{formError}</Text>
                    ) : null}

                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>
                        Nombre del mueble o librero:
                      </Text>
                      <TextInput
                        style={styles.inputField}
                        value={newFurnitureName}
                        onChangeText={setNewFurnitureName}
                        placeholder="Ej. Librero Principal, Vitrina Sala..."
                        placeholderTextColor={colors.light.textSubtle}
                      />
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>
                        Nivel, balda o repisa (opcional):
                      </Text>
                      <TextInput
                        style={styles.inputField}
                        value={newShelfLevel}
                        onChangeText={setNewShelfLevel}
                        placeholder="Ej. Balda 2, Nivel Superior..."
                        placeholderTextColor={colors.light.textSubtle}
                      />
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>
                        Etiqueta de color distintiva:
                      </Text>
                      <View style={styles.colorPresetsRow}>
                        {COLOR_PRESETS.map((preset) => {
                          const isSelected = selectedColorTag === preset.color;
                          return (
                            <Pressable
                              key={preset.color}
                              onPress={() => setSelectedColorTag(preset.color)}
                              style={[
                                styles.colorSwatch,
                                { backgroundColor: preset.color },
                                isSelected && styles.colorSwatchSelected,
                              ]}
                              accessibilityLabel={preset.label}
                            >
                              {isSelected ? (
                                <Check size={14} color="#FFFFFF" />
                              ) : null}
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>

                    <SafeButton
                      title="Guardar nueva estantería"
                      variant="primary"
                      size="md"
                      onPress={handleCreateNewShelf}
                    />
                  </View>
                ) : null}

                {/* Tarjetas de estanterías existentes */}
                {shelves.length === 0 && !isCreatingShelf ? (
                  <View style={styles.emptyShelvesCard}>
                    <Text style={styles.emptyShelvesText}>
                      No tienes estanterías físicas creadas todavía. Crea una
                      pulsando en &quot;Nueva repisa&quot; arriba.
                    </Text>
                  </View>
                ) : (
                  shelves.map((shelf) => {
                    const isSelected = book.shelfId === shelf.id;
                    return (
                      <View
                        key={shelf.id}
                        style={[
                          styles.shelfCard,
                          isSelected && styles.shelfCardActive,
                        ]}
                      >
                        <View
                          style={[
                            styles.colorTagPill,
                            { backgroundColor: shelf.colorTag },
                          ]}
                        />
                        <View style={styles.shelfCardDetails}>
                          <Text style={styles.shelfFurnitureText}>
                            {shelf.furnitureName}
                          </Text>
                          <Text style={styles.shelfLevelText}>
                            {shelf.shelfLevel || 'Sin nivel especificado'}
                          </Text>
                        </View>
                        <SafeButton
                          title={isSelected ? 'Asignado' : 'Asignar aquí'}
                          variant={isSelected ? 'secondary' : 'outline'}
                          size="sm"
                          disabled={isSelected}
                          onPress={() => onAssignPhysicalShelf(shelf.id)}
                        />
                      </View>
                    );
                  })
                )}
              </View>
            ) : null}

            {/* PESTAÑA DIGITAL */}
            {activeTab === 'DIGITAL' ? (
              <View style={styles.sectionBody}>
                <View style={styles.digitalIntroCard}>
                  <Text style={styles.digitalIntroTitle}>
                    Colecciones y formatos de lectura digital
                  </Text>
                  <Text style={styles.digitalIntroText}>
                    Asigna este libro a tu lector digital predilecto para
                    clasificarlo en tus filtros de biblioteca y sincronizar tu
                    formato.
                  </Text>
                </View>

                {DIGITAL_COLLECTIONS.map((col) => {
                  const isAssigned = book.format === col.key;
                  const ColIcon = col.icon;
                  return (
                    <View
                      key={col.key}
                      style={[
                        styles.digitalCard,
                        isAssigned && styles.digitalCardActive,
                      ]}
                    >
                      <View style={styles.digitalCardIconWrap}>
                        <ColIcon
                          size={22}
                          color={
                            isAssigned
                              ? colors.light.primary
                              : colors.light.textMuted
                          }
                        />
                      </View>
                      <View style={styles.digitalCardContent}>
                        <Text style={styles.digitalCardTitle}>{col.title}</Text>
                        <Text style={styles.digitalCardDescription}>
                          {col.description}
                        </Text>
                      </View>
                      <SafeButton
                        title={isAssigned ? 'Asignado' : 'Asignar'}
                        variant={isAssigned ? 'secondary' : 'outline'}
                        size="sm"
                        disabled={isAssigned}
                        onPress={() => onAssignDigitalCollection(col.key)}
                      />
                    </View>
                  );
                })}
              </View>
            ) : null}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(28, 25, 23, 0.55)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: colors.light.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 32 : 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.borderSubtle,
  },
  headerTitles: {
    flex: 1,
    marginRight: 12,
  },
  modalTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.light.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  bookTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.light.text,
  },
  bookAuthor: {
    fontSize: 13,
    color: colors.light.textMuted,
    marginTop: 2,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.light.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editionsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.light.badgeBg,
    marginHorizontal: 16,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  editionsBannerText: {
    flex: 1,
    fontSize: 12,
    color: colors.light.badgeText,
    lineHeight: 16,
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.borderSubtle,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: colors.light.surface,
    borderWidth: 1,
    borderColor: colors.light.borderSubtle,
  },
  tabItemActive: {
    backgroundColor: colors.light.badgeBg,
    borderColor: colors.light.primary,
  },
  tabItemText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.light.textMuted,
  },
  tabItemTextActive: {
    color: colors.light.primary,
    fontWeight: '700',
  },
  scrollArea: {
    paddingHorizontal: 16,
  },
  scrollContent: {
    paddingVertical: 16,
  },
  sectionBody: {
    gap: 14,
  },
  currentLocationCard: {
    backgroundColor: colors.light.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.light.border,
    gap: 10,
  },
  currentLocationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  currentLocationTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.light.text,
  },
  currentLocationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.light.surfaceAlt,
    borderRadius: 10,
    padding: 10,
    gap: 10,
  },
  colorTagCircle: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  currentLocationDetails: {
    flex: 1,
  },
  currentFurnitureName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.light.text,
  },
  currentShelfLevel: {
    fontSize: 12,
    color: colors.light.textMuted,
  },
  unassignButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: colors.light.surface,
  },
  noLocationText: {
    fontSize: 13,
    color: colors.light.textMuted,
    fontStyle: 'italic',
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  listSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.light.text,
  },
  addShelfToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.light.badgeBg,
  },
  addShelfToggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.light.primary,
  },
  createShelfCard: {
    backgroundColor: colors.light.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.light.primary,
    gap: 12,
  },
  createShelfTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.light.primary,
  },
  formErrorText: {
    fontSize: 12,
    color: colors.light.danger,
    fontWeight: '600',
  },
  inputGroup: {
    gap: 4,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.light.textMuted,
  },
  inputField: {
    backgroundColor: colors.light.surfaceAlt,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.light.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: colors.light.text,
  },
  colorPresetsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 4,
  },
  colorSwatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorSwatchSelected: {
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  emptyShelvesCard: {
    backgroundColor: colors.light.surface,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.light.borderSubtle,
    alignItems: 'center',
  },
  emptyShelvesText: {
    fontSize: 13,
    color: colors.light.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  shelfCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.light.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.light.border,
    gap: 10,
  },
  shelfCardActive: {
    borderColor: colors.light.primary,
    backgroundColor: colors.light.badgeBg,
  },
  colorTagPill: {
    width: 6,
    height: 36,
    borderRadius: 3,
  },
  shelfCardDetails: {
    flex: 1,
  },
  shelfFurnitureText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.light.text,
  },
  shelfLevelText: {
    fontSize: 12,
    color: colors.light.textMuted,
  },
  digitalIntroCard: {
    backgroundColor: colors.light.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.light.border,
    gap: 6,
  },
  digitalIntroTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.light.text,
  },
  digitalIntroText: {
    fontSize: 12,
    color: colors.light.textMuted,
    lineHeight: 17,
  },
  digitalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.light.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.light.border,
    gap: 12,
  },
  digitalCardActive: {
    borderColor: colors.light.primary,
    backgroundColor: colors.light.badgeBg,
  },
  digitalCardIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.light.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digitalCardContent: {
    flex: 1,
  },
  digitalCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.light.text,
  },
  digitalCardDescription: {
    fontSize: 11,
    color: colors.light.textMuted,
    lineHeight: 15,
    marginTop: 2,
  },
});
