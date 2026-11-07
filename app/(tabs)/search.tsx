import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Search,
  X,
  BookOpen,
  Smartphone,
  Bookmark,
  ScanBarcode,
  Sparkles,
  Quote,
  Users,
  FileText,
  Eye,
  EyeOff,
  ShoppingBag,
  Plus,
} from 'lucide-react-native';
import { BooksRepository } from '@/db/repositories/booksRepository';
import { BookQuotesRepository } from '@/db/repositories/bookQuotesRepository';
import { ReadingLogsRepository } from '@/db/repositories/readingLogsRepository';
import { Book } from '@/db/schema/books';
import { BookQuote } from '@/db/schema/bookQuotes';
import { ReadingLog } from '@/db/schema/readingLogs';
import { colors } from '@/core/theme/colors';
import { SafeButton } from '@/shared/components/SafeButton';
import {
  SearchListSkeleton,
  AiDetectiveSkeleton,
} from '@/shared/components/Skeleton';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import {
  DeepLibrarySearchService,
  DeepSearchResult,
  SearchScope,
  HighlightedSnippet,
} from '@/features/smart-search/services/deepLibrarySearchService';
import { GeminiSmartSearchClient } from '@/features/smart-search/services/geminiSmartSearchClient';
import { EnrichedLiteraryCandidate } from '@/features/smart-search/schemas/geminiSearchSchema';

type SearchMode = 'LOCAL_FTS' | 'AI_DETECTIVE';

const AI_EXAMPLE_PROMPTS = [
  'Novela donde un pueblo entero pierde la memoria por la peste del insomnio y ponen letreros a las cosas',
  'Cuento sobre una biblioteca infinita compuesta por salas hexagonales',
  'Novela sobre un hombre que viaja a Comala buscando a su padre Pedro',
];

function renderHighlightedText(snippet: HighlightedSnippet) {
  if (!snippet.hasMatch) {
    return <Text style={styles.snippetText}>{snippet.before}</Text>;
  }
  return (
    <Text style={styles.snippetText}>
      {snippet.before}
      <Text style={styles.snippetHighlight}>{snippet.match}</Text>
      {snippet.after}
    </Text>
  );
}

export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [mode, setMode] = useState<SearchMode>('LOCAL_FTS');
  const [scope, setScope] = useState<SearchScope>('ALL');

  // Estado de Búsqueda Profunda Local FTS5 (debounce 280ms)
  const [localQuery, setLocalQuery] = useState('');
  const debouncedLocalQuery = useDebouncedValue(localQuery, 280);
  const [isSearchingLocal, setIsSearchingLocal] = useState(false);
  const [deepResult, setDeepResult] = useState<DeepSearchResult | null>(null);
  const [revealedSpoilerIds, setRevealedSpoilerIds] = useState<
    Record<string, boolean>
  >({});

  // Datos cacheados para cruce local instantáneo
  const [allBooks, setAllBooks] = useState<Book[]>([]);
  const [allQuotes, setAllQuotes] = useState<BookQuote[]>([]);
  const [allLogs, setAllLogs] = useState<ReadingLog[]>([]);

  // Estado del Detective Literario IA (debounce 450ms + AbortController)
  const [aiQuery, setAiQuery] = useState('');
  const debouncedAiQuery = useDebouncedValue(aiQuery, 450);
  const [isSearchingAi, setIsSearchingAi] = useState(false);
  const [aiCandidates, setAiCandidates] = useState<EnrichedLiteraryCandidate[]>(
    []
  );
  const [aiError, setAiError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cargar datos base de la biblioteca local
  const refreshLocalSnapshot = async () => {
    try {
      const [booksList, quotesList] = await Promise.all([
        BooksRepository.getAll(),
        BookQuotesRepository.getAll(),
      ]);
      setAllBooks(booksList);
      setAllQuotes(quotesList);

      const logsArrays = await Promise.all(
        booksList.slice(0, 50).map((b) => ReadingLogsRepository.getByBookId(b.id))
      );
      setAllLogs(logsArrays.flat());
    } catch (err) {
      console.error('Error cargando índice local para búsqueda:', err);
    }
  };

  useEffect(() => {
    refreshLocalSnapshot();
  }, []);

  // Efecto Búsqueda Local FTS5 + Sin Diacríticos (280ms)
  useEffect(() => {
    const trimmed = debouncedLocalQuery.trim();
    if (!trimmed) {
      setDeepResult(null);
      setIsSearchingLocal(false);
      return;
    }

    let isCancelled = false;
    setIsSearchingLocal(true);

    (async () => {
      try {
        // Ejecutamos también consulta en SQLite FTS5 nativa para asegurar warm-up de índices
        await Promise.all([
          BooksRepository.search(trimmed),
          BookQuotesRepository.searchFts(trimmed),
        ]);

        if (!isCancelled) {
          const result = DeepLibrarySearchService.searchLocalLibrary({
            query: trimmed,
            scope,
            books: allBooks,
            quotes: allQuotes,
            logs: allLogs,
          });
          setDeepResult(result);
        }
      } catch (err) {
        console.error('Error en búsqueda profunda FTS5:', err);
      } finally {
        if (!isCancelled) {
          setIsSearchingLocal(false);
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [debouncedLocalQuery, scope, allBooks, allQuotes, allLogs]);

  // Efecto Detective Literario IA con Gemini 2.5 Flash (450ms + AbortController)
  useEffect(() => {
    const trimmed = debouncedAiQuery.trim();
    if (!trimmed || trimmed.length < 4) {
      setAiCandidates([]);
      setAiError(null);
      setIsSearchingAi(false);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsSearchingAi(true);
    setAiError(null);

    (async () => {
      try {
        const response = await GeminiSmartSearchClient.search({
          query: trimmed,
          signal: controller.signal,
          localBooks: allBooks,
        });

        if (controller.signal.aborted || response.status === 'ABORTED') {
          return;
        }

        if (response.status === 'SUCCESS') {
          setAiCandidates(response.candidates);
        } else {
          setAiError(
            response.errorMessage ??
              'No se pudo completar el análisis del Detective Literario.'
          );
          setAiCandidates([]);
        }
      } catch {
        if (!controller.signal.aborted) {
          setAiError('Error al consultar al Detective Literario.');
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsSearchingAi(false);
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [debouncedAiQuery, allBooks]);

  const toggleRevealSpoiler = (itemId: string) => {
    setRevealedSpoilerIds((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  const handleSaveCandidateBook = async (
    candidate: EnrichedLiteraryCandidate,
    targetOwnership: 'OWNED' | 'WISHLIST'
  ) => {
    try {
      const now = Date.now();
      const newId = `book_ai_${now.toString(36)}_${Math.random()
        .toString(36)
        .slice(2, 7)}`;

      const created = await BooksRepository.create({
        id: newId,
        isbn13: candidate.resolvedIsbn13 ?? candidate.isbn13 ?? null,
        isbn10: null,
        title: candidate.title,
        subtitle: null,
        seriesName: null,
        seriesIndex: null,
        authorsJson: JSON.stringify([candidate.author]),
        translator: null,
        publisher:
          candidate.resolvedPublisher ?? candidate.suggestedPublisher ?? null,
        description: candidate.spoilerFreeReason,
        coverUri: candidate.coverUri ?? null,
        pageCount:
          candidate.pageCount && candidate.pageCount > 0
            ? candidate.pageCount
            : 250,
        modality: 'PHYSICAL',
        ownership: targetOwnership,
        metadataStatus: 'COMPLETE',
        format: 'RUSTICA',
        progressMode: 'PAGES',
        language: 'es',
        currentStatus: targetOwnership === 'WISHLIST' ? 'WISHLIST' : 'POR_LEER',
        currentPage: 0,
        currentPercentage: 0,
        rating: null,
        pauseOrDnfNote: null,
        isSpoiler: false,
        shelfId: null,
        wishlistStoreNote:
          targetOwnership === 'WISHLIST'
            ? 'Hallado con Detective Literario IA'
            : null,
        createdAt: now,
        updatedAt: now,
      });

      await refreshLocalSnapshot();
      router.push(`/book/${created.id}`);
    } catch {
      Alert.alert('Error', 'No se pudo registrar el libro sugerido.');
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Cabecera y selector de modo: FTS5 Local vs Detective IA */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View>
            <Text style={styles.kicker}>Explorador de Lecturas</Text>
            <Text style={styles.screenTitle}>
              {mode === 'LOCAL_FTS'
                ? 'En Mi Biblioteca'
                : 'Detective Literario'}
            </Text>
          </View>
          <View style={styles.techPill}>
            <Text style={styles.techPillText}>
              {mode === 'LOCAL_FTS' ? 'Libros, citas y notas' : 'Por recuerdos'}
            </Text>
          </View>
        </View>

        <View style={styles.modeSelector}>
          <Pressable
            testID="tab-mode-local-fts"
            onPress={() => setMode('LOCAL_FTS')}
            style={[
              styles.modeButton,
              mode === 'LOCAL_FTS' && styles.modeButtonActive,
            ]}
          >
            <Search
              size={15}
              color={
                mode === 'LOCAL_FTS'
                  ? colors.light.surface
                  : colors.light.textMuted
              }
            />
            <Text
              style={[
                styles.modeButtonText,
                mode === 'LOCAL_FTS' && styles.modeButtonTextActive,
              ]}
            >
              Mi Biblioteca
            </Text>
          </Pressable>

          <Pressable
            testID="tab-mode-ai-detective"
            onPress={() => setMode('AI_DETECTIVE')}
            style={[
              styles.modeButton,
              mode === 'AI_DETECTIVE' && styles.modeButtonActiveAccent,
            ]}
          >
            <Sparkles
              size={15}
              color={
                mode === 'AI_DETECTIVE'
                  ? colors.light.surface
                  : colors.light.textMuted
              }
            />
            <Text
              style={[
                styles.modeButtonText,
                mode === 'AI_DETECTIVE' && styles.modeButtonTextActive,
              ]}
            >
              Detective Literario
            </Text>
          </Pressable>
        </View>
      </View>

      {mode === 'LOCAL_FTS' ? (
        <View style={styles.flexOne}>
          {/* Barra de búsqueda FTS5 sin acentos */}
          <View style={styles.searchSection}>
            <View style={styles.searchBar}>
              <Search size={19} color={colors.light.primary} />
              <TextInput
                testID="fts-search-input"
                value={localQuery}
                onChangeText={setLocalQuery}
                placeholder="Título, autor, frase subrayada, personaje o nota..."
                placeholderTextColor={colors.light.textSubtle}
                style={styles.input}
                returnKeyType="search"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {localQuery.length > 0 ? (
                <Pressable
                  onPress={() => setLocalQuery('')}
                  hitSlop={10}
                  style={styles.clearButton}
                >
                  <X size={18} color={colors.light.textMuted} />
                </Pressable>
              ) : null}
            </View>

            {/* Chips de alcance */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.scopeRow}
            >
              {(
                [
                  {
                    key: 'ALL',
                    label: `Todo (${deepResult?.counts.total ?? 0})`,
                  },
                  {
                    key: 'BOOKS',
                    label: `Libros (${deepResult?.counts.books ?? 0})`,
                  },
                  {
                    key: 'QUOTES',
                    label: `Citas (${deepResult?.counts.quotes ?? 0})`,
                  },
                  {
                    key: 'CHARACTERS',
                    label: `Personajes (${deepResult?.counts.characters ?? 0})`,
                  },
                  {
                    key: 'NOTES',
                    label: `Notas (${deepResult?.counts.notes ?? 0})`,
                  },
                ] as Array<{ key: SearchScope; label: string }>
              ).map((chip) => {
                const active = scope === chip.key;
                return (
                  <Pressable
                    key={chip.key}
                    onPress={() => setScope(chip.key)}
                    style={[styles.scopeChip, active && styles.scopeChipActive]}
                  >
                    <Text
                      style={[
                        styles.scopeChipText,
                        active && styles.scopeChipTextActive,
                      ]}
                    >
                      {chip.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {isSearchingLocal && !deepResult ? (
            <SearchListSkeleton count={4} />
          ) : localQuery.trim().length === 0 ? (
            <ScrollView contentContainerStyle={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Search
                  size={34}
                  color={colors.light.primary}
                  strokeWidth={1.6}
                />
              </View>
              <Text style={styles.emptyTitle}>
                Busca en toda tu biblioteca
              </Text>
              <Text style={styles.emptySubtitle}>
                Encuentra al instante cualquier libro, autor, frase que hayas
                guardado, personaje o nota personal sin importar si escribes con
                o sin acentos.
              </Text>
            </ScrollView>
          ) : deepResult && deepResult.counts.total === 0 ? (
            <ScrollView contentContainerStyle={styles.emptyContainer}>
              <Text style={styles.noResultsTitle}>
                Sin coincidencias en tu biblioteca para "{localQuery}"
              </Text>
              <Text style={styles.noResultsSubtitle}>
                Si solo recuerdas fragmentos de la trama, una escena o una frase
                aproximada, prueba el Detective Literario con IA.
              </Text>
              <SafeButton
                variant="primary"
                onPress={() => {
                  setAiQuery(localQuery);
                  setMode('AI_DETECTIVE');
                }}
                leftIcon={<Sparkles size={17} color={colors.light.surface} />}
                title="Consultar al Detective Literario IA"
                style={styles.noResultsButton}
              />
              <SafeButton
                variant="secondary"
                onPress={() => router.push('/scan')}
                leftIcon={
                  <ScanBarcode size={17} color={colors.light.primary} />
                }
                title="Escanear código ISBN con cámara"
                style={styles.noResultsButton}
              />
            </ScrollView>
          ) : (
            <ScrollView
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            >
              {/* 1. Coincidencias en Libros */}
              {deepResult?.matchedBooks.map((item) => {
                let authorLabel = 'Autor desconocido';
                try {
                  const parsed = JSON.parse(item.authorsJson || '[]');
                  if (Array.isArray(parsed) && parsed.length > 0) {
                    authorLabel = String(parsed[0]);
                  }
                } catch {
                  // Fallback
                }

                return (
                  <Pressable
                    key={`book-${item.id}`}
                    onPress={() => router.push(`/book/${item.id}`)}
                    style={styles.resultCard}
                  >
                    <View style={styles.resultRow}>
                      <View style={styles.coverWrapper}>
                        {item.coverUri ? (
                          <Image
                            source={{ uri: item.coverUri }}
                            style={styles.coverImage}
                            resizeMode="cover"
                          />
                        ) : (
                          <View
                            style={[styles.coverImage, styles.coverFallback]}
                          >
                            <Bookmark size={20} color={colors.light.primary} />
                          </View>
                        )}
                      </View>

                      <View style={styles.infoWrapper}>
                        <Text style={styles.bookTitle} numberOfLines={2}>
                          {item.title}
                        </Text>
                        <Text style={styles.bookAuthor} numberOfLines={1}>
                          {authorLabel}
                        </Text>

                        <View style={styles.metadataRow}>
                          {item.publisher ? (
                            <Text
                              style={styles.bookPublisher}
                              numberOfLines={1}
                            >
                              {item.publisher}
                            </Text>
                          ) : null}
                          <View style={styles.badge}>
                            {item.book.modality === 'PHYSICAL' ? (
                              <>
                                <BookOpen
                                  size={11}
                                  color={colors.light.primary}
                                />
                                <Text style={styles.badgeText}>Físico</Text>
                              </>
                            ) : (
                              <>
                                <Smartphone
                                  size={11}
                                  color={colors.light.accent}
                                />
                                <Text style={styles.badgeText}>eBook</Text>
                              </>
                            )}
                          </View>
                        </View>
                      </View>
                    </View>

                    {item.snippet.hasMatch ? (
                      <View style={styles.snippetBox}>
                        <Text style={styles.snippetLabel}>
                          Coincidencia en {item.matchedField}
                        </Text>
                        {renderHighlightedText(item.snippet)}
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}

              {/* 2. Coincidencias en Citas OCR */}
              {deepResult?.matchedQuotes.map((qItem) => {
                const isRevealed = Boolean(revealedSpoilerIds[qItem.id]);
                const shouldHide = qItem.isSpoiler && !isRevealed;

                return (
                  <View key={`quote-${qItem.id}`} style={styles.resultCard}>
                    <View style={styles.deepHeaderRow}>
                      <View style={styles.typePillAccent}>
                        <Quote size={12} color="#FFFFFF" />
                        <Text style={styles.typePillText}>
                          CITA GUARDADA
                          {qItem.pageNumber ? ` · Pág. ${qItem.pageNumber}` : ''}
                        </Text>
                      </View>
                      {qItem.book ? (
                        <Pressable
                          onPress={() => router.push(`/book/${qItem.bookId}`)}
                        >
                          <Text style={styles.bookLinkText} numberOfLines={1}>
                            {qItem.book.title}
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>

                    {shouldHide ? (
                      <Pressable
                        onPress={() => toggleRevealSpoiler(qItem.id)}
                        style={styles.spoilerGate}
                      >
                        <EyeOff size={15} color={colors.light.danger} />
                        <Text style={styles.spoilerGateText}>
                          Cita marcada con spoiler · Tocar para revelar
                        </Text>
                      </Pressable>
                    ) : (
                      <View style={styles.snippetBox}>
                        {renderHighlightedText(qItem.snippet)}
                        {qItem.isSpoiler ? (
                          <Pressable
                            onPress={() => toggleRevealSpoiler(qItem.id)}
                            style={styles.hideSpoilerBtn}
                          >
                            <Eye size={13} color={colors.light.textMuted} />
                            <Text style={styles.hideSpoilerText}>
                              Ocultar spoiler
                            </Text>
                          </Pressable>
                        ) : null}
                      </View>
                    )}
                  </View>
                );
              })}

              {/* 3. Coincidencias en Glosario de Personajes */}
              {deepResult?.matchedCharacters.map((cItem) => {
                const isRevealed = Boolean(revealedSpoilerIds[cItem.id]);
                const shouldHide = cItem.isSpoiler && !isRevealed;

                return (
                  <View key={`char-${cItem.id}`} style={styles.resultCard}>
                    <View style={styles.deepHeaderRow}>
                      <View style={styles.typePillPrimary}>
                        <Users size={12} color="#FFFFFF" />
                        <Text style={styles.typePillText}>
                          PERSONAJE
                          {cItem.pageNumber
                            ? ` · Hasta pág. ${cItem.pageNumber}`
                            : ''}
                        </Text>
                      </View>
                      {cItem.book ? (
                        <Pressable
                          onPress={() => router.push(`/book/${cItem.bookId}`)}
                        >
                          <Text style={styles.bookLinkText} numberOfLines={1}>
                            {cItem.book.title}
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>

                    {shouldHide ? (
                      <Pressable
                        onPress={() => toggleRevealSpoiler(cItem.id)}
                        style={styles.spoilerGate}
                      >
                        <EyeOff size={15} color={colors.light.danger} />
                        <Text style={styles.spoilerGateText}>
                          Ficha con spoiler · Tocar para revelar
                        </Text>
                      </Pressable>
                    ) : (
                      <View style={[styles.snippetBox, styles.snippetBoxChar]}>
                        {renderHighlightedText(cItem.snippet)}
                      </View>
                    )}
                  </View>
                );
              })}

              {/* 4. Coincidencias en Notas Anti-Olvido y Reseñas */}
              {deepResult?.matchedNotes.map((nItem) => {
                const isRevealed = Boolean(revealedSpoilerIds[nItem.id]);
                const shouldHide = nItem.isSpoiler && !isRevealed;

                return (
                  <View key={`note-${nItem.id}`} style={styles.resultCard}>
                    <View style={styles.deepHeaderRow}>
                      <View style={styles.typePillSoft}>
                        <FileText size={12} color={colors.light.text} />
                        <Text style={styles.typePillSoftText}>
                          NOTA / RESEÑA
                        </Text>
                      </View>
                      {nItem.book ? (
                        <Pressable
                          onPress={() => router.push(`/book/${nItem.bookId}`)}
                        >
                          <Text style={styles.bookLinkText} numberOfLines={1}>
                            {nItem.book.title}
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>

                    {shouldHide ? (
                      <Pressable
                        onPress={() => toggleRevealSpoiler(nItem.id)}
                        style={styles.spoilerGate}
                      >
                        <EyeOff size={15} color={colors.light.danger} />
                        <Text style={styles.spoilerGateText}>
                          Nota protegida por spoiler · Tocar para revelar
                        </Text>
                      </Pressable>
                    ) : (
                      <View style={styles.snippetBox}>
                        {renderHighlightedText(nItem.snippet)}
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      ) : (
        /* MODO 2: DETECTIVE LITERARIO IA (GEMINI 2.5 FLASH + ZOD) */
        <ScrollView
          style={styles.flexOne}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.aiPromptBox}>
            <View style={styles.aiPromptHeader}>
              <View style={styles.aiHeaderLeft}>
                <Sparkles size={16} color={colors.light.accent} />
                <Text style={styles.aiPromptTitle}>
                  Describe la trama, escena o frase que recuerdas
                </Text>
              </View>
              {aiQuery.length > 0 ? (
                <Pressable onPress={() => setAiQuery('')} hitSlop={8}>
                  <X size={17} color={colors.light.textMuted} />
                </Pressable>
              ) : null}
            </View>

            <TextInput
              testID="ai-detective-input"
              value={aiQuery}
              onChangeText={setAiQuery}
              placeholder="Ej: Novela donde un pueblo pierde la memoria por la peste del insomnio..."
              placeholderTextColor={colors.light.textSubtle}
              multiline
              numberOfLines={3}
              style={styles.aiTextarea}
            />

            <View style={styles.exampleChipsContainer}>
              <Text style={styles.exampleChipsLabel}>
                Ejemplos rápidos sin spoilers:
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.exampleChipsScroll}
              >
                {AI_EXAMPLE_PROMPTS.map((sample, idx) => (
                  <Pressable
                    key={idx}
                    onPress={() => setAiQuery(sample)}
                    style={styles.exampleChip}
                  >
                    <Text style={styles.exampleChipText} numberOfLines={1}>
                      {sample}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </View>

          {isSearchingAi ? (
            <AiDetectiveSkeleton count={2} />
          ) : aiError ? (
            <View style={styles.resultCard}>
              <Text style={styles.noResultsTitle}>Aviso del Detective IA</Text>
              <Text style={styles.noResultsSubtitle}>{aiError}</Text>
            </View>
          ) : aiCandidates.length > 0 ? (
            <>
              {aiCandidates.map((cand, index) => (
                <View
                  key={`${cand.title}-${index}`}
                  style={[
                    styles.resultCard,
                    cand.inLocalLibrary && styles.candidateInLibraryCard,
                  ]}
                >
                  <View style={styles.resultRow}>
                    <View style={styles.coverWrapperLarge}>
                      {cand.coverUri ? (
                        <Image
                          source={{ uri: cand.coverUri }}
                          style={styles.coverImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <View
                          style={[styles.coverImage, styles.coverFallback]}
                        >
                          <BookOpen size={22} color={colors.light.primary} />
                        </View>
                      )}
                    </View>

                    <View style={styles.infoWrapper}>
                      <View style={styles.candidateBadgesRow}>
                        <View style={styles.matchBadge}>
                          <Text style={styles.matchBadgeText}>
                            {cand.matchPercentage}% Coincidencia
                          </Text>
                        </View>

                        {cand.inLocalLibrary ? (
                          <View style={styles.inLibBadge}>
                            <Text style={styles.inLibBadgeText}>
                              En tu Biblioteca
                            </Text>
                          </View>
                        ) : (
                          <View style={styles.externalBadge}>
                            <Text style={styles.externalBadgeText}>
                              Catálogo Externo
                            </Text>
                          </View>
                        )}
                      </View>

                      <Text style={styles.bookTitle}>{cand.title}</Text>
                      <Text style={styles.bookAuthor}>
                        {cand.author}
                        {cand.resolvedPublisher
                          ? ` · ${cand.resolvedPublisher}`
                          : ''}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.whyBox}>
                    <Text style={styles.whyTitle}>
                      Por qué coincide (libre de spoilers):
                    </Text>
                    <Text style={styles.whyBody}>{cand.spoilerFreeReason}</Text>
                  </View>

                  {cand.inLocalLibrary && cand.localBook ? (
                    <SafeButton
                      variant="primary"
                      title="Abrir en Mi Biblioteca"
                      leftIcon={
                        <BookOpen size={16} color={colors.light.surface} />
                      }
                      onPress={() =>
                        router.push(`/book/${cand.localBook?.id}`)
                      }
                      style={styles.candidateActionBtn}
                    />
                  ) : (
                    <View style={styles.candidateActionsGrid}>
                      <View style={styles.flexOne}>
                        <SafeButton
                          variant="secondary"
                          title="A Wishlist"
                          leftIcon={
                            <ShoppingBag
                              size={15}
                              color={colors.light.primary}
                            />
                          }
                          onPress={() =>
                            handleSaveCandidateBook(cand, 'WISHLIST')
                          }
                        />
                      </View>
                      <View style={styles.flexOne}>
                        <SafeButton
                          variant="primary"
                          title="Registrar libro"
                          leftIcon={
                            <Plus size={15} color={colors.light.surface} />
                          }
                          onPress={() => handleSaveCandidateBook(cand, 'OWNED')}
                        />
                      </View>
                    </View>
                  )}
                </View>
              ))}

              <Text style={styles.aiDisclaimer}>
                Las sugerencias de Gemini 2.5 Flash son orientativas y se
                validan con Zod frente a tu biblioteca local y el catálogo.
              </Text>
            </>
          ) : (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Sparkles
                  size={34}
                  color={colors.light.accent}
                  strokeWidth={1.6}
                />
              </View>
              <Text style={styles.emptyTitle}>Detective Literario sin Spoilers</Text>
              <Text style={styles.emptySubtitle}>
                Escribe lo que recuerdes de la historia, un personaje o una
                frase aproximada. El motor cruzará los candidatos con tu
                biblioteca local y el catálogo de portadas reales.
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.light.background,
  },
  flexOne: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.borderSubtle,
    backgroundColor: colors.light.surface,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  kicker: {
    fontSize: 12,
    color: colors.light.textMuted,
    fontWeight: '600',
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.light.text,
  },
  techPill: {
    backgroundColor: colors.light.badgeBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  techPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.light.badgeText,
  },
  modeSelector: {
    flexDirection: 'row',
    backgroundColor: colors.light.surfaceAlt,
    borderRadius: 12,
    padding: 4,
    gap: 6,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 9,
  },
  modeButtonActive: {
    backgroundColor: colors.light.primary,
  },
  modeButtonActiveAccent: {
    backgroundColor: colors.light.accent,
  },
  modeButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.light.textMuted,
  },
  modeButtonTextActive: {
    color: colors.light.surface,
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.light.surface,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.light.primary,
    paddingHorizontal: 12,
    height: 48,
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: colors.light.text,
    fontWeight: '600',
  },
  clearButton: {
    padding: 4,
  },
  scopeRow: {
    gap: 8,
    paddingVertical: 10,
  },
  scopeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.light.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  scopeChipActive: {
    backgroundColor: colors.light.primary,
    borderColor: colors.light.primary,
  },
  scopeChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.light.textMuted,
  },
  scopeChipTextActive: {
    color: colors.light.surface,
  },
  listContent: {
    padding: 16,
    gap: 12,
    paddingBottom: 36,
  },
  resultCard: {
    backgroundColor: colors.light.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.light.border,
    padding: 12,
  },
  candidateInLibraryCard: {
    borderColor: colors.light.primary,
    borderWidth: 1.5,
  },
  resultRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  coverWrapper: {
    width: 52,
    height: 76,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: colors.light.surfaceAlt,
  },
  coverWrapperLarge: {
    width: 68,
    height: 102,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: colors.light.surfaceAlt,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverFallback: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2EDE4',
  },
  infoWrapper: {
    flex: 1,
  },
  bookTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.light.text,
    lineHeight: 20,
  },
  bookAuthor: {
    fontSize: 13,
    color: colors.light.textMuted,
    marginTop: 2,
  },
  metadataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  bookPublisher: {
    fontSize: 12,
    color: colors.light.accent,
    fontWeight: '600',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.light.badgeBg,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.light.badgeText,
  },
  snippetBox: {
    marginTop: 8,
    backgroundColor: colors.light.surfaceAlt,
    borderLeftWidth: 3,
    borderLeftColor: colors.light.accent,
    borderRadius: 8,
    padding: 10,
  },
  snippetBoxChar: {
    borderLeftColor: colors.light.primary,
  },
  snippetLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.light.accent,
    marginBottom: 2,
  },
  snippetText: {
    fontSize: 13,
    color: colors.light.text,
    lineHeight: 18,
  },
  snippetHighlight: {
    backgroundColor: 'rgba(201, 138, 44, 0.32)',
    fontWeight: '800',
    color: colors.light.text,
  },
  deepHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  typePillAccent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.light.accent,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  typePillPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.light.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  typePillSoft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.light.badgeBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  typePillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  typePillSoftText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.light.text,
  },
  bookLinkText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.light.primary,
    maxWidth: 170,
  },
  spoilerGate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: colors.light.dangerBg,
  },
  spoilerGateText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.light.danger,
  },
  hideSpoilerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  hideSpoilerText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.light.textMuted,
  },
  aiPromptBox: {
    backgroundColor: colors.light.surface,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.light.accent,
    padding: 12,
  },
  aiPromptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  aiHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  aiPromptTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.light.text,
  },
  aiTextarea: {
    backgroundColor: colors.light.surfaceAlt,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.light.border,
    padding: 10,
    fontSize: 13,
    color: colors.light.text,
    minHeight: 68,
    textAlignVertical: 'top',
  },
  exampleChipsContainer: {
    marginTop: 10,
  },
  exampleChipsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.light.textMuted,
    marginBottom: 6,
  },
  exampleChipsScroll: {
    gap: 8,
  },
  exampleChip: {
    backgroundColor: colors.light.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: 250,
  },
  exampleChipText: {
    fontSize: 12,
    color: colors.light.text,
    fontWeight: '600',
  },
  candidateBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
  },
  matchBadge: {
    backgroundColor: colors.light.successBg,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  matchBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.light.primary,
  },
  inLibBadge: {
    backgroundColor: colors.light.primary,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  inLibBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  externalBadge: {
    backgroundColor: colors.light.badgeBg,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  externalBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.light.badgeText,
  },
  whyBox: {
    marginTop: 10,
    backgroundColor: colors.light.surfaceAlt,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  whyTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.light.text,
    marginBottom: 3,
  },
  whyBody: {
    fontSize: 13,
    color: colors.light.textMuted,
    lineHeight: 18,
  },
  candidateActionBtn: {
    marginTop: 10,
  },
  candidateActionsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  aiDisclaimer: {
    fontSize: 12,
    color: colors.light.textMuted,
    textAlign: 'center',
    marginTop: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 28,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.light.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.light.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.light.text,
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.light.textMuted,
    textAlign: 'center',
    lineHeight: 19,
  },
  noResultsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.light.text,
    marginBottom: 6,
    textAlign: 'center',
  },
  noResultsSubtitle: {
    fontSize: 13,
    color: colors.light.textMuted,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 14,
  },
  noResultsButton: {
    marginTop: 8,
    width: '100%',
  },
});
