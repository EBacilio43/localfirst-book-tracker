import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  Image,
  ScrollView,
  Modal,
  Alert,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import {
  Flashlight,
  FlashlightOff,
  Zap,
  ZapOff,
  BookOpen,
  Smartphone,
  Check,
  AlertCircle,
  X,
  Bookmark,
  Camera,
  Layers,
  ShoppingBag,
} from 'lucide-react-native';
import { useScannerStore } from '@/features/scanner/store/scannerStore';
import { BooksRepository } from '@/db/repositories/booksRepository';
import { colors } from '@/core/theme/colors';
import { SafeButton } from '@/shared/components/SafeButton';

const { width } = Dimensions.get('window');

export default function ScanScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();

  const {
    isBurstMode,
    isTorchOn,
    queue,
    activeResolvedCandidate,
    isDuplicateActive,
    setBurstMode,
    toggleTorch,
    processScannedBarcode,
    removeFromQueue,
    clearQueue,
    clearActiveCandidate,
  } = useScannerStore();

  const [selectedModality, setSelectedModality] = useState<'PHYSICAL' | 'DIGITAL'>('PHYSICAL');
  const [selectedOwnership, setSelectedOwnership] = useState<'OWNED' | 'WISHLIST'>('OWNED');
  const [wishlistStoreNote, setWishlistStoreNote] = useState<string>('');
  const [seriesNameInput, setSeriesNameInput] = useState<string>('');
  const [seriesIndexInput, setSeriesIndexInput] = useState<string>('');
  const [selectedPublisher, setSelectedPublisher] = useState<string>('');

  // Bottom sheet modal state
  const isBottomSheetVisible = !!activeResolvedCandidate;

  // Manejador del escáner de código de barras
  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (!data) return;
    await processScannedBarcode(data);
  };

  // Guardar libro desde el Bottom Sheet
  const handleSaveActiveCandidate = async () => {
    if (!activeResolvedCandidate) return;

    try {
      const now = Date.now();
      const parsedIndex = seriesIndexInput.trim() ? Number(seriesIndexInput.trim()) : null;
      const isWishlist = selectedOwnership === 'WISHLIST';

      const newBook = await BooksRepository.create({
        id: `book-${now}-${Math.random().toString(36).substring(2, 7)}`,
        isbn13: activeResolvedCandidate.isbn13,
        isbn10: activeResolvedCandidate.isbn10,
        title: activeResolvedCandidate.title,
        subtitle: activeResolvedCandidate.subtitle,
        seriesName: seriesNameInput.trim() || null,
        seriesIndex: parsedIndex !== null && !Number.isNaN(parsedIndex) ? parsedIndex : null,
        authorsJson: JSON.stringify(activeResolvedCandidate.authors),
        publisher: selectedPublisher || activeResolvedCandidate.publisher || 'Editorial no especificada',
        description: activeResolvedCandidate.description,
        coverUri: activeResolvedCandidate.coverUri,
        pageCount: activeResolvedCandidate.pageCount,
        modality: selectedModality,
        ownership: isWishlist ? 'WISHLIST' : 'OWNED',
        metadataStatus: activeResolvedCandidate.title === 'Libro sin conexión' ? 'PENDING_OFFLINE_SYNC' : 'COMPLETE',
        currentStatus: isWishlist ? 'WISHLIST' : 'POR_LEER',
        currentPage: 0,
        currentPercentage: 0,
        wishlistStoreNote: isWishlist && wishlistStoreNote.trim() ? wishlistStoreNote.trim() : null,
        isSpoiler: false,
        createdAt: now,
        updatedAt: now,
      });

      setWishlistStoreNote('');
      setSeriesNameInput('');
      setSeriesIndexInput('');
      setSelectedOwnership('OWNED');
      clearActiveCandidate();
      Alert.alert(
        isWishlist ? 'Agregado a Wishlist' : 'Libro Guardado',
        isWishlist
          ? `"${newBook.title}" se guardó en tu lista de deseos.`
          : `"${newBook.title}" ya está en tu librero.`
      );
    } catch (err) {
      Alert.alert('Error', 'No se pudo guardar el libro en la base de datos local.');
    }
  };

  // Guardar todos los libros en cola (Modo Ráfaga)
  const handleSaveAllBurst = async () => {
    if (queue.length === 0) return;

    let savedCount = 0;
    const now = Date.now();

    for (const item of queue) {
      if (item.candidate) {
        await BooksRepository.create({
          id: `book-${now}-${Math.random().toString(36).substring(2, 7)}`,
          isbn13: item.candidate.isbn13,
          isbn10: item.candidate.isbn10,
          title: item.candidate.title,
          subtitle: item.candidate.subtitle,
          authorsJson: JSON.stringify(item.candidate.authors),
          publisher: item.candidate.publisher || 'Editorial no especificada',
          description: item.candidate.description,
          coverUri: item.candidate.coverUri,
          pageCount: item.candidate.pageCount,
          modality: 'PHYSICAL',
          ownership: 'OWNED',
          metadataStatus: item.status === 'OFFLINE_PENDING' ? 'PENDING_OFFLINE_SYNC' : 'COMPLETE',
          currentStatus: 'POR_LEER',
          currentPage: 0,
          currentPercentage: 0,
          isSpoiler: false,
          createdAt: now,
          updatedAt: now,
        });
        savedCount++;
      }
    }

    clearQueue();
    Alert.alert('Ráfaga Completada', `Se han guardado ${savedCount} libros en tu librero.`);
    router.replace('/');
  };

  // Permisos de cámara
  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={[styles.permissionContainer, { paddingTop: insets.top }]}>
        <View style={styles.permissionIconCircle}>
          <Camera size={44} color={colors.light.primary} />
        </View>
        <Text style={styles.permissionTitle}>Permiso de Cámara Requerido</Text>
        <Text style={styles.permissionSubtitle}>
          BaciBooks necesita acceso a tu cámara para escanear los códigos de barras ISBN a 60 fps y registrar tus libros al instante.
        </Text>
        <SafeButton
          title="Permitir acceso a la cámara"
          onPress={async () => {
            await requestPermission();
          }}
          style={styles.permissionButton}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Visor de Cámara */}
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        enableTorch={isTorchOn}
        barcodeScannerSettings={{
          barcodeTypes: ['ean13', 'ean8', 'upc_a'],
        }}
        onBarcodeScanned={handleBarcodeScanned}
      />

      {/* Controles Superiores Flotantes */}
      <View style={[styles.topControls, { top: insets.top + 12 }]}>
        <Pressable onPress={toggleTorch} style={[styles.controlBtn, isTorchOn && styles.controlBtnActive]}>
          {isTorchOn ? <FlashlightOff size={20} color="#FFFFFF" /> : <Flashlight size={20} color="#FFFFFF" />}
          <Text style={styles.controlBtnText}>{isTorchOn ? 'Apagar' : 'Linterna'}</Text>
        </Pressable>

        <Pressable
          onPress={() => setBurstMode(!isBurstMode)}
          style={[styles.controlBtn, isBurstMode && styles.burstBtnActive]}
        >
          {isBurstMode ? <Zap size={20} color="#FFFFFF" /> : <ZapOff size={20} color="#FFFFFF" />}
          <Text style={styles.controlBtnText}>
            {isBurstMode ? `Ráfaga (${queue.length})` : 'Individual'}
          </Text>
        </Pressable>
      </View>

      {/* Retícula Guía Central de Escaneo */}
      <View style={styles.reticleOverlay} pointerEvents="none">
        <View style={styles.reticleBox}>
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
          <View style={styles.laserLine} />
        </View>
        <Text style={styles.reticleHint}>Apunta al código de barras ISBN del libro</Text>
      </View>

      {/* Bandeja de Modo Ráfaga (Bandeja Inferior) */}
      {isBurstMode && queue.length > 0 ? (
        <View style={[styles.burstTray, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.burstTrayHeader}>
            <View style={styles.burstTrayTitleRow}>
              <Layers size={18} color={colors.light.primary} />
              <Text style={styles.burstTrayTitle}>Cola de escaneo ({queue.length})</Text>
            </View>
            <SafeButton
              size="sm"
              variant="primary"
              onPress={handleSaveAllBurst}
              title={`Guardar todos (${queue.length})`}
            />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.burstQueueScroll}>
            {queue.map((item) => (
              <View key={item.id} style={styles.burstQueueCard}>
                <Pressable onPress={() => removeFromQueue(item.id)} style={styles.burstRemoveBadge}>
                  <X size={12} color="#FFFFFF" />
                </Pressable>
                {item.candidate?.coverUri ? (
                  <Image source={{ uri: item.candidate.coverUri }} style={styles.burstCover} resizeMode="cover" />
                ) : (
                  <View style={[styles.burstCover, styles.burstCoverFallback]}>
                    <Bookmark size={16} color={colors.light.primary} />
                  </View>
                )}
                <Text style={styles.burstBookTitle} numberOfLines={1}>
                  {item.candidate?.title || item.isbn13}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {/* Bottom Sheet de Confirmación de Edición / Portada */}
      <Modal
        visible={isBottomSheetVisible}
        animationType="slide"
        transparent
        onRequestClose={clearActiveCandidate}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.bottomSheet, { paddingBottom: insets.bottom + 16 }]}>
            {/* Cabecera del Bottom Sheet */}
            <View style={styles.sheetHeader}>
              <View style={styles.sheetDragBar} />
              <Pressable onPress={clearActiveCandidate} hitSlop={12} style={styles.closeBtn}>
                <X size={20} color={colors.light.textMuted} />
              </Pressable>
            </View>

            {/* Aviso de Libro Duplicado si aplica */}
            {isDuplicateActive ? (
              <View style={styles.duplicateAlert}>
                <AlertCircle size={18} color={colors.light.warning} />
                <Text style={styles.duplicateText}>
                  Ya tienes este libro en tu colección. ¿Deseas agregar una edición o ejemplar adicional?
                </Text>
              </View>
            ) : null}

            {/* Ficha del Libro Resuelto */}
            {activeResolvedCandidate ? (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetBody}>
                <View style={styles.candidateRow}>
                  <View style={styles.candidateCoverWrapper}>
                    {activeResolvedCandidate.coverUri ? (
                      <Image
                        source={{ uri: activeResolvedCandidate.coverUri }}
                        style={styles.candidateCover}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={[styles.candidateCover, styles.coverFallback]}>
                        <Bookmark size={28} color={colors.light.primary} />
                      </View>
                    )}
                  </View>

                  <View style={styles.candidateInfo}>
                    <Text style={styles.candidateTitle} numberOfLines={2}>
                      {activeResolvedCandidate.title}
                    </Text>
                    <Text style={styles.candidateAuthor} numberOfLines={1}>
                      {activeResolvedCandidate.authors.join(', ')}
                    </Text>
                    <Text style={styles.candidateMeta}>
                      {activeResolvedCandidate.pageCount > 0 ? `${activeResolvedCandidate.pageCount} págs · ` : ''}
                      ISBN {activeResolvedCandidate.isbn13}
                    </Text>
                  </View>
                </View>

                {/* Selector de Modalidad (Físico vs eBook) */}
                <Text style={styles.sheetSectionTitle}>Formato del ejemplar</Text>
                <View style={styles.modalityToggle}>
                  <Pressable
                    onPress={() => setSelectedModality('PHYSICAL')}
                    style={[styles.modalityBtn, selectedModality === 'PHYSICAL' && styles.modalityBtnActive]}
                  >
                    <BookOpen size={16} color={selectedModality === 'PHYSICAL' ? '#FFFFFF' : colors.light.textMuted} />
                    <Text style={[styles.modalityBtnText, selectedModality === 'PHYSICAL' && styles.modalityBtnTextActive]}>
                      Libro Físico
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setSelectedModality('DIGITAL')}
                    style={[styles.modalityBtn, selectedModality === 'DIGITAL' && styles.modalityBtnActive]}
                  >
                    <Smartphone size={16} color={selectedModality === 'DIGITAL' ? '#FFFFFF' : colors.light.textMuted} />
                    <Text style={[styles.modalityBtnText, selectedModality === 'DIGITAL' && styles.modalityBtnTextActive]}>
                      eBook / Digital
                    </Text>
                  </Pressable>
                </View>

                {/* Destino: Mi Librero vs Wishlist */}
                <Text style={styles.sheetSectionTitle}>Destino del registro</Text>
                <View style={styles.modalityToggle}>
                  <Pressable
                    onPress={() => setSelectedOwnership('OWNED')}
                    style={[styles.modalityBtn, selectedOwnership === 'OWNED' && styles.modalityBtnActive]}
                  >
                    <Bookmark size={16} color={selectedOwnership === 'OWNED' ? '#FFFFFF' : colors.light.textMuted} />
                    <Text style={[styles.modalityBtnText, selectedOwnership === 'OWNED' && styles.modalityBtnTextActive]}>
                      En Mi Librero
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setSelectedOwnership('WISHLIST')}
                    style={[styles.modalityBtn, selectedOwnership === 'WISHLIST' && styles.modalityBtnActive]}
                  >
                    <ShoppingBag size={16} color={selectedOwnership === 'WISHLIST' ? '#FFFFFF' : colors.light.textMuted} />
                    <Text style={[styles.modalityBtnText, selectedOwnership === 'WISHLIST' && styles.modalityBtnTextActive]}>
                      Para Wishlist
                    </Text>
                  </Pressable>
                </View>

                {selectedOwnership === 'WISHLIST' ? (
                  <View style={styles.publisherRow}>
                    <Text style={styles.sheetSectionTitle}>Tienda y precio estimado</Text>
                    <TextInput
                      value={wishlistStoreNote}
                      onChangeText={setWishlistStoreNote}
                      placeholder="Ej. Gandhi Coyoacán · $385 MXN"
                      placeholderTextColor={colors.light.textSubtle}
                      style={styles.textInputField}
                    />
                  </View>
                ) : null}

                {/* Saga / Serie opcional */}
                <View style={styles.publisherRow}>
                  <Text style={styles.sheetSectionTitle}>Saga / Serie (opcional)</Text>
                  <View style={styles.sagaInputsRow}>
                    <TextInput
                      value={seriesNameInput}
                      onChangeText={setSeriesNameInput}
                      placeholder="Nombre de la saga (ej. Dune)"
                      placeholderTextColor={colors.light.textSubtle}
                      style={[styles.textInputField, { flex: 1 }]}
                    />
                    <TextInput
                      value={seriesIndexInput}
                      onChangeText={setSeriesIndexInput}
                      placeholder="# Tomo"
                      placeholderTextColor={colors.light.textSubtle}
                      keyboardType="decimal-pad"
                      style={[styles.textInputField, { width: 84, textAlign: 'center' }]}
                    />
                  </View>
                </View>

                {/* Editorial */}
                {activeResolvedCandidate.publisher ? (
                  <View style={styles.publisherRow}>
                    <Text style={styles.sheetSectionTitle}>Editorial confirmada</Text>
                    <View style={styles.publisherBadge}>
                      <Text style={styles.publisherBadgeText}>{activeResolvedCandidate.publisher}</Text>
                    </View>
                  </View>
                ) : null}

                {/* Botón de Confirmación Principal */}
                <SafeButton
                  size="lg"
                  variant="primary"
                  onPress={handleSaveActiveCandidate}
                  leftIcon={<Check size={20} color="#FFFFFF" />}
                  title={
                    selectedOwnership === 'WISHLIST'
                      ? 'Guardar en Wishlist'
                      : 'Confirmar y Guardar en Librero'
                  }
                  style={styles.confirmButton}
                />
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: colors.light.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  permissionIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.light.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.light.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.light.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  permissionSubtitle: {
    fontSize: 14,
    color: colors.light.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  permissionButton: {
    width: '100%',
  },
  topControls: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  controlBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(20, 18, 16, 0.75)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  controlBtnActive: {
    backgroundColor: colors.light.gold,
  },
  burstBtnActive: {
    backgroundColor: colors.light.accent,
  },
  controlBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  reticleOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reticleBox: {
    width: width * 0.76,
    height: 180,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#FFFFFF',
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 8 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 8 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 8 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 8 },
  laserLine: {
    width: '90%',
    height: 2,
    backgroundColor: colors.light.accent,
    opacity: 0.8,
  },
  reticleHint: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  burstTray: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.light.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  burstTrayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  burstTrayTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  burstTrayTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.light.text,
  },
  burstQueueScroll: {
    gap: 12,
  },
  burstQueueCard: {
    width: 80,
    position: 'relative',
  },
  burstRemoveBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: colors.light.danger,
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  burstCover: {
    width: 80,
    height: 114,
    borderRadius: 8,
    backgroundColor: colors.light.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  burstCoverFallback: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  burstBookTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.light.text,
    marginTop: 4,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    backgroundColor: colors.light.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
  },
  sheetHeader: {
    alignItems: 'center',
    paddingVertical: 12,
    position: 'relative',
  },
  sheetDragBar: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.light.border,
  },
  closeBtn: {
    position: 'absolute',
    right: 16,
    top: 8,
    padding: 6,
  },
  duplicateAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.light.warningBg,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 10,
  },
  duplicateText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: colors.light.warning,
  },
  sheetBody: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 16,
  },
  candidateRow: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
  },
  candidateCoverWrapper: {
    width: 84,
    height: 126,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: colors.light.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  candidateCover: {
    width: '100%',
    height: '100%',
  },
  coverFallback: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2EDE4',
  },
  candidateInfo: {
    flex: 1,
  },
  candidateTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.light.text,
    lineHeight: 22,
  },
  candidateAuthor: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.light.accent,
    marginTop: 4,
  },
  candidateMeta: {
    fontSize: 12,
    color: colors.light.textMuted,
    marginTop: 6,
  },
  sheetSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.light.text,
  },
  modalityToggle: {
    flexDirection: 'row',
    gap: 12,
  },
  modalityBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.light.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  modalityBtnActive: {
    backgroundColor: colors.light.primary,
    borderColor: colors.light.primary,
  },
  modalityBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.light.textMuted,
  },
  modalityBtnTextActive: {
    color: '#FFFFFF',
  },
  publisherRow: {
    gap: 6,
  },
  publisherBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.light.badgeBg,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  publisherBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.light.badgeText,
  },
  textInputField: {
    backgroundColor: colors.light.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.light.text,
  },
  sagaInputsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  confirmButton: {
    marginTop: 8,
  },
});
