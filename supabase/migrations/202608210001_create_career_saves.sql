create table if not exists public.career_saves (
  user_id uuid primary key references auth.users(id) on delete cascade,
  career_version integer not null,
  save_data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.career_saves enable row level security;

create policy "career_saves_select_own"
on public.career_saves
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "career_saves_insert_own"
on public.career_saves
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "career_saves_update_own"
on public.career_saves
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "career_saves_delete_own"
on public.career_saves
for delete
to authenticated
using ((select auth.uid()) = user_id);

create index if not exists career_saves_updated_at_idx
on public.career_saves(updated_at desc);
