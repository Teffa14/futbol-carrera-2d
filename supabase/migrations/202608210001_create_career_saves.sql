create table if not exists public.career_saves (
  save_id uuid primary key,
  secret_hash bytea not null,
  career_version integer not null,
  save_data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.career_saves enable row level security;
revoke all on table public.career_saves from anon, authenticated;

create or replace function public.career_save_write(
  p_save_id uuid,
  p_secret text,
  p_career_version integer,
  p_save_data jsonb
) returns timestamptz
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_updated_at timestamptz;
  v_secret_hash bytea;
begin
  if p_save_id is null then raise exception 'invalid save id'; end if;
  if p_secret is null or length(p_secret) < 40 or length(p_secret) > 128 then raise exception 'invalid recovery key'; end if;
  if p_career_version < 1 or p_career_version > 1000 then raise exception 'invalid career version'; end if;
  if pg_column_size(p_save_data) > 5242880 then raise exception 'save too large'; end if;

  v_secret_hash := digest(convert_to(p_secret,'UTF8'),'sha256');

  insert into public.career_saves(save_id,secret_hash,career_version,save_data,created_at,updated_at)
  values(p_save_id,v_secret_hash,p_career_version,p_save_data,now(),now())
  on conflict (save_id) do update
    set career_version=excluded.career_version,
        save_data=excluded.save_data,
        updated_at=now()
    where public.career_saves.secret_hash=excluded.secret_hash
  returning updated_at into v_updated_at;

  if v_updated_at is null then raise exception 'invalid recovery key'; end if;
  return v_updated_at;
end;
$$;

create or replace function public.career_save_read(
  p_save_id uuid,
  p_secret text
) returns table(career_version integer, save_data jsonb, updated_at timestamptz)
language sql
security definer
stable
set search_path = public, extensions, pg_temp
as $$
  select s.career_version,s.save_data,s.updated_at
  from public.career_saves s
  where s.save_id=p_save_id
    and s.secret_hash=digest(convert_to(p_secret,'UTF8'),'sha256')
  limit 1;
$$;

create or replace function public.career_save_delete(
  p_save_id uuid,
  p_secret text
) returns boolean
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare v_count integer;
begin
  delete from public.career_saves s
  where s.save_id=p_save_id
    and s.secret_hash=digest(convert_to(p_secret,'UTF8'),'sha256');
  get diagnostics v_count = row_count;
  return v_count=1;
end;
$$;

revoke all on function public.career_save_write(uuid,text,integer,jsonb) from public;
revoke all on function public.career_save_read(uuid,text) from public;
revoke all on function public.career_save_delete(uuid,text) from public;
grant execute on function public.career_save_write(uuid,text,integer,jsonb) to anon, authenticated;
grant execute on function public.career_save_read(uuid,text) to anon, authenticated;
grant execute on function public.career_save_delete(uuid,text) to anon, authenticated;

create index if not exists career_saves_updated_at_idx
on public.career_saves(updated_at desc);
