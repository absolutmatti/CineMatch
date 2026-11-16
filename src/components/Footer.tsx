export function Footer() {
  return (
    <footer className="mt-16 border-t border-[#30303A] bg-[#101014] pb-24 md:pb-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-xs text-[#A0A0AD] sm:px-6 lg:px-8 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <p className="font-display text-sm font-semibold text-[#F5F5F7]">CineMatch</p>
          <p>
            Dieses Produkt nutzt die TMDB-API, wird jedoch weder von TMDB unterstützt noch
            zertifiziert.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span>Entwicklungsstand: Frontend-Grundlage</span>
          <span aria-hidden="true">·</span>
          <span>TMDB &amp; Supabase Integration vorbereitet</span>
        </div>
      </div>
    </footer>
  );
}
