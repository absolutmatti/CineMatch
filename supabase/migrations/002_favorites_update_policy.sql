-- Incremental migration for existing Supabase instances:
-- Allows authenticated users to update metadata snapshots on their own favorites.

drop policy if exists "Users can update own favorites" on public.favorites;
create policy "Users can update own favorites"
  on public.favorites for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
