-- Projekt 2027 — schemat synchronizacji w chmurze (D-078). Wklej w Supabase → SQL Editor → Run (raz, na nowym projekcie).
-- Brak sekretów: adres projektu i klucz „anon” użytkownik wpisuje w aplikacji (Etap 2), nie w repozytorium.
-- Serwer przechowuje wyłącznie zaszyfrowane zdarzenia: `sid` = HMAC identyfikatora zdarzenia, `blob` = AES-GCM.
-- Zasady: wiersze tylko dopisywane (brak UPDATE), każdy użytkownik widzi i zmienia wyłącznie własne wiersze (RLS),
-- rola `anon` (sam klucz publiczny, bez zalogowania) nie ma żadnego dostępu.

create table if not exists public.events (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  sid        text        not null check (char_length(sid) between 16 and 128),
  seq        bigint      generated always as identity,
  blob       text        not null check (char_length(blob) <= 2000000),
  created_at timestamptz not null default now(),
  primary key (user_id, sid)
);
create index if not exists events_user_seq on public.events (user_id, seq);

create table if not exists public.sync_keys (
  user_id    uuid        primary key default auth.uid() references auth.users (id) on delete cascade,
  salt       text        not null check (char_length(salt) between 16 and 64),
  iterations integer     not null check (iterations >= 310000),
  verifier   text        not null check (char_length(verifier) <= 1000),
  created_at timestamptz not null default now()
);

alter table public.events    enable row level security;
alter table public.sync_keys enable row level security;
alter table public.events    force row level security;
alter table public.sync_keys force row level security;

-- Uprawnienia: tylko zalogowany użytkownik; bez UPDATE (wiersze niezmienne)
revoke all on public.events    from anon, authenticated;
revoke all on public.sync_keys from anon, authenticated;
grant select, insert, delete on public.events    to authenticated;
grant select, insert, delete on public.sync_keys to authenticated;

drop policy if exists events_select on public.events;
drop policy if exists events_insert on public.events;
drop policy if exists events_delete on public.events;
create policy events_select on public.events for select to authenticated using (user_id = (select auth.uid()));
create policy events_insert on public.events for insert to authenticated with check (user_id = (select auth.uid()));
create policy events_delete on public.events for delete to authenticated using (user_id = (select auth.uid()));   -- „Usuń moje dane z chmury”

drop policy if exists keys_select on public.sync_keys;
drop policy if exists keys_insert on public.sync_keys;
drop policy if exists keys_delete on public.sync_keys;
create policy keys_select on public.sync_keys for select to authenticated using (user_id = (select auth.uid()));
create policy keys_insert on public.sync_keys for insert to authenticated with check (user_id = (select auth.uid()));
create policy keys_delete on public.sync_keys for delete to authenticated using (user_id = (select auth.uid()));
