/** Нормализация названия клуба для сопоставления файла с каталогом. */
export function normalizeClubName(name: string): string {
  return name
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[«»"'`]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[.,;]+$/, '')
    .trim();
}

/** Сеть по названию клуба: первое слово(а) до топонима. Запасной вариант, когда сеть не задана. */
export function guessNetwork(name: string, knownNetworks: string[]): string | null {
  const lower = name.toLowerCase();
  const match = knownNetworks
    .filter((n) => lower.startsWith(n.toLowerCase()))
    .sort((a, b) => b.length - a.length)[0];
  return match ?? null;
}
