import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { ALL_GENRES } from '../data/catalog';
import { searchCatalogMedia, searchRemoteMedia } from '../services/tmdbService';
import type { FavoriteItem, MediaItem, MediaType } from '../types/media';
import { MediaCard } from '../components/MediaCard';
import { SkeletonCard } from '../components/SkeletonCard';
import { EmptyState } from '../components/EmptyState';

interface DiscoverPageProps {
  initialQuery?: string;
  autoFocusSearch?: boolean;
  favorites: FavoriteItem[];
  onOpenDetail: (media: MediaItem) => void;
  onToggleFavorite: (media: MediaItem) => void;
  onCatalogExpand?: (items: MediaItem[]) => void;
}

export function DiscoverPage({
  initialQuery = '',
  autoFocusSearch = false,
  favorites,
  onOpenDetail,
  onToggleFavorite,
  onCatalogExpand,
}: DiscoverPageProps) {
  const [rawQuery, setRawQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [mediaType, setMediaType] = useState<'all' | MediaType>('all');
  const [selectedGenre, setSelectedGenre] = useState<string>('Alle');
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [results, setResults] = useState<MediaItem[]>(() =>
    searchCatalogMedia({ query: initialQuery, mediaType: 'all', genre: 'Alle' })
  );
  const [dataSource, setDataSource] = useState<'tmdb' | 'catalog'>('catalog');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const loadMoreControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setRawQuery(initialQuery);
    setDebouncedQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    if (autoFocusSearch) {
      searchInputRef.current?.focus();
    }
  }, [autoFocusSearch]);

  // Debounced search query (250ms) to avoid redundant API requests
  useEffect(() => {
    if (rawQuery === debouncedQuery) {
      return;
    }
    setIsSearching(true);
    const timer = window.setTimeout(() => {
      setDebouncedQuery(rawQuery);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [rawQuery, debouncedQuery]);

  // Fetch live TMDB results (or curated catalog fallback) whenever filters settle
  useEffect(() => {
    loadMoreControllerRef.current?.abort();
    const controller = new AbortController();
    let active = true;
    setIsSearching(true);
    setIsLoadingMore(false);
    setPage(1);
    setHasMore(false);
    setErrorMessage(null);

    searchRemoteMedia(
      {
        query: debouncedQuery,
        mediaType,
        genre: selectedGenre,
        page: 1,
      },
      controller.signal
    )
      .then((res) => {
        if (!active) return;
        setResults(res.items);
        setDataSource(res.source);
        setPage(res.page);
        setHasMore(res.hasMore);
        setIsSearching(false);
        if (res.items.length > 0 && onCatalogExpand) {
          onCatalogExpand(res.items);
        }
      })
      .catch((err: unknown) => {
        if (!active || (err as Error)?.name === 'AbortError') return;
        setResults(
          searchCatalogMedia({
            query: debouncedQuery,
            mediaType,
            genre: selectedGenre,
          })
        );
        setDataSource('catalog');
        setPage(1);
        setHasMore(false);
        setErrorMessage('Live-Suche momentan nicht erreichbar – lokaler Katalog wird angezeigt.');
        setIsSearching(false);
      });

    return () => {
      active = false;
      controller.abort();
      loadMoreControllerRef.current?.abort();
    };
  }, [debouncedQuery, mediaType, selectedGenre, onCatalogExpand]);

  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMore || dataSource !== 'tmdb') return;
    loadMoreControllerRef.current?.abort();
    const controller = new AbortController();
    loadMoreControllerRef.current = controller;
    const nextPage = page + 1;
    setIsLoadingMore(true);

    try {
      const res = await searchRemoteMedia(
        {
          query: debouncedQuery,
          mediaType,
          genre: selectedGenre,
          page: nextPage,
        },
        controller.signal
      );

      if (res.source === 'tmdb' && res.items.length > 0) {
        setResults((prev) => {
          const seen = new Set(prev.map((item) => item.id));
          const uniqueIncoming = res.items.filter((item) => !seen.has(item.id));
          return [...prev, ...uniqueIncoming];
        });
        setPage(res.page);
        setHasMore(res.hasMore);
        if (onCatalogExpand) {
          onCatalogExpand(res.items);
        }
      } else {
        setHasMore(false);
      }
    } catch (err: unknown) {
      if ((err as Error)?.name !== 'AbortError') {
        setHasMore(false);
      }
    } finally {
      setIsLoadingMore(false);
    }
  };

  const favoriteIds = useMemo(() => new Set(favorites.map((f) => f.mediaId)), [favorites]);

  const resetFilters = () => {
    setRawQuery('');
    setDebouncedQuery('');
    setMediaType('all');
    setSelectedGenre('Alle');
  };

  return (
    <div className="space-y-8">
      {/* Page Title & Search Bar */}
      <section className="space-y-5">
        <div className="space-y-1.5">
          <h1 className="font-display text-3xl font-bold tracking-tight text-[#F5F5F7]">
            Entdecken &amp; Suchen
          </h1>
          <p className="text-sm text-[#A0A0AD]">
            Durchsuche Filme und Serien nach Titel, Genre, Regie oder Besetzung.
          </p>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#A0A0AD]"
              aria-hidden="true"
            />
            <input
              ref={searchInputRef}
              type="text"
              inputMode="search"
              value={rawQuery}
              onChange={(e) => setRawQuery(e.target.value)}
              aria-label="Filme und Serien durchsuchen"
              placeholder="Titel, Regie, Schauspieler oder Stichwort eingeben…"
              className="h-12 w-full rounded-xl border border-[#30303A] bg-[#17171D] pr-10 pl-10 text-sm text-[#F5F5F7] placeholder:text-[#A0A0AD]/60 focus:border-[#9275E8] focus:outline-none"
            />
            {rawQuery && (
              <button
                type="button"
                onClick={() => setRawQuery('')}
                aria-label="Suchfeld leeren"
                className="absolute top-1/2 right-2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-[#A0A0AD] hover:text-[#F5F5F7]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>

          {/* Media Type Filter */}
          <div
            role="group"
            aria-label="Medientyp filtern"
            className="flex items-center gap-1 rounded-xl border border-[#30303A] bg-[#17171D] p-1"
          >
            {(
              [
                { id: 'all', label: 'Alle' },
                { id: 'movie', label: 'Filme' },
                { id: 'tv', label: 'Serien' },
              ] as const
            ).map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setMediaType(option.id)}
                aria-pressed={mediaType === option.id}
                className={`min-h-[40px] rounded-lg px-4 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  mediaType === option.id
                    ? 'bg-[#9275E8] text-[#101014]'
                    : 'text-[#A0A0AD] hover:text-[#F5F5F7]'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Genre Filter Strip */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#A0A0AD] shrink-0">
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Genre:</span>
          </span>
          {['Alle', ...ALL_GENRES].map((genre) => {
            const active = selectedGenre === genre;
            return (
              <button
                key={genre}
                type="button"
                onClick={() => setSelectedGenre(genre)}
                aria-pressed={active}
                className={`min-h-[34px] rounded-lg border px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'border-[#9275E8] bg-[#9275E8]/15 text-[#F5F5F7]'
                    : 'border-[#30303A] bg-[#17171D] text-[#A0A0AD] hover:border-[#4A4A5A] hover:text-[#F5F5F7]'
                }`}
              >
                {genre}
              </button>
            );
          })}
        </div>
      </section>

      {errorMessage && (
        <div
          role="status"
          className="rounded-xl border border-[#30303A] bg-[#17171D] px-4 py-3 text-xs text-[#A0A0AD]"
        >
          {errorMessage}
        </div>
      )}

      {/* Results Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#30303A] pb-3 text-xs text-[#A0A0AD]">
        <div className="flex items-center gap-2">
          <span className="tabular-nums">
            {isSearching
              ? 'Suche läuft…'
              : `${results.length} ${results.length === 1 ? 'Ergebnis' : 'Ergebnisse'} gefunden`}
          </span>
          <span aria-hidden="true">·</span>
          <span>{dataSource === 'tmdb' ? 'Quelle: TMDB Live' : 'Quelle: Kuratierter Katalog'}</span>
        </div>

        {(rawQuery || mediaType !== 'all' || selectedGenre !== 'Alle') && (
          <button
            type="button"
            onClick={resetFilters}
            className="font-medium text-[#B29AF5] hover:underline"
          >
            Filter zurücksetzen
          </button>
        )}
      </div>

      {/* Results Grid / Skeleton / Empty */}
      {isSearching ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, index) => (
            <SkeletonCard key={index} />
          ))}
        </div>
      ) : results.length > 0 ? (
        <div className="space-y-8">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {results.map((item) => (
              <MediaCard
                key={item.id}
                media={item}
                isFavorite={favoriteIds.has(item.id)}
                onOpenDetail={onOpenDetail}
                onToggleFavorite={onToggleFavorite}
              />
            ))}
          </div>

          {hasMore && dataSource === 'tmdb' && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[#30303A] bg-[#17171D] px-6 py-2.5 text-sm font-medium text-[#F5F5F7] transition-colors hover:border-[#9275E8] hover:bg-[#1E1E27] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoadingMore ? 'Weitere Titel werden geladen…' : 'Weitere Titel laden'}
              </button>
            </div>
          )}
        </div>
      ) : (
        <EmptyState
          icon={<Search className="h-6 w-6" />}
          title="Keine passenden Titel gefunden"
          description="Für deine aktuelle Suche oder Filterkombination liegen keine Treffer vor. Versuche einen anderen Suchbegriff oder setze die Filter zurück."
          actionLabel="Alle Titel anzeigen"
          onAction={resetFilters}
        />
      )}
    </div>
  );
}
