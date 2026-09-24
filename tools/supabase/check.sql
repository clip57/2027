-- Projekt 2027 — KONTROLA zabezpieczeń synchronizacji (tylko odczyt, niczego nie zmienia). Wklej w Supabase → SQL Editor → Run.
-- Oczekiwany wynik: każdy wiersz ma w kolumnie `ok` wartość true. Jeśli któryś ma false — uruchom ponownie schema.sql.
-- Tło: Publishable Key jest publiczny z założenia; dostęp do danych ograniczają wyłącznie RLS i uprawnienia poniżej.

with t as (select unnest(array['events', 'sync_keys']) as tbl)
select 'RLS włączone i wymuszone: ' || c.relname as kontrola, (c.relrowsecurity and c.relforcerowsecurity) as ok
  from pg_class c join pg_namespace n on n.oid = c.relnamespace join t on t.tbl = c.relname
 where n.nspname = 'public'
union all
-- rola anon (sam klucz publiczny, bez logowania) nie ma ŻADNYCH uprawnień do tabel synchronizacji
select 'anon bez uprawnień: ' || t.tbl, not exists (
  select 1 from information_schema.role_table_grants g where g.table_schema = 'public' and g.table_name = t.tbl and g.grantee = 'anon')
  from t
union all
-- zalogowany użytkownik: wyłącznie SELECT / INSERT / DELETE (brak UPDATE — wiersze niezmienne)
select 'authenticated bez UPDATE/TRUNCATE: ' || t.tbl, not exists (
  select 1 from information_schema.role_table_grants g where g.table_schema = 'public' and g.table_name = t.tbl
     and g.grantee = 'authenticated' and g.privilege_type not in ('SELECT', 'INSERT', 'DELETE'))
  from t
union all
-- każda zasada ogranicza dostęp do własnych wierszy (auth.uid())
select 'zasady tylko dla własnych wierszy: ' || t.tbl, (
  select count(*) = 3 and bool_and(coalesce(p.qual, p.with_check) like '%auth.uid()%' and p.roles = '{authenticated}')
    from pg_policies p where p.schemaname = 'public' and p.tablename = t.tbl)
  from t;

-- Rejestracja nowych kont z aplikacji powinna być wyłączona: Authentication → Sign In / Providers →
-- „Allow new users to sign up” = wyłączone (tego ustawienia nie da się sprawdzić zapytaniem SQL).
