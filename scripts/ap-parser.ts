/**
 * Парсер адресной программы (АП) под занятость шкафчиков.
 *
 * Устроен так, чтобы переживать расхождения между файлами:
 *  - заголовки ищутся по НАЗВАНИЮ, а не по букве колонки (в разных листах
 *    одной и той же АП колонки съезжают на одну-две позиции);
 *  - у каждого поля список синонимов + запасной поиск по подстроке;
 *  - строки, которые не удалось разобрать, не роняют импорт, а попадают
 *    в issues и показываются админу в предпросмотре.
 *
 * Смысловая модель (подтверждена на реальной АП):
 *  «Количество»          → вместимость раздевалки (всего шкафчиков)
 *  «Статус конструкций»  → занятость: «Готовы к размещению» / «Занято с … по …» / «Занято до …»
 *  «Слот»                → «Слот 1» / «Слот 2»
 *  «Зона расположения»   → Мужская / Женская раздевалка
 *  «Тип конструкции»     → стикеры в шкафах / стикер на зеркале
 */

import ExcelJS from 'exceljs';
type Gender = 'male' | 'female';
type SurfaceType = 'lockers' | 'mirrors';

export type Interval = { start: string; end: string }; // ISO даты

export type ParsedRow = {
  rowNumber: number;
  clubName: string;
  city: string | null;
  address: string | null;
  surfaceType: SurfaceType;
  slot: 1 | 2;
  gender: Gender | null;
  total: number | null;
  statusRaw: string | null;
  occupiedIntervals: Interval[];
  occupiedMonths: string[];
  issues: string[];
  raw: Record<string, string>;
};

export type ParsedSheet = {
  sheetName: string;
  surfaceType: SurfaceType;
  headerRow: number;
  headerMap: Record<string, string>; // поле → фактический заголовок в файле
  rows: ParsedRow[];
};

export type ParseResult = {
  fileName: string;
  campaignLabel: string | null;
  sheets: ParsedSheet[];
  monthsDetected: string[];
  warnings: string[];
};

/* ------------------------------------------------------------------ */
/* Нормализация заголовков                                             */
/* ------------------------------------------------------------------ */

const norm = (s: unknown): string =>
  String(s ?? '')
    .replace(/\s+/g, ' ')
    .replace(/[«»"']/g, '')
    .trim()
    .toLowerCase();

/** Поля, которые парсер умеет находить. Порядок = приоритет. */
const FIELD_SYNONYMS: Record<string, string[]> = {
  club: ['фитнес-клуб', 'фитнес клуб', 'клуб', 'название клуба', 'площадка'],
  address: ['адрес клуба', 'адрес'],
  city: ['город'],
  status: ['статус конструкций', 'статус конструкции', 'статус', 'статус поверхности'],
  slot: ['слот'],
  zone: [
    'зона расположения (список)',
    'зона расположения',
    'место расположения в клубе (подробное описание)',
    'место расположения в клубе',
    'раздевалка',
  ],
  quantity: ['количество', 'кол-во', 'кол-во поверхностей'],
  construction: ['тип конструкции', 'вид конструкции', 'формат размещения', 'формат'],
  stickerKind: ['вид стикера'],
  size: ['размер'],
  dateStart: ['дата старта рк', 'дата старта', 'период размещения', 'период рк'],
  dateEnd: ['дата окончания рк', 'дата окончания'],
  months: ['кол-во месяцев рекламной кампании', 'кол-во месяцев'],
};

/** Заголовки, которые не должны перехватывать поле quantity. */
const QUANTITY_BLOCKLIST = [
  'кол-во экранов в клубе',
  'кол-во выходов в блоке',
  'кол-во дней рекламной кампании',
  'кол-во месяцев рекламной кампании',
  'количество показов на 1 экране/час',
  'количество показов на 1 экране/день',
  'количество часов работы клуба',
  'кол-во площадок',
];

function resolveHeaders(headers: string[]): { map: Record<string, number>; labels: Record<string, string> } {
  const map: Record<string, number> = {};
  const labels: Record<string, string> = {};
  const normalized = headers.map(norm);

  for (const [field, synonyms] of Object.entries(FIELD_SYNONYMS)) {
    let found = -1;

    // 1. точное совпадение по синонимам
    for (const syn of synonyms) {
      const i = normalized.findIndex(
        (h, idx) => h === syn && !(field === 'quantity' && QUANTITY_BLOCKLIST.includes(normalized[idx])),
      );
      if (i >= 0) {
        found = i;
        break;
      }
    }

    // 2. совпадение по началу строки
    if (found < 0) {
      for (const syn of synonyms) {
        const i = normalized.findIndex(
          (h, idx) =>
            h.startsWith(syn) && !(field === 'quantity' && QUANTITY_BLOCKLIST.includes(normalized[idx])),
        );
        if (i >= 0) {
          found = i;
          break;
        }
      }
    }

    // 3. вхождение подстроки
    if (found < 0) {
      for (const syn of synonyms) {
        const i = normalized.findIndex(
          (h, idx) =>
            h.includes(syn) && !(field === 'quantity' && QUANTITY_BLOCKLIST.includes(normalized[idx])),
        );
        if (i >= 0) {
          found = i;
          break;
        }
      }
    }

    if (found >= 0) {
      map[field] = found;
      labels[field] = headers[found];
    }
  }

  return { map, labels };
}

/* ------------------------------------------------------------------ */
/* Даты                                                                */
/* ------------------------------------------------------------------ */

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

function expandYear(y: number): number {
  if (y >= 1000) return y;
  return y < 70 ? 2000 + y : 1900 + y;
}

function lastDayOfMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Разбирает одиночную дату: Date, «01.10.26», «01.10.2026», «01.10» (год из контекста). */
export function parseDate(value: unknown, fallbackYear: number): string | null {
  if (value == null || value === '') return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return iso(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
  }

  const s = String(value).trim();
  const m = s.match(/^(\d{1,2})[.\-/](\d{1,2})(?:[.\-/](\d{2,4}))?$/);
  if (!m) return null;

  const d = Number(m[1]);
  const mo = Number(m[2]);
  const y = m[3] ? expandYear(Number(m[3])) : fallbackYear;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return iso(y, mo, d);
}

/** «01.09-30.09, 01.11-31.12» → список интервалов. */
export function parseIntervalList(value: unknown, fallbackYear: number): Interval[] {
  if (value == null) return [];
  const s = String(value).trim();
  if (!s || s === '-') return [];

  const out: Interval[] = [];
  for (const chunk of s.split(/[,;]/)) {
    const part = chunk.trim();
    if (!part) continue;
    const m = part.match(
      /(\d{1,2}[.\-/]\d{1,2}(?:[.\-/]\d{2,4})?)\s*[-–—]\s*(\d{1,2}[.\-/]\d{1,2}(?:[.\-/]\d{2,4})?)/,
    );
    if (!m) continue;
    const start = parseDate(m[1], fallbackYear);
    const end = parseDate(m[2], fallbackYear);
    if (start && end) out.push({ start, end });
  }
  return out;
}

/**
 * Разбирает «Статус конструкций» в интервалы ЗАНЯТОСТИ.
 * Возвращает null, если статус про занятость ничего не говорит.
 */
export function parseStatus(
  statusRaw: unknown,
  fallbackYear: number,
  windowStart: string | null,
  windowEnd: string | null,
): { intervals: Interval[]; free: boolean } | null {
  const s = String(statusRaw ?? '').trim();
  if (!s || s === '-') return null;
  const low = s.toLowerCase();

  if (/готов|свободн|доступн|в продаже/.test(low) && !/занят/.test(low)) {
    return { intervals: [], free: true };
  }

  if (!/занят|брон|закрыт|недоступ/.test(low)) return null;

  // «Занято с 01.10.26 по 31.10.26»
  const range = s.match(
    /с\s*(\d{1,2}[.\-/]\d{1,2}(?:[.\-/]\d{2,4})?)\s*(?:по|до)\s*(\d{1,2}[.\-/]\d{1,2}(?:[.\-/]\d{2,4})?)/i,
  );
  if (range) {
    const start = parseDate(range[1], fallbackYear);
    const end = parseDate(range[2], fallbackYear);
    if (start && end) return { intervals: [{ start, end }], free: false };
  }

  // «Занято до 01.11.26» — граница исключающая: занято по день, предшествующий указанному.
  // Дата начала занятости в АП не указана, поэтому берём начало месяца, в котором
  // занятость заканчивается (либо начало периода РК, если оно раньше).
  const until = s.match(/до\s*(\d{1,2}[.\-/]\d{1,2}(?:[.\-/]\d{2,4})?)/i);
  if (until) {
    const boundary = parseDate(until[1], fallbackYear);
    if (boundary) {
      const occupiedEnd = shiftDay(boundary, -1);
      const start =
        windowStart && windowStart <= occupiedEnd ? windowStart : firstOfMonth(occupiedEnd);
      return { intervals: [{ start, end: occupiedEnd }], free: false };
    }
  }

  // «Занято» без дат — занято на весь известный период
  if (windowStart && windowEnd) {
    return { intervals: [{ start: windowStart, end: windowEnd }], free: false };
  }

  return { intervals: [], free: false };
}

function firstOfMonth(isoDate: string): string {
  return `${isoDate.slice(0, 7)}-01`;
}

function shiftDay(isoDate: string, delta: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return iso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

/** Все месяцы (первое число), которые пересекает интервал. */
export function monthsOfInterval({ start, end }: Interval): string[] {
  if (end < start) return [];
  const out: string[] = [];
  let [y, m] = start.split('-').map(Number);
  const [ey, em] = end.split('-').map(Number);
  while (y < ey || (y === ey && m <= em)) {
    out.push(iso(y, m, 1));
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

function subtractIntervals(window: Interval, free: Interval[]): Interval[] {
  let cursor = window.start;
  const busy: Interval[] = [];
  const sorted = [...free].sort((a, b) => a.start.localeCompare(b.start));
  for (const f of sorted) {
    if (f.start > cursor) busy.push({ start: cursor, end: shiftDay(f.start, -1) });
    if (f.end >= cursor) cursor = shiftDay(f.end, 1);
  }
  if (cursor <= window.end) busy.push({ start: cursor, end: window.end });
  return busy.filter((i) => i.start <= i.end);
}

/* ------------------------------------------------------------------ */
/* Разбор значений строк                                               */
/* ------------------------------------------------------------------ */

function cellText(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'object') {
    const o = v as { text?: string; result?: unknown; richText?: { text: string }[]; hyperlink?: string };
    if (typeof o.text === 'string') return o.text;
    if (Array.isArray(o.richText)) return o.richText.map((r) => r.text).join('');
    if (o.result != null) return String(o.result);
    if (v instanceof Date) return v.toISOString();
    return '';
  }
  return String(v);
}

function parseGender(value: string): Gender | null {
  const s = value.toLowerCase();
  if (/жен/.test(s)) return 'female';
  if (/муж/.test(s)) return 'male';
  return null;
}

function parseSlot(value: string): 1 | 2 {
  const m = value.match(/(\d)/);
  const n = m ? Number(m[1]) : 1;
  return n === 2 ? 2 : 1;
}

function parseSurfaceType(construction: string, sheetName: string): SurfaceType {
  const s = `${construction} ${sheetName}`.toLowerCase();
  if (/зеркал/.test(s)) return 'mirrors';
  return 'lockers';
}

function parseQuantity(value: string): number | null {
  const cleaned = value.replace(/\s| /g, '').replace(',', '.');
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}

/** Лист похож на АП по раздевалкам? */
function isRelevantSheet(name: string): boolean {
  const s = name.toLowerCase();
  if (/сводная|скидк|условия|прайс|лист2|лист3/.test(s)) return false;
  return /ап|стикер|шкаф|зеркал|раздевал/.test(s) || true;
}

/* ------------------------------------------------------------------ */
/* Основной разбор                                                     */
/* ------------------------------------------------------------------ */

export async function parseAddressProgram(
  buffer: ArrayBuffer,
  fileName: string,
): Promise<ParseResult> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  const warnings: string[] = [];
  const sheets: ParsedSheet[] = [];
  const allMonths = new Set<string>();

  const campaignLabel = extractCampaignLabel(wb);

  for (const ws of wb.worksheets) {
    if (!isRelevantSheet(ws.name)) continue;

    const header = findHeaderRow(ws);
    if (!header) continue;

    const { map, labels } = resolveHeaders(header.headers);
    if (map.club == null || map.quantity == null) {
      warnings.push(
        `Лист «${ws.name}» пропущен: не найдены обязательные колонки (${
          map.club == null ? 'название клуба' : 'количество'
        }).`,
      );
      continue;
    }

    const rows: ParsedRow[] = [];
    const fallbackYear = new Date().getFullYear();

    for (let r = header.rowNumber + 1; r <= ws.rowCount; r++) {
      const excelRow = ws.getRow(r);
      const get = (field: string): string => {
        const idx = map[field];
        if (idx == null) return '';
        return cellText(excelRow.getCell(idx + 1).value).trim();
      };
      const getRawCell = (field: string): unknown => {
        const idx = map[field];
        if (idx == null) return null;
        return excelRow.getCell(idx + 1).value;
      };

      const clubName = get('club');
      if (!clubName || clubName === '-' || /^итог/i.test(clubName)) continue;

      const issues: string[] = [];
      const construction = get('construction');
      const surfaceType = parseSurfaceType(construction, ws.name);

      const zone = get('zone');
      const gender = parseGender(zone);
      if (!gender) issues.push(`Не удалось определить раздевалку из «${zone || 'пусто'}»`);

      const total = parseQuantity(get('quantity'));
      if (total == null) issues.push('Не удалось прочитать количество шкафчиков');

      const slot = parseSlot(get('slot'));
      const statusRaw = get('status') || null;

      const startRaw = getRawCell('dateStart');
      const endRaw = getRawCell('dateEnd');
      const windowStart = parseDate(startRaw, fallbackYear);
      const windowEnd = parseDate(endRaw, fallbackYear);
      const freeIntervals = parseIntervalList(startRaw, fallbackYear);

      const parsed = parseStatus(statusRaw, fallbackYear, windowStart, windowEnd);

      let occupiedIntervals: Interval[] = [];
      if (parsed && !parsed.free && parsed.intervals.length) {
        occupiedIntervals = parsed.intervals;
      } else if (parsed && !parsed.free && freeIntervals.length && windowStart && windowEnd) {
        // Статус говорит «занято», но без дат: вычитаем свободные окна из периода РК.
        occupiedIntervals = subtractIntervals({ start: windowStart, end: windowEnd }, freeIntervals);
      }

      if (!parsed && statusRaw) {
        issues.push(`Статус «${statusRaw}» не распознан — занятость не проставлена`);
      }

      const occupiedMonths = [...new Set(occupiedIntervals.flatMap(monthsOfInterval))].sort();
      occupiedMonths.forEach((m) => allMonths.add(m));

      // месяцы периода РК тоже считаем «известными», чтобы админ видел сетку целиком
      if (windowStart && windowEnd) {
        monthsOfInterval({ start: windowStart, end: windowEnd }).forEach((m) => allMonths.add(m));
      }
      freeIntervals.forEach((i) => monthsOfInterval(i).forEach((m) => allMonths.add(m)));

      rows.push({
        rowNumber: r,
        clubName,
        city: get('city') || null,
        address: get('address') || null,
        surfaceType,
        slot,
        gender,
        total,
        statusRaw,
        occupiedIntervals,
        occupiedMonths,
        issues,
        raw: {
          construction,
          zone,
          size: get('size'),
          stickerKind: get('stickerKind'),
          dateStart: get('dateStart'),
          dateEnd: get('dateEnd'),
        },
      });
    }

    if (rows.length) {
      sheets.push({
        sheetName: ws.name,
        surfaceType: rows[0].surfaceType,
        headerRow: header.rowNumber,
        headerMap: labels,
        rows,
      });
    }
  }

  if (!sheets.length) {
    warnings.push('В файле не найдено ни одного листа с адресной программой по раздевалкам.');
  }

  return {
    fileName,
    campaignLabel,
    sheets,
    monthsDetected: [...allMonths].sort(),
    warnings,
  };
}

/** Ищет строку заголовков в первых 15 строках листа. */
function findHeaderRow(
  ws: ExcelJS.Worksheet,
): { rowNumber: number; headers: string[] } | null {
  const limit = Math.min(ws.rowCount, 15);
  for (let r = 1; r <= limit; r++) {
    const row = ws.getRow(r);
    const headers: string[] = [];
    let maxCol = 0;
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      headers[col - 1] = cellText(cell.value).trim();
      maxCol = Math.max(maxCol, col);
    });
    for (let i = 0; i < maxCol; i++) if (headers[i] == null) headers[i] = '';

    const normalized = headers.map(norm);
    const hasClub = normalized.some((h) => /фитнес.?клуб|название клуба/.test(h));
    const hasQty = normalized.some((h) => h === 'количество' || h.startsWith('кол-во'));
    if (hasClub && hasQty) return { rowNumber: r, headers };
  }
  return null;
}

/** Клиент/бренд из листа «Сводная», если он есть. */
function extractCampaignLabel(wb: ExcelJS.Workbook): string | null {
  const ws = wb.worksheets.find((s) => /сводная|summary/i.test(s.name));
  if (!ws) return null;
  const limit = Math.min(ws.rowCount, 20);
  for (let r = 1; r <= limit; r++) {
    const row = ws.getRow(r);
    const cells: string[] = [];
    row.eachCell({ includeEmpty: false }, (cell) => cells.push(cellText(cell.value).trim()));
    const idx = cells.findIndex((c) => /^(клиент|бренд)$/i.test(c));
    if (idx >= 0 && cells[idx + 1]) return cells[idx + 1];
  }
  return null;
}
