import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Camera, Check, Layers, Image as ImageIcon, Search, X } from 'lucide-react-native';
import { colors } from '@/core/theme/colors';

export interface CoverSelectorCarouselProps {
  covers: string[];
  selectedCoverUri?: string | null;
  onSelectCover: (uri: string) => void;
  onCaptureManualCover: () => void;
  onSearchCustomQuery?: (query: string) => Promise<void>;
  isCapturing?: boolean;
}

export const CoverSelectorCarousel: React.FC<CoverSelectorCarouselProps> = ({
  covers,
  selectedCoverUri,
  onSelectCover,
  onCaptureManualCover,
  onSearchCustomQuery,
  isCapturing = false,
}) => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const hasCovers = covers.length > 0;

  const handleSearchSubmit = async () => {
    if (!searchQuery.trim() || !onSearchCustomQuery) return;
    try {
      setIsSearching(true);
      await onSearchCustomQuery(searchQuery.trim());
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.titleWithIcon}>
          <Layers size={16} color={colors.light.primary} />
          <Text style={styles.sectionTitle}>Edición y portada</Text>
        </View>
        <View style={styles.headerActions}>
          {onSearchCustomQuery && (
            <Pressable
              onPress={() => setIsSearchOpen(!isSearchOpen)}
              style={styles.searchToggleBtn}
              accessibilityRole="button"
              accessibilityLabel="Buscar otra edición"
            >
              <Search size={14} color={colors.light.primary} />
              <Text style={styles.searchToggleText}>
                {isSearchOpen ? 'Cerrar búsqueda' : 'Buscar otra'}
              </Text>
            </Pressable>
          )}
          <Text style={styles.countBadge}>
            {covers.length} {covers.length === 1 ? 'encontrada' : 'encontradas'}
          </Text>
        </View>
      </View>

      <Text style={styles.sectionSubtitle}>
        Elige la portada que coincida con tu ejemplar físico o tómale una foto directa.
      </Text>

      {/* Barra opcional de búsqueda por editorial o edición */}
      {isSearchOpen && onSearchCustomQuery && (
        <View style={styles.searchBarContainer}>
          <Search size={16} color={colors.light.textMuted} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearchSubmit}
            placeholder="Buscar por editorial o versión (ej. Debolsillo, Alianza)..."
            placeholderTextColor={colors.light.textSubtle}
            style={styles.searchInput}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
              <X size={16} color={colors.light.textMuted} />
            </Pressable>
          )}
          <Pressable
            onPress={handleSearchSubmit}
            disabled={isSearching || !searchQuery.trim()}
            style={[
              styles.searchSubmitBtn,
              (!searchQuery.trim() || isSearching) && styles.searchSubmitBtnDisabled,
            ]}
          >
            {isSearching ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.searchSubmitBtnText}>Buscar</Text>
            )}
          </Pressable>
        </View>
      )}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Botón de acción para fotografiar la portada real */}
        <Pressable
          onPress={onCaptureManualCover}
          disabled={isCapturing}
          style={({ pressed }) => [
            styles.actionCard,
            pressed && styles.actionCardPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Fotografiar portada de tu libro"
        >
          <View style={styles.actionIconCircle}>
            <Camera size={22} color={colors.light.primary} />
          </View>
          <Text style={styles.actionCardTitle}>Fotografiar</Text>
          <Text style={styles.actionCardSubtitle}>Portada real</Text>
        </Pressable>

        {/* Lista de portadas alternativas encontradas */}
        {covers.map((coverUrl, index) => {
          const isSelected = selectedCoverUri === coverUrl;
          const isLocal =
            coverUrl.startsWith('file://') || coverUrl.includes('covers/');

          return (
            <Pressable
              key={`${coverUrl}-${index}`}
              onPress={() => onSelectCover(coverUrl)}
              style={({ pressed }) => [
                styles.coverCard,
                isSelected && styles.coverCardSelected,
                pressed && styles.coverCardPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Seleccionar portada ${index + 1}`}
            >
              <Image
                source={{ uri: coverUrl }}
                style={styles.coverImage}
                resizeMode="cover"
              />

              {isSelected && (
                <View style={styles.selectedBadge}>
                  <Check size={12} color="#FFFFFF" strokeWidth={3} />
                </View>
              )}

              {isLocal && (
                <View style={styles.localPhotoTag}>
                  <Text style={styles.localPhotoText}>Tu foto</Text>
                </View>
              )}
            </Pressable>
          );
        })}

        {!hasCovers && (
          <View style={styles.emptyStateCard}>
            <ImageIcon size={22} color={colors.light.textMuted} />
            <Text style={styles.emptyStateText}>Sin portadas web</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFE9DF',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  searchToggleText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.light.primary,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.light.text,
  },
  countBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.light.textMuted,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: colors.light.textMuted,
    marginBottom: 8,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.light.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: colors.light.text,
    paddingVertical: 2,
  },
  searchSubmitBtn: {
    backgroundColor: colors.light.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchSubmitBtnDisabled: {
    opacity: 0.5,
  },
  searchSubmitBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  scrollContent: {
    paddingVertical: 4,
    gap: 10,
    alignItems: 'center',
  },
  actionCard: {
    width: 78,
    height: 116,
    borderRadius: 8,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.light.primary,
    backgroundColor: '#F3EFE8',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
  },
  actionCardPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  actionIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  actionCardTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.light.primary,
    textAlign: 'center',
  },
  actionCardSubtitle: {
    fontSize: 10,
    color: colors.light.textMuted,
    textAlign: 'center',
  },
  coverCard: {
    width: 78,
    height: 116,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: colors.light.border,
    backgroundColor: colors.light.surfaceAlt,
    position: 'relative',
  },
  coverCardSelected: {
    borderColor: colors.light.primary,
    borderWidth: 2.5,
    shadowColor: colors.light.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  coverCardPressed: {
    opacity: 0.85,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  selectedBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.light.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
    elevation: 2,
  },
  localPhotoTag: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    right: 4,
    backgroundColor: 'rgba(30, 70, 53, 0.92)',
    borderRadius: 4,
    paddingVertical: 2,
    alignItems: 'center',
  },
  localPhotoText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  emptyStateCard: {
    width: 140,
    height: 116,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.light.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 12,
  },
  emptyStateText: {
    fontSize: 11,
    color: colors.light.textMuted,
    textAlign: 'center',
  },
});
