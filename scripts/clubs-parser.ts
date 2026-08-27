/**
 * Парсер файла «клубы + менеджеры».
 *
 * Файл — одна строка на клуб: название клуба и ответственный менеджер.
 * Заголовок необязателен: если первая строка похожа на заголовок
 * («Клуб», «Менеджер»), она пропускается.
 *
 * Проверки жёсткие: дубликаты, пустые строки и несовпадение с ожидаемым
 * количеством клубов останавливают импорт — молча записать «сколько
 * получилось» нельзя.
 */

import ExcelJS from 'exceljs';

export type ParsedClubRow = {
  rowNumber: number;
  club: string;
  manager: string | null;
  network: string | null;
};

export type ClubsParseResult = {
  fileName: string;
  rows: ParsedClubRow[];
  totalRows: number;
  uniqueClubs: number;
  duplicates: { name: string; count: number; rows: number[] }[];
  skippedRows: number[];
  missingManager: string[];
  managers: { name: string; clubs: number }[];
  hasNetworkColumn: boolean;
};

const HEADER_WORDS = ['клуб', 'фитнес-клуб', 'название', 'менеджер', 'ответственный', 'сеть'];

function cellText(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'object') {
    const o = v as { text?: string; result?: unknown; richText?: { text: string }[] };
    if (typeof o.text === 'string') return o.text;
    if (Array.isArray(o.richText)) return o.richText.map((r) => r.text).join('');
    if (o.result != null) return String(o.result);
    return '';
  }
  return String(v);
}

const normalize = (s: string) =>
  s.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').replace(/[«»"']/g, '').trim();

export async function parseClubsFile(
  buffer: ArrayBuffer,
  fileName: string,
): Promise<ClubsParseResult> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  const ws = wb.worksheets[0];
  if (!ws) {
    throw new Error('В файле нет ни одного листа');
  }

  const rows: ParsedClubRow[] = [];
  const skippedRows: number[] = [];
  let hasNetworkColumn = false;

  for (let r = 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const club = cellText(row.getCell(1).value).trim();
    const manager = cellText(row.getCell(2).value).trim();
    const third = cellText(row.getCell(3).value).trim();

    // Заголовок
    if (r === 1 && HEADER_WORDS.includes(normalize(club))) continue;

    if (!club) {
      // Пустая строка в середине файла — это потерянная строка, о ней надо сказать
      if (manager || third) skippedRows.push(r);
      continue;
    }

    if (third) hasNetworkColumn = true;

    rows.push({
      rowNumber: r,
      club,
      manager: manager || null,
      network: third || null,
    });
  }

  // Дубликаты по нормализованному названию
  const byName = new Map<string, { name: string; rows: number[] }>();
  for (const row of rows) {
    const key = normalize(row.club);
    const found = byName.get(key);
    if (found) found.rows.push(row.rowNumber);
    else byName.set(key, { name: row.club, rows: [row.rowNumber] });
  }

  const duplicates = [...byName.values()]
    .filter((d) => d.rows.length > 1)
    .map((d) => ({ name: d.name, count: d.rows.length, rows: d.rows }));

  const managerCounts = new Map<string, number>();
  rows.forEach((r) => {
    if (!r.manager) return;
    managerCounts.set(r.manager, (managerCounts.get(r.manager) ?? 0) + 1);
  });

  return {
    fileName,
    rows,
    totalRows: rows.length,
    uniqueClubs: byName.size,
    duplicates,
    skippedRows,
    missingManager: rows.filter((r) => !r.manager).map((r) => r.club),
    managers: [...managerCounts.entries()]
      .map(([name, clubs]) => ({ name, clubs }))
      .sort((a, b) => b.clubs - a.clubs),
    hasNetworkColumn,
  };
}

/** Ошибки, при которых импорт запускать нельзя. */
export function validateClubs(
  parsed: ClubsParseResult,
  expectedCount: number | null,
): string[] {
  const errors: string[] = [];

  if (parsed.totalRows === 0) {
    errors.push('В файле не найдено ни одного клуба.');
  }

  if (parsed.duplicates.length) {
    const list = parsed.duplicates
      .slice(0, 5)
      .map((d) => `«${d.name}» (строки ${d.rows.join(', ')})`)
      .join('; ');
    errors.push(
      `Найдены дубликаты названий: ${parsed.duplicates.length} шт. ${list}${
        parsed.duplicates.length > 5 ? ' и другие' : ''
      }`,
    );
  }

  if (parsed.skippedRows.length) {
    errors.push(
      `Потерянные строки без названия клуба: ${parsed.skippedRows.length} шт. (строки ${parsed.skippedRows
        .slice(0, 10)
        .join(', ')})`,
    );
  }

  if (expectedCount != null && parsed.uniqueClubs !== expectedCount) {
    errors.push(
      `Ожидалось ${expectedCount} клубов, а в файле ${parsed.uniqueClubs}. Импорт остановлен — проверьте файл или измените контрольное число.`,
    );
  }

  return errors;
}
