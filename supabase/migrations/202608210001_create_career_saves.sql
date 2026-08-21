create table if not exists public.career_saves (
  save_id uuid primary key,
  secret_hash bytea not null,
  career_version integer not null,
  save_data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.career_saves enable row level security;

grant select, insert, update, delete on table public.career_saves to anon;
revoke all on table public.career_saves from authenticated;

drop policy if exists career_saves_select_recovery_key on public.career_saves;
drop policy if exists career_saves_insert_recovery_key on public.career_saves;
drop policy if exists career_saves_update_recovery_key on public.career_saves;
drop policy if exists career_saves_delete_recovery_key on public.career_saves;

create policy career_saves_select_recovery_key
on public.career_saves for select to anon
using (
  current_setting('app.career_secret', true) is not null
  and secret_hash = digest(convert_to(current_setting('app.career_secret', true),'UTF8'),'sha256')
);

create policy career_saves_insert_recovery_key
on public.career_saves for insert to anon
with check (
  current_setting('app.career_secret', true) is not null
  and secret_hash = digest(convert_to(current_setting('app.career_secret', true),'UTF8'),'sha256')
);

create policy career_saves_update_recovery_key
on public.career_saves for update to anon
using (
  current_setting('app.career_secret', true) is not null
  and secret_hash = digest(convert_to(current_setting('app.career_secret', true),'UTF8'),'sha256')
)
with check (
  current_setting('app.career_secret', true) is not null
  and secret_hash = digest(convert_to(current_setting('app.career_secret', true),'UTF8'),'sha256')
);

create policy career_saves_delete_recovery_key
on public.career_saves for delete to anon
using (
  current_setting('app.career_secret', true) is not null
  and secret_hash = digest(convert_to(current_setting('app.career_secret', true),'UTF8'),'sha256')
);

create or replace function public.career_save_write(
  p_save_id uuid,
  p_secret text,
  p_career_version integer,
  p_save_data jsonb
) returns timestamptz
language plpgsql
security invoker
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

  perform set_config('app.career_secret',p_secret,true);
  v_secret_hash := digest(convert_to(p_secret,'UTF8'),'sha256');

  insert into public.career_saves(save_id,secret_hash,career_version,save_data,created_at,updated_at)
  values(p_save_id,v_secret_hash,p_career_version,p_save_data,now(),now())
  on conflict (save_id) do update
    set career_version=excluded.career_version,
        save_data=excluded.save_data,
        updated_at=now()
  returning updated_at into v_updated_at;

  if v_updated_at is null then raise exception 'invalid recovery key'; end if;
  return v_updated_at;
end;
$$;

create or replace function public.career_save_read(
  p_save_id uuid,
  p_secret text
) returns table(career_version integer, save_data jsonb, updated_at timestamptz)
language plpgsql
security invoker
stable
set search_path = public, extensions, pg_temp
as $$
begin
  if p_secret is null or length(p_secret) < 40 or length(p_secret) > 128 then return; end if;
  perform set_config('app.career_secret',p_secret,true);
  return query
    select s.career_version,s.save_data,s.updated_at
    from public.career_saves s
    where s.save_id=p_save_id
    limit 1;
end;
$$;

create or replace function public.career_save_delete(
  p_save_id uuid,
  p_secret text
) returns boolean
language plpgsql
security invoker
set search_path = public, extensions, pg_temp
as $$
declare v_count integer;
begin
  if p_secret is null or length(p_secret) < 40 or length(p_secret) > 128 then return false; end if;
  perform set_config('app.career_secret',p_secret,true);
  delete from public.career_saves where save_id=p_save_id;
  get diagnostics v_count = row_count;
  return v_count=1;
end;
$$;

revoke all on function public.career_save_write(uuid,text,integer,jsonb) from public;
revoke all on function public.career_save_read(uuid,text) from public;
revoke all on function public.career_save_delete(uuid,text) from public;
revoke all on function public.career_save_write(uuid,text,integer,jsonb) from authenticated;
revoke all on function public.career_save_read(uuid,text) from authenticated;
revoke all on function public.career_save_delete(uuid,text) from authenticated;
grant execute on function public.career_save_write(uuid,text,integer,jsonb) to anon;
grant execute on function public.career_save_read(uuid,text) to anon;
grant execute on function public.career_save_delete(uuid,text) to anon;

create index if not exists career_saves_updated_at_idx
on public.career_saves(updated_at desc);
