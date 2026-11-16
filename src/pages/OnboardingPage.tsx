import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Film, Heart, Search, Tv, X } from 'lucide-react';
import type { FavoriteItem, MediaItem, MediaType } from '../types/media';
import { searchCatalogMedia } from '../services/tmdbService';
import { CinemaPoster } from '../components/CinemaPoster';

interface OnboardingPageProps {
  displayName: string;
  favorites: FavoriteItem[];
  onToggleFavorite: (media: MediaItem) => void;
  onComplete: () => void;
}

const RECOMMENDED_MIN_FAVORITES = 5;

export function OnboardingPage({
  displayName,
  favorites,
  onToggleFavorite,
  onComplete,
}: OnboardingPageProps) {
  const [step, setStep] = useState<'intro' | 'select' | 'summary'>('intro');
  const [query, setQuery] = useState('');
  const [mediaType, setMediaType] = useState<'all' | MediaType>('all');

  const favoriteIds = useMemo(() => new Set(favorites.map((f) => f.mediaId)), [favorites]);

  const filteredMedia = useMemo(
    () => searchCatalogMedia({ query, mediaType }),
    [query, mediaType]
  );

  const selectedMedia = useMemo(() => {
    const all = searchCatalogMedia({});
    return all.filter((item) => favoriteIds.has(item.id));
  }, [favoriteIds]);

  const progressPercent = Math.min(
    100,
    Math.round((favorites.length / RECOMMENDED_MIN_FAVORITES) * 100)
  );
  const meetsRecommendedMinimum = favorites.length >= RECOMMENDED_MIN_FAVORITES;

  return (
    <div className="min-h-screen bg-[#101014] px-4 py-8 text-[#F5F5F7] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        {/* Top Onboarding Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#30303A] pb-6">
          <div>
            <p className="font-display text-lg font-bold tracking-tight text-[#F5F5F7]">
              CineMatch
            </p>
            <p className="mt-0.5 text-xs text-[#A0A0AD]">
              Ersteinrichtung · Schritt{' '}
              {step === 'intro' ? '1 von 3' : step === 'select' ? '2 von 3' : '3 von 3'}
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs text-[#A0A0AD]">
            <span className="tabular-nums">
              {favorites.length} / {RECOMMENDED_MIN_FAVORITES} Favoriten empfohlen
            </span>
          </div>
        </div>

        {/* Step 1: Intro */}
        {step === 'intro' && (
          <section className="mx-auto mt-12 max-w-2xl space-y-8 rounded-2xl border border-[#30303A] bg-[#17171D] p-6 sm:p-10">
            <div className="space-y-3">
              <p className="text-xs font-medium text-[#B29AF5]">Willkommen, {displayName}</p>
              <h1 className="font-display text-3xl font-bold tracking-tight text-[#F5F5F7] sm:text-4xl">
                Lass uns deinen Film- und Seriengeschmack kennenlernen.
              </h1>
              <p className="text-base leading-relaxed text-[#A0A0AD]">
                CineMatch analysiert keine oberflächlichen Trends, sondern echte Gemeinsamkeiten
                bei Genres, Themen, Regie, Besetzung und Erzählstil deiner Favoriten.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 border-y border-[#30303A] py-6 sm:grid-cols-3">
              <div className="space-y-1">
                <p className="font-display text-sm font-semibold text-[#F5F5F7]">
                  01. Titel suchen
                </p>
                <p className="text-xs leading-relaxed text-[#A0A0AD]">
                  Durchsuche kuratierte Filme und Serien nach Titel, Genre oder Regie.
                </p>
              </div>
              <div className="space-y-1">
                <p className="font-display text-sm font-semibold text-[#F5F5F7]">
                  02. Favoriten wählen
                </p>
                <p className="text-xs leading-relaxed text-[#A0A0AD]">
                  Wähle mindestens 5 Titel aus, die dich begeistert haben.
                </p>
              </div>
              <div className="space-y-1">
                <p className="font-display text-sm font-semibold text-[#F5F5F7]">
                  03. Empfehlungen erhalten
                </p>
                <p className="text-xs leading-relaxed text-[#A0A0AD]">
                  Erhalte sofort begründete Vorschläge in deinem persönlichen Dashboard.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-xs text-[#A0A0AD]">
                Du kannst deine Favoriten später jederzeit im Profil oder unter „Favoriten“ anpassen.
              </p>
              <button
                type="button"
                onClick={() => setStep('select')}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-[#9275E8] px-5 py-2.5 text-sm font-semibold text-[#101014] transition-colors hover:bg-[#B29AF5] whitespace-nowrap shrink-0"
              >
                <span>Favoriten auswählen</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </section>
        )}

        {/* Step 2: Search & Select Favorites */}
        {step === 'select' && (
          <section className="mt-8 space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-1.5">
                <h1 className="font-display text-2xl font-bold tracking-tight text-[#F5F5F7] sm:text-3xl">
                  Welche Filme und Serien liebst du?
                </h1>
                <p className="text-sm text-[#A0A0AD]">
                  Wähle mindestens 5 Titel aus, damit CineMatch präzise erste Empfehlungen berechnen
                  kann.
                </p>
              </div>

              {/* Progress readout */}
              <div className="w-full max-w-xs space-y-2 rounded-xl border border-[#30303A] bg-[#17171D] p-3.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-[#F5F5F7]">Ausgewählte Titel</span>
                  <span className="font-mono font-semibold tabular-nums text-[#B29AF5]">
                    {favorites.length} / {RECOMMENDED_MIN_FAVORITES}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#101014]">
                  <div
                    className="h-full rounded-full bg-[#9275E8] transition-all duration-200"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Selected Tray */}
            {selectedMedia.length > 0 && (
              <div className="rounded-xl border border-[#30303A] bg-[#17171D] p-4">
                <p className="text-xs font-medium text-[#A0A0AD]">
                  Deine aktuelle Auswahl ({selectedMedia.length})
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedMedia.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onToggleFavorite(item)}
                      aria-label={`„${item.title}“ aus Auswahl entfernen`}
                      className="inline-flex min-h-[36px] items-center gap-2 rounded-lg border border-[#30303A] bg-[#1E1E27] px-3 py-1.5 text-xs font-medium text-[#F5F5F7] transition-colors hover:border-rose-500/50"
                    >
                      <span>{item.title}</span>
                      <X className="h-3.5 w-3.5 text-[#A0A0AD]" aria-hidden="true" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Search and Filter Controls */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search
                  className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#A0A0AD]"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label="Filme und Serien im Onboarding suchen"
                  placeholder="Nach Titel, Genre oder Regie suchen…"
                  className="h-11 w-full rounded-lg border border-[#30303A] bg-[#17171D] pr-4 pl-10 text-sm text-[#F5F5F7] placeholder:text-[#A0A0AD]/60 focus:border-[#9275E8] focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-1 rounded-lg border border-[#30303A] bg-[#17171D] p-1">
                {(['all', 'movie', 'tv'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setMediaType(type)}
                    className={`min-h-[36px] rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                      mediaType === type
                        ? 'bg-[#1E1E27] text-[#F5F5F7]'
                        : 'text-[#A0A0AD] hover:text-[#F5F5F7]'
                    }`}
                  >
                    {type === 'all' ? 'Alle' : type === 'movie' ? 'Filme' : 'Serien'}
                  </button>
                ))}
              </div>
            </div>

            {/* Selectable Poster Grid */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {filteredMedia.map((item) => {
                const isSelected = favoriteIds.has(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onToggleFavorite(item)}
                    aria-pressed={isSelected}
                    aria-label={
                      isSelected
                        ? `„${item.title}“ aus Auswahl entfernen`
                        : `„${item.title}“ als Favorit auswählen`
                    }
                    className={`group flex flex-col rounded-xl border p-2.5 text-left transition-colors ${
                      isSelected
                        ? 'border-[#9275E8] bg-[#9275E8]/12'
                        : 'border-[#30303A] bg-[#1E1E27] hover:border-[#4B4B5C]'
                    }`}
                  >
                    <div className="relative w-full">
                      <CinemaPoster media={item} compact />
                      <div
                        className={`absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-lg border ${
                          isSelected
                            ? 'border-[#9275E8] bg-[#9275E8] text-[#101014]'
                            : 'border-[#30303A] bg-[#101014]/80 text-[#A0A0AD]'
                        }`}
                      >
                        {isSelected ? (
                          <Check className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <Heart className="h-4 w-4" aria-hidden="true" />
                        )}
                      </div>
                    </div>
                    <p className="mt-2.5 font-display text-sm font-semibold text-[#F5F5F7] line-clamp-1">
                      {item.title}
                    </p>
                    <p className="mt-0.5 text-xs text-[#A0A0AD] truncate">
                      {item.mediaType === 'movie' ? 'Film' : 'Serie'} ·{' '}
                      {item.releaseDate.slice(0, 4)}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Navigation Footer */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#30303A] pt-6">
              <button
                type="button"
                onClick={() => setStep('intro')}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-[#30303A] bg-[#17171D] px-4 py-2 text-sm font-medium text-[#F5F5F7] hover:border-[#4A4A5A]"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                <span>Zurück</span>
              </button>

              <div className="flex items-center gap-3">
                {!meetsRecommendedMinimum && (
                  <span className="text-xs text-[#A0A0AD]">
                    Noch {RECOMMENDED_MIN_FAVORITES - favorites.length} empfohlen
                  </span>
                )}
                <button
                  type="button"
                  disabled={favorites.length === 0}
                  onClick={() => setStep('summary')}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-[#9275E8] px-5 py-2.5 text-sm font-semibold text-[#101014] transition-colors hover:bg-[#B29AF5] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <span>Weiter zur Übersicht</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Step 3: Completion Summary */}
        {step === 'summary' && (
          <section className="mx-auto mt-10 max-w-2xl space-y-6 rounded-2xl border border-[#30303A] bg-[#17171D] p-6 sm:p-10">
            <div className="space-y-2">
              <p className="text-xs font-medium text-[#B29AF5]">Profil bereit</p>
              <h1 className="font-display text-3xl font-bold tracking-tight text-[#F5F5F7]">
                Deine erste Auswahl steht fest.
              </h1>
              <p className="text-sm leading-relaxed text-[#A0A0AD]">
                Auf Basis deiner {favorites.length} ausgewählten Favoriten berechnet CineMatch
                jetzt persönliche Film- und Serienempfehlungen.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 border-y border-[#30303A] py-5">
              <div className="flex items-center gap-3">
                <Film className="h-5 w-5 text-[#B29AF5]" aria-hidden="true" />
                <div>
                  <p className="font-mono text-xl font-semibold tabular-nums text-[#F5F5F7]">
                    {favorites.filter((f) => f.mediaType === 'movie').length}
                  </p>
                  <p className="text-xs text-[#A0A0AD]">Ausgewählte Filme</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Tv className="h-5 w-5 text-[#B29AF5]" aria-hidden="true" />
                <div>
                  <p className="font-mono text-xl font-semibold tabular-nums text-[#F5F5F7]">
                    {favorites.filter((f) => f.mediaType === 'tv').length}
                  </p>
                  <p className="text-xs text-[#A0A0AD]">Ausgewählte Serien</p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setStep('select')}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-[#30303A] bg-[#1E1E27] px-4 py-2 text-sm font-medium text-[#F5F5F7] hover:border-[#4A4A5A]"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                <span>Auswahl anpassen</span>
              </button>

              <button
                type="button"
                onClick={onComplete}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-[#9275E8] px-6 py-2.5 text-sm font-semibold text-[#101014] transition-colors hover:bg-[#B29AF5]"
              >
                <span>Empfehlungen generieren</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
