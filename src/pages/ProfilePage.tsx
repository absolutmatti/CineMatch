import { useState, type FormEvent } from 'react';
import { Check, Film, LogOut, Sliders, Trash2, Tv, User } from 'lucide-react';
import type { FavoriteItem, GenreStat, MediaType, UserProfile, UserRating } from '../types/media';

interface ProfilePageProps {
  profile: UserProfile;
  favorites: FavoriteItem[];
  ratings: UserRating[];
  favoriteGenres: GenreStat[];
  onUpdateProfile: (updates: {
    displayName: string;
    username: string;
    preferredMediaType: 'all' | MediaType;
  }) => void;
  onRestartOnboarding: () => void;
  onSignOut: () => void;
  onDeleteAccount: () => void;
}

export function ProfilePage({
  profile,
  favorites,
  ratings,
  favoriteGenres,
  onUpdateProfile,
  onRestartOnboarding,
  onSignOut,
  onDeleteAccount,
}: ProfilePageProps) {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [username, setUsername] = useState(profile.username);
  const [preferredMediaType, setPreferredMediaType] = useState<'all' | MediaType>(
    profile.preferredMediaType
  );
  const [savedNotice, setSavedNotice] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const movieCount = favorites.filter((f) => f.mediaType === 'movie').length;
  const tvCount = favorites.filter((f) => f.mediaType === 'tv').length;
  const topGenre = favoriteGenres[0]?.genre ?? 'Noch offen';

  const handleSave = (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    setSavedNotice(false);

    if (displayName.trim().length < 2) {
      setFormError('Der Anzeigename muss mindestens 2 Zeichen enthalten.');
      return;
    }
    if (username.trim().length < 2) {
      setFormError('Der Benutzername muss mindestens 2 Zeichen enthalten.');
      return;
    }

    onUpdateProfile({
      displayName: displayName.trim(),
      username: username.trim().toLowerCase().replace(/\s+/g, '.'),
      preferredMediaType,
    });
    setSavedNotice(true);
    window.setTimeout(() => setSavedNotice(false), 3000);
  };

  const initials = profile.displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <div className="space-y-10">
      {/* Header Summary */}
      <section className="flex flex-col gap-5 border-b border-[#30303A] pb-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-[#30303A] bg-[#1E1E27] font-display text-xl font-bold text-[#B29AF5]">
            {initials || <User className="h-7 w-7" aria-hidden="true" />}
          </div>
          <div className="space-y-0.5">
            <h1 className="font-display text-2xl font-bold tracking-tight text-[#F5F5F7] sm:text-3xl">
              {profile.displayName}
            </h1>
            <p className="text-sm text-[#A0A0AD]">
              @{profile.username} · {profile.email}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onSignOut}
          className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg border border-[#30303A] bg-[#17171D] px-4 py-2 text-sm font-medium text-[#F5F5F7] transition-colors hover:border-[#9275E8] whitespace-nowrap shrink-0"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          <span>Abmelden</span>
        </button>
      </section>

      {/* Metrics Strip */}
      <section aria-label="Profilstatistiken" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-[#30303A] bg-[#1E1E27] p-4">
          <div className="flex items-center justify-between text-xs text-[#A0A0AD]">
            <span>Lieblingsfilme</span>
            <Film className="h-4 w-4 text-[#B29AF5]" aria-hidden="true" />
          </div>
          <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-[#F5F5F7]">
            {movieCount}
          </p>
        </div>

        <div className="rounded-xl border border-[#30303A] bg-[#1E1E27] p-4">
          <div className="flex items-center justify-between text-xs text-[#A0A0AD]">
            <span>Lieblingsserien</span>
            <Tv className="h-4 w-4 text-[#B29AF5]" aria-hidden="true" />
          </div>
          <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-[#F5F5F7]">
            {tvCount}
          </p>
        </div>

        <div className="rounded-xl border border-[#30303A] bg-[#1E1E27] p-4">
          <p className="text-xs text-[#A0A0AD]">Abgegebene Bewertungen</p>
          <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-[#F5F5F7]">
            {ratings.length}
          </p>
        </div>

        <div className="rounded-xl border border-[#30303A] bg-[#1E1E27] p-4">
          <p className="text-xs text-[#A0A0AD]">Dominantes Genre</p>
          <p className="mt-2 font-display text-xl font-semibold text-[#F5F5F7] truncate">
            {topGenre}
          </p>
        </div>
      </section>

      {/* Two-Column Settings & Taste Profile */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left: Edit Profile & Preferences */}
        <section className="space-y-6 rounded-2xl border border-[#30303A] bg-[#17171D] p-6 lg:col-span-7">
          <div className="space-y-1">
            <h2 className="font-display text-lg font-semibold text-[#F5F5F7]">
              Profil &amp; Kontoeinstellungen
            </h2>
            <p className="text-xs text-[#A0A0AD]">
              Passe deinen Anzeigenamen, Benutzernamen und deine Standardpräferenz an.
            </p>
          </div>

          {formError && (
            <div
              role="alert"
              className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-200"
            >
              {formError}
            </div>
          )}

          {savedNotice && (
            <div
              role="status"
              className="flex items-center gap-2 rounded-lg border border-[#9275E8]/50 bg-[#9275E8]/15 px-4 py-2.5 text-sm text-[#F5F5F7]"
            >
              <Check className="h-4 w-4 text-[#B29AF5]" aria-hidden="true" />
              <span>Änderungen wurden gespeichert.</span>
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label
                  htmlFor="profile-display-name"
                  className="block text-xs font-medium text-[#A0A0AD]"
                >
                  Anzeigename
                </label>
                <input
                  id="profile-display-name"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="h-11 w-full rounded-lg border border-[#30303A] bg-[#1E1E27] px-3.5 text-sm text-[#F5F5F7] focus:border-[#9275E8] focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="profile-username"
                  className="block text-xs font-medium text-[#A0A0AD]"
                >
                  Benutzername
                </label>
                <input
                  id="profile-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="h-11 w-full rounded-lg border border-[#30303A] bg-[#1E1E27] px-3.5 text-sm text-[#F5F5F7] focus:border-[#9275E8] focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="profile-preferred-type"
                className="block text-xs font-medium text-[#A0A0AD]"
              >
                Bevorzugter Fokus für Empfehlungen
              </label>
              <select
                id="profile-preferred-type"
                value={preferredMediaType}
                onChange={(e) =>
                  setPreferredMediaType(e.target.value as 'all' | MediaType)
                }
                className="h-11 w-full rounded-lg border border-[#30303A] bg-[#1E1E27] px-3.5 text-sm text-[#F5F5F7] focus:border-[#9275E8] focus:outline-none"
              >
                <option value="all">Filme &amp; Serien ausgewogen</option>
                <option value="movie">Schwerpunkt Filme</option>
                <option value="tv">Schwerpunkt Serien</option>
              </select>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={onRestartOnboarding}
                className="inline-flex min-h-[42px] items-center gap-2 rounded-lg border border-[#30303A] bg-[#1E1E27] px-4 py-2 text-xs font-medium text-[#F5F5F7] transition-colors hover:border-[#9275E8]"
              >
                <Sliders className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Lieblingstitel neu auswählen</span>
              </button>

              <button
                type="submit"
                className="inline-flex min-h-[42px] items-center justify-center rounded-lg bg-[#9275E8] px-5 py-2 text-sm font-semibold text-[#101014] transition-colors hover:bg-[#B29AF5]"
              >
                Profil speichern
              </button>
            </div>
          </form>
        </section>

        {/* Right: Computed Favorite Genres & Danger Zone */}
        <div className="space-y-6 lg:col-span-5">
          <section className="space-y-4 rounded-2xl border border-[#30303A] bg-[#17171D] p-6">
            <div className="space-y-1">
              <h2 className="font-display text-lg font-semibold text-[#F5F5F7]">
                Deine Lieblingsgenres
              </h2>
              <p className="text-xs text-[#A0A0AD]">
                Automatisch berechnet aus deinen gespeicherten Favoriten
              </p>
            </div>

            {favoriteGenres.length > 0 ? (
              <ul className="space-y-3">
                {favoriteGenres.slice(0, 5).map((stat) => (
                  <li key={stat.genre} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-[#F5F5F7]">{stat.genre}</span>
                      <span className="font-mono tabular-nums text-[#A0A0AD]">
                        {stat.count} {stat.count === 1 ? 'Titel' : 'Titel'} ({stat.percentage}%)
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#101014]">
                      <div
                        className="h-full rounded-full bg-[#9275E8]"
                        style={{ width: `${stat.percentage}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[#A0A0AD]">
                Noch nicht genügend Daten vorhanden. Füge mindestens einen Favoriten hinzu, um dein
                Genre-Profil zu sehen.
              </p>
            )}
          </section>

          {/* Account Deletion Request */}
          <section className="space-y-3 rounded-2xl border border-[#30303A] bg-[#17171D] p-6">
            <h2 className="font-display text-base font-semibold text-[#F5F5F7]">
              Kontoverwaltung
            </h2>
            <p className="text-xs leading-relaxed text-[#A0A0AD]">
              Du kannst dein Konto und alle lokal gespeicherten Favoriten sowie Bewertungen
              vollständig zurücksetzen oder zur Löschung vormerken.
            </p>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-xs font-medium text-rose-200 transition-colors hover:bg-rose-500/20"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Kontolöschung anfordern</span>
            </button>
          </section>
        </div>
      </div>

      {/* Accessible Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-account-title"
        >
          <div className="w-full max-w-md space-y-4 rounded-2xl border border-[#30303A] bg-[#17171D] p-6">
            <h3
              id="delete-account-title"
              className="font-display text-lg font-bold text-[#F5F5F7]"
            >
              Konto wirklich löschen?
            </h3>
            <p className="text-sm leading-relaxed text-[#A0A0AD]">
              Alle deine gespeicherten Favoriten, Bewertungen und Profildaten in dieser Sitzung
              werden unwiderruflich entfernt.
            </p>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="min-h-[40px] rounded-lg border border-[#30303A] bg-[#1E1E27] px-4 py-2 text-sm font-medium text-[#F5F5F7]"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  onDeleteAccount();
                }}
                className="min-h-[40px] rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500"
              >
                Endgültig löschen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
