-- CineMatch Phase 2 Migration: Social Matching (Friendships, Shared Watchlists, and Scoped RLS)
-- Safe to run once after 001_initial_schema.sql and 002_favorites_update_policy.sql.

-- 1. FRIENDSHIPS TABLE
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint friendships_no_self check (requester_id <> addressee_id),
  constraint friendships_pair_unique unique (requester_id, addressee_id)
);

create index if not exists idx_friendships_requester on public.friendships (requester_id, status);
create index if not exists idx_friendships_addressee on public.friendships (addressee_id, status);

drop trigger if exists trg_friendships_updated_at on public.friendships;
create trigger trg_friendships_updated_at
  before update on public.friendships
  for each row execute function public.set_updated_at();

-- 2. SHARED WATCHLIST ITEMS TABLE
create table if not exists public.shared_watchlist_items (
  id uuid primary key default gen_random_uuid(),
  friendship_id uuid not null references public.friendships (id) on delete cascade,
  added_by uuid not null references public.profiles (id) on delete cascade,
  tmdb_id integer not null,
  media_type text not null check (media_type in ('movie', 'tv')),
  title text not null,
  poster_path text,
  metadata jsonb not null default '{}'::jsonb,
  watched boolean not null default false,
  created_at timestamptz not null default now(),
  constraint shared_watchlist_friendship_tmdb_unique unique (friendship_id, tmdb_id, media_type)
);

create index if not exists idx_shared_watchlist_friendship on public.shared_watchlist_items (friendship_id, created_at desc);

-- 3. ENABLE ROW LEVEL SECURITY
alter table public.friendships enable row level security;
alter table public.shared_watchlist_items enable row level security;

-- Friendships RLS policies
drop policy if exists "Users can view own friendships" on public.friendships;
create policy "Users can view own friendships"
  on public.friendships for select
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

drop policy if exists "Users can send friend requests" on public.friendships;
create policy "Users can send friend requests"
  on public.friendships for insert
  with check (auth.uid() = requester_id and requester_id <> addressee_id);

drop policy if exists "Addressee can accept friend requests" on public.friendships;
create policy "Addressee can accept friend requests"
  on public.friendships for update
  using (auth.uid() = addressee_id)
  with check (auth.uid() = addressee_id);

drop policy if exists "Participants can remove friendships" on public.friendships;
create policy "Participants can remove friendships"
  on public.friendships for delete
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- Shared watchlist RLS policies (only accepted friends)
drop policy if exists "Accepted friends can view shared watchlist" on public.shared_watchlist_items;
create policy "Accepted friends can view shared watchlist"
  on public.shared_watchlist_items for select
  using (
    exists (
      select 1 from public.friendships f
      where f.id = friendship_id
        and f.status = 'accepted'
        and (f.requester_id = auth.uid() or f.addressee_id = auth.uid())
    )
  );

drop policy if exists "Accepted friends can add shared watchlist items" on public.shared_watchlist_items;
create policy "Accepted friends can add shared watchlist items"
  on public.shared_watchlist_items for insert
  with check (
    auth.uid() = added_by
    and exists (
      select 1 from public.friendships f
      where f.id = friendship_id
        and f.status = 'accepted'
        and (f.requester_id = auth.uid() or f.addressee_id = auth.uid())
    )
  );

drop policy if exists "Accepted friends can update shared watchlist items" on public.shared_watchlist_items;
create policy "Accepted friends can update shared watchlist items"
  on public.shared_watchlist_items for update
  using (
    exists (
      select 1 from public.friendships f
      where f.id = friendship_id
        and f.status = 'accepted'
        and (f.requester_id = auth.uid() or f.addressee_id = auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.friendships f
      where f.id = friendship_id
        and f.status = 'accepted'
        and (f.requester_id = auth.uid() or f.addressee_id = auth.uid())
    )
  );

drop policy if exists "Accepted friends can delete shared watchlist items" on public.shared_watchlist_items;
create policy "Accepted friends can delete shared watchlist items"
  on public.shared_watchlist_items for delete
  using (
    exists (
      select 1 from public.friendships f
      where f.id = friendship_id
        and f.status = 'accepted'
        and (f.requester_id = auth.uid() or f.addressee_id = auth.uid())
    )
  );

-- 4. SCOPED FRIEND ACCESS TO PROFILES, FAVORITES, AND RATINGS
-- Only users with a pending/accepted friendship can view minimal profile identity;
-- only accepted friends can read favorites and ratings for Duo-Match recommendations.
drop policy if exists "Connected users can view friend profiles" on public.profiles;
create policy "Connected users can view friend profiles"
  on public.profiles for select
  using (
    exists (
      select 1 from public.friendships f
      where (f.requester_id = auth.uid() and f.addressee_id = profiles.id)
         or (f.addressee_id = auth.uid() and f.requester_id = profiles.id)
    )
  );

drop policy if exists "Accepted friends can view friend favorites" on public.favorites;
create policy "Accepted friends can view friend favorites"
  on public.favorites for select
  using (
    exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and (
          (f.requester_id = auth.uid() and f.addressee_id = favorites.user_id)
          or (f.addressee_id = auth.uid() and f.requester_id = favorites.user_id)
        )
    )
  );

drop policy if exists "Accepted friends can view friend ratings" on public.ratings;
create policy "Accepted friends can view friend ratings"
  on public.ratings for select
  using (
    exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and (
          (f.requester_id = auth.uid() and f.addressee_id = ratings.user_id)
          or (f.addressee_id = auth.uid() and f.requester_id = ratings.user_id)
        )
    )
  );

-- 5. SECURE USERNAME LOOKUP + REQUEST RPC (prevents open profile directory scraping)
create or replace function public.send_friend_request_by_username(target_username text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
  cleaned_username text;
  target_id uuid;
  existing_id uuid;
  existing_status text;
  existing_requester uuid;
  new_id uuid;
begin
  if caller_id is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  cleaned_username := lower(regexp_replace(trim(coalesce(target_username, '')), '^@+', ''));
  if length(cleaned_username) < 2 then
    raise exception 'INVALID_USERNAME';
  end if;

  select id into target_id
  from public.profiles
  where lower(username) = cleaned_username
  limit 1;

  if target_id is null then
    raise exception 'USER_NOT_FOUND';
  end if;

  if target_id = caller_id then
    raise exception 'CANNOT_ADD_SELF';
  end if;

  select id, status, requester_id
  into existing_id, existing_status, existing_requester
  from public.friendships
  where (requester_id = caller_id and addressee_id = target_id)
     or (requester_id = target_id and addressee_id = caller_id)
  limit 1;

  if existing_id is not null then
    -- If the target user already sent an incoming request to caller, accept it automatically
    if existing_status = 'pending' and existing_requester = target_id then
      update public.friendships
      set status = 'accepted'
      where id = existing_id;
      return existing_id;
    end if;
    raise exception 'FRIENDSHIP_ALREADY_EXISTS';
  end if;

  insert into public.friendships (requester_id, addressee_id, status)
  values (caller_id, target_id, 'pending')
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.send_friend_request_by_username(text) from public;
grant execute on function public.send_friend_request_by_username(text) to authenticated;
