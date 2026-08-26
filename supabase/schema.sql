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
