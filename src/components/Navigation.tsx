import { Compass, Heart, LayoutDashboard, Search, User } from 'lucide-react';
import type { AppRoute } from '../types/media';

interface NavigationProps {
  activeRoute: AppRoute;
  favoritesCount: number;
  onNavigate: (route: AppRoute, options?: { focusSearch?: boolean }) => void;
}

const NAV_ITEMS: { id: AppRoute; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'discover', label: 'Entdecken', icon: Compass },
  { id: 'favorites', label: 'Favoriten', icon: Heart },
  { id: 'profile', label: 'Profil', icon: User },
];

/**
 * Responsive navigation adhering to the 3-zone Desktop Top Bar Contract
 * and <=15% Mobile Sticky Cap (52px top bar + 64px bottom tab bar = 116px on 844px viewport).
 */
export function Navigation({ activeRoute, favoritesCount, onNavigate }: NavigationProps) {
  const currentLabel = NAV_ITEMS.find((item) => item.id === activeRoute)?.label ?? 'CineMatch';

  return (
    <>
      {/* Desktop Top Navigation (3-zone contract separated by gap-8) */}
      <header className="sticky top-0 z-40 hidden border-b border-[#30303A] bg-[#101014]/90 backdrop-blur-md md:block">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-8 px-6 lg:px-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <button
            type="button"
            onClick={() => onNavigate('dashboard')}
            className="font-display text-xl font-bold tracking-tight text-[#F5F5F7] transition-colors hover:text-[#B29AF5] whitespace-nowrap shrink-0"
          >
            CineMatch
          </button>

          {/* Zone 2: 4 single-line navigation links */}
          <nav aria-label="Hauptnavigation" className="flex items-center gap-7">
            {NAV_ITEMS.map((item) => {
              const isActive = activeRoute === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`relative py-1.5 text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'text-[#F5F5F7]'
                      : 'text-[#A0A0AD] hover:text-[#F5F5F7]'
                  }`}
                >
                  <span>
                    {item.label}
                    {item.id === 'favorites' && favoritesCount > 0 && (
                      <span className="ml-1.5 font-mono text-xs tabular-nums text-[#B29AF5]">
                        ({favoritesCount})
                      </span>
                    )}
                  </span>
                  {isActive && (
                    <span
                      className="absolute right-0 bottom-0 left-0 h-0.5 rounded-full bg-[#9275E8]"
                      aria-hidden="true"
                    />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Single primary action button */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('discover', { focusSearch: true })}
              className="inline-flex min-h-[38px] items-center gap-2 rounded-lg bg-[#9275E8] px-4 py-2 text-xs font-semibold text-[#101014] transition-colors hover:bg-[#B29AF5] whitespace-nowrap shrink-0"
            >
              <Search className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Titel suchen</span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Compact Sticky Top Bar (52px height) */}
      <header className="sticky top-0 z-40 flex h-[52px] items-center justify-between border-b border-[#30303A] bg-[#101014]/92 px-4 backdrop-blur-md md:hidden">
        <button
          type="button"
          onClick={() => onNavigate('dashboard')}
          className="font-display text-lg font-bold tracking-tight text-[#F5F5F7] whitespace-nowrap shrink-0"
        >
          CineMatch
        </button>
        <span className="text-sm font-medium text-[#A0A0AD] truncate">{currentLabel}</span>
        <button
          type="button"
          onClick={() => onNavigate('discover', { focusSearch: true })}
          aria-label="Suche öffnen"
          className="flex h-11 w-11 items-center justify-center rounded-lg text-[#F5F5F7] hover:bg-[#1E1E27]"
        >
          <Search className="h-5 w-5" aria-hidden="true" />
        </button>
      </header>

      {/* Mobile Fixed Bottom Navigation Bar (64px height) */}
      <nav
        aria-label="Mobile Navigation"
        className="fixed right-0 bottom-0 left-0 z-40 grid h-16 grid-cols-4 items-center border-t border-[#30303A] bg-[#17171D]/95 backdrop-blur-md md:hidden"
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeRoute === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex min-h-[48px] flex-col items-center justify-center gap-1 transition-colors ${
                isActive ? 'text-[#B29AF5]' : 'text-[#A0A0AD] hover:text-[#F5F5F7]'
              }`}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span className="text-[11px] font-medium tracking-tight whitespace-nowrap">
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
