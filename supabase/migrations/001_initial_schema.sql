-- CineMatch Initial PostgreSQL / Supabase Migration
-- Includes profiles, favorites, ratings, recommendations, indexes, triggers, and strict Row Level Security (RLS).

create extension if not exists "pgcrypto";

-- 1. PROFILES TABLE
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique not null,
  display_name text not null,
  avatar_url text,
  preferred_media_type text not null default 'all' check (preferred_media_type in ('all', 'movie', 'tv')),
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profiles_username on public.profiles (username);

-- 2. FAVORITES TABLE
create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  tmdb_id integer not null,
  media_type text not null check (media_type in ('movie', 'tv')),
  title text not null,
  poster_path text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint favorites_user_tmdb_type_unique unique (user_id, tmdb_id, media_type)
);

create index if not exists idx_favorites_user_id on public.favorites (user_id);
create index if not exists idx_favorites_user_created_at on public.favorites (user_id, created_at desc);

-- 3. RATINGS / USER FEEDBACK TABLE
-- rating scale: -1 = Dislike, 0 = Already watched, 1 = Like
create table if not exists public.ratings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  tmdb_id integer not null,
  media_type text not null check (media_type in ('movie', 'tv')),
  rating smallint not null check (rating in (-1, 0, 1)),
  feedback text not null check (feedback in ('like', 'dislike', 'watched')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ratings_user_tmdb_type_unique unique (user_id, tmdb_id, media_type)
);

create index if not exists idx_ratings_user_id on public.ratings (user_id);
create index if not exists idx_ratings_feedback on public.ratings (user_id, feedback);

-- 4. RECOMMENDATIONS TABLE
create table if not exists public.recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  tmdb_id integer not null,
  media_type text not null check (media_type in ('movie', 'tv')),
  recommendation_score numeric(5, 2) not null check (recommendation_score >= 0 and recommendation_score <= 100),
  reason text not null,
  shown_count integer not null default 1,
  last_shown_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint recommendations_user_tmdb_type_unique unique (user_id, tmdb_id, media_type)
);

create index if not exists idx_recommendations_user_score on public.recommendations (user_id, recommendation_score desc);

-- 5. UPDATED_AT TRIGGER HELPER
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_ratings_updated_at on public.ratings;
create trigger trg_ratings_updated_at
  before update on public.ratings
  for each row execute function public.set_updated_at();

-- 6. AUTO-CREATE PROFILE ON AUTH SIGNUP
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_name text;
  generated_username text;
begin
  base_name := coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1), 'Cinephile');
  generated_username := lower(regexp_replace(base_name, '[^a-zA-Z0-9]+', '.', 'g')) || '.' || substr(new.id::text, 1, 6);

  insert into public.profiles (id, username, display_name, onboarding_completed)
  values (new.id, generated_username, base_name, false)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 7. ROW LEVEL SECURITY (RLS)
alter table public.profiles enable row level security;
alter table public.favorites enable row level security;
alter table public.ratings enable row level security;
alter table public.recommendations enable row level security;

-- Profiles policies
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Users can delete own profile"
  on public.profiles for delete
  using (auth.uid() = id);

-- Favorites policies
create policy "Users can view own favorites"
  on public.favorites for select
  using (auth.uid() = user_id);

create policy "Users can insert own favorites"
  on public.favorites for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own favorites"
  on public.favorites for delete
  using (auth.uid() = user_id);

-- Ratings policies
create policy "Users can view own ratings"
  on public.ratings for select
  using (auth.uid() = user_id);

create policy "Users can insert own ratings"
  on public.ratings for insert
  with check (auth.uid() = user_id);

create policy "Users can update own ratings"
  on public.ratings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own ratings"
  on public.ratings for delete
  using (auth.uid() = user_id);

-- Recommendations policies
create policy "Users can view own recommendations"
  on public.recommendations for select
  using (auth.uid() = user_id);

create policy "Users can insert own recommendations"
  on public.recommendations for insert
  with check (auth.uid() = user_id);

create policy "Users can update own recommendations"
  on public.recommendations for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own recommendations"
  on public.recommendations for delete
  using (auth.uid() = user_id);
