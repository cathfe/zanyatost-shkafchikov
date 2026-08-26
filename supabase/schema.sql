-- ============================================================================
-- Занятость шкафчиков — схема БД
--
-- Полностью изолирована от таблиц дашборда кампаний: ни одна существующая
-- таблица не изменяется. Свой справочник клубов (lockers_clubs) с опциональной
-- ссылкой на public.clubs дашборда.
--
-- Применяется целиком на чистом проекте Supabase либо поверх существующего.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Каталог клубов из адресной программы
-- ---------------------------------------------------------------------------
create table if not exists lockers_clubs (
  id                uuid primary key default gen_random_uuid(),
  name              text not null unique,
  network           text,
  city              text,
  address           text,
  is_active         boolean not null default true,
  dashboard_club_id uuid references public.clubs(id) on delete set null,
  source            text not null default 'import' check (source in ('import','manual')),
  note              text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists lockers_clubs_network_idx on lockers_clubs (network);
create index if not exists lockers_clubs_city_idx    on lockers_clubs (city);
create index if not exists lockers_clubs_active_idx  on lockers_clubs (is_active);

-- ---------------------------------------------------------------------------
-- 2. Вместимость раздевалок (всего шкафчиков)
--    В АП это колонка «Количество».
-- ---------------------------------------------------------------------------
create table if not exists lockers_capacity (
  id            uuid primary key default gen_random_uuid(),
  club_id       uuid not null references lockers_clubs(id) on delete cascade,
  gender        text not null check (gender in ('male','female')),
  surface_type  text not null default 'lockers' check (surface_type in ('lockers','mirrors')),
  total_lockers integer not null default 0 check (total_lockers >= 0),
  updated_at    timestamptz not null default now()
);
create unique index if not exists lockers_capacity_uniq
  on lockers_capacity (club_id, gender, surface_type);

-- ---------------------------------------------------------------------------
-- 3. Импорты адресных программ
-- ---------------------------------------------------------------------------
create table if not exists lockers_imports (
  id             uuid primary key default gen_random_uuid(),
  file_name      text not null,
  campaign_label text,
  period_month   date,
  slot           smallint check (slot in (1,2)),
  status         text not null default 'draft' check (status in ('draft','applied','rolled_back')),
  column_map     jsonb not null default '{}'::jsonb,
  stats          jsonb not null default '{}'::jsonb,
  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  applied_at     timestamptz
);
create index if not exists lockers_imports_created_idx on lockers_imports (created_at desc);

-- Сырые строки импорта: дифф-предпросмотр и разбор проблем
create table if not exists lockers_import_rows (
  id              uuid primary key default gen_random_uuid(),
  import_id       uuid not null references lockers_imports(id) on delete cascade,
  row_number      integer,
  club_name       text,
  matched_club_id uuid references lockers_clubs(id) on delete set null,
  city            text,
  address         text,
  surface_type    text,
  slot            smallint,
  gender          text,
  total           integer,
  status_raw      text,
  periods         jsonb not null default '[]'::jsonb,
  issues          jsonb not null default '[]'::jsonb,
  raw             jsonb not null default '{}'::jsonb
);
create index if not exists lockers_import_rows_import_idx on lockers_import_rows (import_id);

-- ---------------------------------------------------------------------------
-- 4. Занятость из АП (машинный слой — перезаписывается импортом)
-- ---------------------------------------------------------------------------
create table if not exists lockers_occupancy (
  id             uuid primary key default gen_random_uuid(),
  club_id        uuid not null references lockers_clubs(id) on delete cascade,
  month          date not null,
  slot           smallint not null check (slot in (1,2)),
  gender         text not null check (gender in ('male','female')),
  surface_type   text not null default 'lockers' check (surface_type in ('lockers','mirrors')),
  occupied       integer not null default 0 check (occupied >= 0),
  campaign_label text,
  import_id      uuid references lockers_imports(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create unique index if not exists lockers_occupancy_uniq
  on lockers_occupancy (club_id, month, slot, gender, surface_type);
create index if not exists lockers_occupancy_month_idx      on lockers_occupancy (month);
create index if not exists lockers_occupancy_club_month_idx on lockers_occupancy (club_id, month);

-- ---------------------------------------------------------------------------
-- 5. Ручные правки администратора — ПРИОРИТЕТ над импортом
--    Импорт эти строки не трогает никогда.
-- ---------------------------------------------------------------------------
create table if not exists lockers_overrides (
  id                uuid primary key default gen_random_uuid(),
  club_id           uuid not null references lockers_clubs(id) on delete cascade,
  month             date not null,
  slot              smallint not null check (slot in (1,2)),
  gender            text not null check (gender in ('male','female')),
  surface_type      text not null default 'lockers' check (surface_type in ('lockers','mirrors')),
  status            text check (status in ('available','closed','reserved')),
  total_override    integer check (total_override >= 0),
  occupied_override integer check (occupied_override >= 0),
  reserved          integer not null default 0 check (reserved >= 0),
  note              text,
  updated_by        uuid references auth.users(id) on delete set null,
  updated_at        timestamptz not null default now()
);
create unique index if not exists lockers_overrides_uniq
  on lockers_overrides (club_id, month, slot, gender, surface_type);
create index if not exists lockers_overrides_month_idx on lockers_overrides (month);

-- ---------------------------------------------------------------------------
-- 6. Журнал действий администратора
-- ---------------------------------------------------------------------------
create table if not exists lockers_admin_log (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid references lockers_clubs(id) on delete set null,
  club_name   text,
  month       date,
  slot        smallint,
  gender      text,
  action      text not null,
  details     jsonb not null default '{}'::jsonb,
  actor_id    uuid references auth.users(id) on delete set null,
  actor_email text,
  created_at  timestamptz not null default now()
);
create index if not exists lockers_admin_log_created_idx on lockers_admin_log (created_at desc);

-- ---------------------------------------------------------------------------
-- 7. Администраторы панели
-- ---------------------------------------------------------------------------
create table if not exists lockers_admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text,
  role       text not null default 'admin' check (role in ('admin','editor','viewer')),
  created_at timestamptz not null default now()
);

-- ============================================================================
-- RLS: публичное чтение занятости, запись только администраторам
-- ============================================================================
alter table lockers_clubs       enable row level security;
alter table lockers_capacity    enable row level security;
alter table lockers_occupancy   enable row level security;
alter table lockers_overrides   enable row level security;
alter table lockers_admin_log   enable row level security;
alter table lockers_imports     enable row level security;
alter table lockers_import_rows enable row level security;
alter table lockers_admins      enable row level security;

create or replace function lockers_is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from lockers_admins a where a.user_id = auth.uid());
$$;

do $$
declare t text;
begin
  foreach t in array array['lockers_clubs','lockers_capacity','lockers_occupancy','lockers_overrides'] loop
    execute format('drop policy if exists %I on %I', t||'_public_read', t);
    execute format('create policy %I on %I for select using (true)', t||'_public_read', t);
    execute format('drop policy if exists %I on %I', t||'_admin_write', t);
    execute format(
      'create policy %I on %I for all to authenticated using (lockers_is_admin()) with check (lockers_is_admin())',
      t||'_admin_write', t);
  end loop;

  foreach t in array array['lockers_admin_log','lockers_imports','lockers_import_rows','lockers_admins'] loop
    execute format('drop policy if exists %I on %I', t||'_admin_all', t);
    execute format(
      'create policy %I on %I for all to authenticated using (lockers_is_admin()) with check (lockers_is_admin())',
      t||'_admin_all', t);
  end loop;
end $$;

-- ============================================================================
-- Функции для интерфейса
-- ============================================================================

-- Сетка занятости на месяц: вместимость + импорт + ручные правки (приоритет)
create or replace function lockers_availability(p_month date, p_surface text default 'lockers')
returns table (
  club_id uuid, club_name text, network text, city text, address text,
  slot smallint, gender text,
  total integer, occupied integer, reserved integer, free integer,
  status text, campaign_label text, note text, manual boolean
)
language sql stable set search_path = public as $$
  with m as (select date_trunc('month', p_month)::date as month)
  select
    c.id, c.name, c.network, c.city, c.address,
    s.slot, g.gender,
    coalesce(o.total_override, cap.total_lockers, 0)::int,
    least(coalesce(o.occupied_override, occ.occupied, 0),
          coalesce(o.total_override, cap.total_lockers, 0))::int,
    coalesce(o.reserved, 0)::int,
    greatest(
      coalesce(o.total_override, cap.total_lockers, 0)
      - least(coalesce(o.occupied_override, occ.occupied, 0),
              coalesce(o.total_override, cap.total_lockers, 0))
      - coalesce(o.reserved, 0), 0)::int,
    coalesce(o.status,
      case
        when coalesce(o.total_override, cap.total_lockers, 0) = 0 then 'closed'
        when coalesce(o.reserved, 0) > 0 then 'reserved'
        else 'available'
      end),
    occ.campaign_label,
    o.note,
    (o.id is not null)
  from lockers_clubs c
  cross join m
  cross join (values (1::smallint), (2::smallint)) as s(slot)
  cross join (values ('male'), ('female')) as g(gender)
  left join lockers_capacity cap
    on cap.club_id = c.id and cap.gender = g.gender and cap.surface_type = p_surface
  left join lockers_occupancy occ
    on occ.club_id = c.id and occ.month = m.month and occ.slot = s.slot
   and occ.gender = g.gender and occ.surface_type = p_surface
  left join lockers_overrides o
    on o.club_id = c.id and o.month = m.month and o.slot = s.slot
   and o.gender = g.gender and o.surface_type = p_surface
  where c.is_active
$$;

-- Сводка по месяцу для дашборда
create or replace function lockers_month_summary(p_month date, p_surface text default 'lockers')
returns table (
  clubs_total bigint, lockers_total bigint, lockers_occupied bigint,
  lockers_reserved bigint, lockers_free bigint, slots_closed bigint, load_percent numeric
)
language sql stable set search_path = public as $$
  with a as (select * from lockers_availability(p_month, p_surface))
  select
    count(distinct club_id), sum(total)::bigint, sum(occupied)::bigint,
    sum(reserved)::bigint, sum(free)::bigint,
    count(*) filter (where status = 'closed'),
    case when sum(total) > 0
      then round(100.0 * (sum(occupied) + sum(reserved)) / sum(total), 1) else 0 end
  from a
$$;

-- Месяцы, по которым есть данные
create or replace function lockers_months()
returns table (month date, has_data boolean)
language sql stable set search_path = public as $$
  select month, true from (
    select month from lockers_occupancy
    union
    select month from lockers_overrides
  ) t
  group by month
  order by month
$$;

grant execute on function lockers_availability(date, text)  to anon, authenticated;
grant execute on function lockers_month_summary(date, text) to anon, authenticated;
grant execute on function lockers_months()                  to anon, authenticated;

-- ============================================================================
-- ЧАСТЬ 2. Менеджеры, роли пользователей, пересечения РК
-- (выполняется после части 1 и заменяет функции с изменившейся сигнатурой)
-- ============================================================================

-- Менеджеры: к ним привязаны клубы, у каждого свой дашборд
create table if not exists lockers_managers (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  slug       text not null unique,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

alter table lockers_clubs add column if not exists manager_id uuid references lockers_managers(id) on delete set null;
create index if not exists lockers_clubs_manager_idx on lockers_clubs (manager_id);

-- Пользователи и роли. Количество пользователей не ограничено.
alter table lockers_admins add column if not exists manager_id uuid references lockers_managers(id) on delete set null;
alter table lockers_admins add column if not exists full_name text;
alter table lockers_admins add column if not exists is_active boolean not null default true;
alter table lockers_admins drop constraint if exists lockers_admins_role_check;
alter table lockers_admins add constraint lockers_admins_role_check check (role in ('admin','editor','viewer'));

create or replace function lockers_role()
returns text language sql stable security definer set search_path = public as $$
  select role from lockers_admins where user_id = auth.uid() and is_active
$$;

create or replace function lockers_is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(lockers_role() = 'admin', false)
$$;

create or replace function lockers_can_edit()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(lockers_role() in ('admin','editor'), false)
$$;

create or replace function lockers_can_view()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(lockers_role() in ('admin','editor','viewer'), false)
$$;

grant execute on function lockers_role(), lockers_is_admin(), lockers_can_edit(), lockers_can_view() to authenticated;

alter table lockers_managers enable row level security;
drop policy if exists lockers_managers_public_read on lockers_managers;
create policy lockers_managers_public_read on lockers_managers for select using (true);

do $$
declare t text;
begin
  foreach t in array array['lockers_clubs','lockers_capacity','lockers_occupancy','lockers_overrides','lockers_managers'] loop
    execute format('drop policy if exists %I on %I', t||'_admin_write', t);
    execute format('drop policy if exists %I on %I', t||'_edit_write', t);
    execute format(
      'create policy %I on %I for all to authenticated using (lockers_can_edit()) with check (lockers_can_edit())',
      t||'_edit_write', t);
  end loop;

  foreach t in array array['lockers_admin_log','lockers_imports','lockers_import_rows'] loop
    execute format('drop policy if exists %I on %I', t||'_admin_all', t);
    execute format('drop policy if exists %I on %I', t||'_staff_read', t);
    execute format('create policy %I on %I for select to authenticated using (lockers_can_view())', t||'_staff_read', t);
    execute format('drop policy if exists %I on %I', t||'_edit_write', t);
    execute format(
      'create policy %I on %I for all to authenticated using (lockers_can_edit()) with check (lockers_can_edit())',
      t||'_edit_write', t);
  end loop;
end $$;

drop policy if exists lockers_admins_admin_all on lockers_admins;
drop policy if exists lockers_admins_self_read on lockers_admins;
create policy lockers_admins_self_read on lockers_admins
  for select to authenticated using (user_id = auth.uid() or lockers_is_admin());
drop policy if exists lockers_admins_admin_write on lockers_admins;
create policy lockers_admins_admin_write on lockers_admins
  for all to authenticated using (lockers_is_admin()) with check (lockers_is_admin());

-- Поиск пользователя Auth по почте — чтобы выдавать доступ из интерфейса
create or replace function lockers_find_user_by_email(p_email text)
returns uuid language plpgsql stable security definer set search_path = public, auth as $$
declare uid uuid;
begin
  if not lockers_is_admin() then raise exception 'Нужны права администратора'; end if;
  select id into uid from auth.users where lower(email) = lower(trim(p_email)) limit 1;
  return uid;
end $$;
revoke all on function lockers_find_user_by_email(text) from public, anon;
grant execute on function lockers_find_user_by_email(text) to authenticated;

-- Функции интерфейса: добавлен менеджер, адрес наружу не отдаётся
drop function if exists lockers_overlaps(date, text);
drop function if exists lockers_month_summary(date, text);
drop function if exists lockers_availability(date, text);

create or replace function lockers_availability(p_month date, p_surface text default 'lockers')
returns table (
  club_id uuid, club_name text, network text,
  manager_id uuid, manager_name text,
  slot smallint, gender text,
  total integer, occupied integer, reserved integer, free integer,
  status text, campaign_label text, note text, manual boolean
)
language sql stable set search_path = public as $$
  with m as (select date_trunc('month', p_month)::date as month)
  select
    c.id, c.name, c.network, c.manager_id, mg.name, s.slot, g.gender,
    coalesce(o.total_override, cap.total_lockers, 0)::int,
    least(coalesce(o.occupied_override, occ.occupied, 0),
          coalesce(o.total_override, cap.total_lockers, 0))::int,
    coalesce(o.reserved, 0)::int,
    greatest(coalesce(o.total_override, cap.total_lockers, 0)
      - least(coalesce(o.occupied_override, occ.occupied, 0),
              coalesce(o.total_override, cap.total_lockers, 0))
      - coalesce(o.reserved, 0), 0)::int,
    coalesce(o.status, case
      when coalesce(o.total_override, cap.total_lockers, 0) = 0 then 'closed'
      when coalesce(o.reserved, 0) > 0 then 'reserved'
      else 'available' end),
    occ.campaign_label, o.note, (o.id is not null)
  from lockers_clubs c
  cross join m
  cross join (values (1::smallint), (2::smallint)) as s(slot)
  cross join (values ('male'), ('female')) as g(gender)
  left join lockers_managers mg on mg.id = c.manager_id
  left join lockers_capacity cap
    on cap.club_id = c.id and cap.gender = g.gender and cap.surface_type = p_surface
  left join lockers_occupancy occ
    on occ.club_id = c.id and occ.month = m.month and occ.slot = s.slot
   and occ.gender = g.gender and occ.surface_type = p_surface
  left join lockers_overrides o
    on o.club_id = c.id and o.month = m.month and o.slot = s.slot
   and o.gender = g.gender and o.surface_type = p_surface
  where c.is_active
$$;

create or replace function lockers_month_summary(p_month date, p_surface text default 'lockers')
returns table (
  clubs_total bigint, lockers_total bigint, lockers_occupied bigint,
  lockers_reserved bigint, lockers_free bigint, slots_closed bigint, load_percent numeric
)
language sql stable set search_path = public as $$
  with a as (select * from lockers_availability(p_month, p_surface))
  select count(distinct club_id), sum(total)::bigint, sum(occupied)::bigint,
         sum(reserved)::bigint, sum(free)::bigint,
         count(*) filter (where status = 'closed'),
         case when sum(total) > 0
           then round(100.0 * (sum(occupied) + sum(reserved)) / sum(total), 1) else 0 end
  from a
$$;

-- Пересечения: слот 1 и слот 2 одной раздевалки заняты разными проектами
create or replace function lockers_overlaps(p_month date, p_surface text default 'lockers')
returns table (
  club_id uuid, club_name text, network text,
  manager_id uuid, manager_name text, gender text,
  slot1_campaign text, slot1_occupied integer, slot1_status text,
  slot2_campaign text, slot2_occupied integer, slot2_status text,
  total integer, is_overlap boolean
)
language sql stable set search_path = public as $$
  with a as (select * from lockers_availability(p_month, p_surface)),
  paired as (
    select a.club_id, a.club_name, a.network, a.manager_id, a.manager_name, a.gender,
      max(a.total) as total,
      max(case when a.slot = 1 then a.campaign_label end) as s1_campaign,
      max(case when a.slot = 1 then a.occupied end)       as s1_occupied,
      max(case when a.slot = 1 then a.status end)         as s1_status,
      max(case when a.slot = 2 then a.campaign_label end) as s2_campaign,
      max(case when a.slot = 2 then a.occupied end)       as s2_occupied,
      max(case when a.slot = 2 then a.status end)         as s2_status
    from a group by a.club_id, a.club_name, a.network, a.manager_id, a.manager_name, a.gender
  )
  select club_id, club_name, network, manager_id, manager_name, gender,
    s1_campaign, s1_occupied, s1_status, s2_campaign, s2_occupied, s2_status, total,
    (s1_occupied > 0 and s2_occupied > 0
      and coalesce(s1_campaign,'—') is distinct from coalesce(s2_campaign,'—'))
  from paired
  where s1_occupied > 0 or s2_occupied > 0
$$;

grant execute on function lockers_availability(date, text)  to anon, authenticated;
grant execute on function lockers_month_summary(date, text) to anon, authenticated;
grant execute on function lockers_overlaps(date, text)      to anon, authenticated;

-- ============================================================================
-- ЧАСТЬ 3. Свободно по умолчанию, сети из файла, DDX без шкафчиков,
--          конфликты «бронь vs АП», кампании менеджера.
-- ============================================================================

-- Не у всех клубов есть шкафчики: DDX — только экраны.
alter table lockers_clubs add column if not exists has_lockers boolean not null default true;
create index if not exists lockers_clubs_has_lockers_idx on lockers_clubs (has_lockers);

-- Алиасы названий: в дашборде кампаний те же клубы записаны иначе.
create table if not exists lockers_club_aliases (
  id      uuid primary key default gen_random_uuid(),
  club_id uuid not null references lockers_clubs(id) on delete cascade,
  alias   text not null unique,
  note    text
);
create index if not exists lockers_club_aliases_club_idx on lockers_club_aliases (club_id);
alter table lockers_club_aliases enable row level security;
drop policy if exists lockers_club_aliases_public_read on lockers_club_aliases;
create policy lockers_club_aliases_public_read on lockers_club_aliases for select using (true);
drop policy if exists lockers_club_aliases_edit_write on lockers_club_aliases;
create policy lockers_club_aliases_edit_write on lockers_club_aliases for all to authenticated
  using (lockers_can_edit()) with check (lockers_can_edit());

-- «Количество не указано» и «ноль шкафчиков» — разные вещи.
alter table lockers_capacity alter column total_lockers drop not null;
alter table lockers_capacity alter column total_lockers drop default;

-- Бронь ставит человек, занятость приходит из АП.
alter table lockers_overrides drop constraint if exists lockers_overrides_status_check;
alter table lockers_overrides add constraint lockers_overrides_status_check
  check (status in ('available','occupied','closed','reserved'));
alter table lockers_overrides add column if not exists reserved_for text;
alter table lockers_overrides add column if not exists conflict_ack boolean not null default false;

-- Связь клубов дашборда кампаний с менеджерами (по названию и алиасам).
create or replace view v_dashboard_club_manager as
select
  dc.id as dashboard_club_id, dc.name as dashboard_club_name, dc.city,
  lc.id as lockers_club_id, lc.network, lc.manager_id,
  mg.name as manager_name, mg.slug as manager_slug
from public.clubs dc
left join lockers_clubs lc
  on lower(regexp_replace(lc.name, '\s+', ' ', 'g')) = lower(regexp_replace(dc.name, '\s+', ' ', 'g'))
  or lc.id = (
    select a.club_id from lockers_club_aliases a
    where lower(regexp_replace(a.alias, '\s+', ' ', 'g')) = lower(regexp_replace(dc.name, '\s+', ' ', 'g'))
    limit 1
  )
left join lockers_managers mg on mg.id = lc.manager_id;
grant select on v_dashboard_club_manager to anon, authenticated;

-- Актуальные версии функций интерфейса лежат в миграциях
-- lockers_free_by_default_and_conflicts и lockers_manager_campaigns_v2.
