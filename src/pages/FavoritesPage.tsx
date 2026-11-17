import { useMemo, useState } from 'react';
import { ArrowUpDown, Heart, Search, X } from 'lucide-react';
import type { FavoriteItem, MediaItem, MediaType } from '../types/media';
import { MediaCard } from '../components/MediaCard';
import { EmptyState } from '../components/EmptyState';

interface FavoritesPageProps {
  favorites: FavoriteItem[];
  favoriteMediaItems: MediaItem[];
  onOpenDetail: (media: MediaItem) => void;
  onToggleFavorite: (media: MediaItem) => void;
  onGoToDiscover: () => void;
}

type SortOption = 'recent' | 'title' | 'rating' | 'year';

export function FavoritesPage({
  favorites,
  favoriteMediaItems,
  onOpenDetail,
  onToggleFavorite,
  onGoToDiscover,
}: FavoritesPageProps) {
  const [filterType, setFilterType] = useState<'all' | MediaType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('recent');

  const addedAtById = useMemo(
    () => new Map(favorites.map((fav) => [fav.mediaId, fav.createdAt])),
    [favorites]
  );

  const movieCount = useMemo(
    () => favoriteMediaItems.filter((item) => item.mediaType === 'movie').length,
    [favoriteMediaItems]
  );
  const tvCount = useMemo(
    () => favoriteMediaItems.filter((item) => item.mediaType === 'tv').length,
    [favoriteMediaItems]
  );

  const filteredAndSorted = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = favoriteMediaItems.filter((item) => {
      if (filterType !== 'all' && item.mediaType !== filterType) return false;
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.genres.some((g) => g.toLowerCase().includes(q)) ||
        item.directorOrCreator.toLowerCase().includes(q)
      );
    });

    list.sort((a, b) => {
      if (sortBy === 'title') {
        return a.title.localeCompare(b.title, 'de');
      }
      if (sortBy === 'rating') {
        return b.voteAverage - a.voteAverage;
      }
      if (sortBy === 'year') {
        return b.releaseDate.localeCompare(a.releaseDate);
      }
      const dateA = addedAtById.get(a.id) ?? '';
      const dateB = addedAtById.get(b.id) ?? '';
      return dateB.localeCompare(dateA);
    });

    return list;
  }, [favoriteMediaItems, filterType, searchQuery, sortBy, addedAtById]);

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5">
          <h1 className="font-display text-3xl font-bold tracking-tight text-[#F5F5F7]">
            Meine Favoriten
          </h1>
          <p className="text-sm text-[#A0A0AD] tabular-nums">
            {movieCount} {movieCount === 1 ? 'Film' : 'Filme'} · {tvCount}{' '}
            {tvCount === 1 ? 'Serie' : 'Serien'} gespeichert
          </p>
        </div>

        {favoriteMediaItems.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <div
              role="group"
              aria-label="Favoriten nach Typ filtern"
              className="flex items-center gap-1 rounded-xl border border-[#30303A] bg-[#17171D] p-1"
            >
              {(
                [
                  { id: 'all', label: `Alle (${favoriteMediaItems.length})` },
                  { id: 'movie', label: `Filme (${movieCount})` },
                  { id: 'tv', label: `Serien (${tvCount})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterType(tab.id)}
                  aria-pressed={filterType === tab.id}
                  className={`min-h-[36px] rounded-lg px-3 py-1.5 text-xs font-medium tabular-nums transition-colors whitespace-nowrap shrink-0 ${
                    filterType === tab.id
                      ? 'bg-[#9275E8] text-[#101014]'
                      : 'text-[#A0A0AD] hover:text-[#F5F5F7]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {favoriteMediaItems.length === 0 ? (
        <EmptyState
          icon={<Heart className="h-6 w-6" />}
          title="Deine Favoritenliste ist noch leer"
          description="Speichere Filme und Serien, die dir besonders gefallen haben. Sie bilden die Basis für alle persönlichen Empfehlungen."
          actionLabel="Filme & Serien entdecken"
          onAction={onGoToDiscover}
        />
      ) : (
        <>
          {/* Search within favorites & Sort */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 sm:max-w-sm">
              <Search
                className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#A0A0AD]"
                aria-hidden="true"
              />
              <input
                type="text"
                inputMode="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="In Favoriten suchen"
                placeholder="In Favoriten suchen…"
                className="h-11 w-full rounded-lg border border-[#30303A] bg-[#17171D] pr-10 pl-10 text-sm text-[#F5F5F7] placeholder:text-[#A0A0AD]/60 focus:border-[#9275E8] focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Suchfeld leeren"
                  className="absolute top-1/2 right-2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-[#A0A0AD] hover:text-[#F5F5F7]"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <label
                htmlFor="favorites-sort"
                className="inline-flex items-center gap-1.5 text-xs text-[#A0A0AD] whitespace-nowrap"
              >
                <ArrowUpDown className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Sortierung:</span>
              </label>
              <select
                id="favorites-sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="h-11 rounded-lg border border-[#30303A] bg-[#17171D] px-3 text-xs font-medium text-[#F5F5F7] focus:border-[#9275E8] focus:outline-none"
              >
                <option value="recent">Zuletzt hinzugefügt</option>
                <option value="title">Titel (A–Z)</option>
                <option value="rating">Beste Bewertung</option>
                <option value="year">Neuestes Erscheinungsjahr</option>
              </select>
            </div>
          </div>

          {filteredAndSorted.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {filteredAndSorted.map((item) => (
                <MediaCard
                  key={item.id}
                  media={item}
                  isFavorite
                  onOpenDetail={onOpenDetail}
                  onToggleFavorite={onToggleFavorite}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Search className="h-6 w-6" />}
              title="Keine passenden Favoriten"
              description="In deiner Auswahl entspricht kein Favorit deinem aktuellen Suchbegriff oder Filter."
              actionLabel="Filter zurücksetzen"
              onAction={() => {
                setFilterType('all');
                setSearchQuery('');
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
