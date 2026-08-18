export type TodaysAffirmationEntry = {
  id: string;
  /** Local calendar date in YYYY-MM-DD form. */
  date: string;
  imageUrl: string;
};

export function createAffirmationEntry(
  overrides: Partial<TodaysAffirmationEntry> = {},
): TodaysAffirmationEntry {
  return {
    id:
      overrides.id ||
      (typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `affirmation-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    date: overrides.date || "",
    imageUrl: overrides.imageUrl || "",
  };
}

function isValidDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function toEntry(item: unknown): TodaysAffirmationEntry | null {
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;
  const record = item as Record<string, unknown>;
  return {
    id: String(record.id ?? "").trim() || createAffirmationEntry().id,
    date: String(record.date ?? "").trim(),
    imageUrl: String(record.imageUrl ?? "").trim(),
  };
}

/** Keep draft rows for the Settings UI (may be incomplete). */
export function normalizeTodaysAffirmationEntries(
  value: unknown,
): TodaysAffirmationEntry[] {
  if (!Array.isArray(value)) return [];

  const entries: TodaysAffirmationEntry[] = [];
  for (const item of value) {
    const entry = toEntry(item);
    if (entry) entries.push(entry);
  }

  return entries.sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return a.date.localeCompare(b.date);
  });
}

/** Publishable entries only: valid unique date (image optional). */
export function parseTodaysAffirmationEntries(
  value: unknown,
): TodaysAffirmationEntry[] {
  const seenDates = new Set<string>();
  return normalizeTodaysAffirmationEntries(value).filter((entry) => {
    if (!entry.date || !isValidDateKey(entry.date)) {
      return false;
    }
    if (seenDates.has(entry.date)) return false;
    seenDates.add(entry.date);
    return true;
  });
}

export function todayDateKey(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export type PublicAffirmationEntry = {
  id: string;
  date: string;
  /** Entry-specific image, if set. */
  imageUrl: string | null;
  /** Image the app should display (entry image or default fallback). */
  resolvedImageUrl: string | null;
  usedDefaultImage: boolean;
};

export function toPublicAffirmationEntry(
  entry: TodaysAffirmationEntry,
  defaultImageUrl: string,
): PublicAffirmationEntry {
  const entryImage = entry.imageUrl.trim();
  const fallback = defaultImageUrl.trim();
  const resolvedImageUrl = entryImage || fallback || null;

  return {
    id: entry.id,
    date: entry.date,
    imageUrl: entryImage || null,
    resolvedImageUrl,
    usedDefaultImage: !entryImage && Boolean(fallback),
  };
}

export function splitAffirmationEntriesByDate(
  entries: TodaysAffirmationEntry[],
  today = todayDateKey(),
): {
  past: TodaysAffirmationEntry[];
  upcoming: TodaysAffirmationEntry[];
} {
  const past: TodaysAffirmationEntry[] = [];
  const upcoming: TodaysAffirmationEntry[] = [];

  for (const entry of entries) {
    if (entry.date < today) past.push(entry);
    else upcoming.push(entry);
  }

  return { past, upcoming };
}

export function resolveTodaysAffirmation(options: {
  entries: TodaysAffirmationEntry[];
  defaultImageUrl: string;
  date?: string;
}): {
  id: string;
  date: string;
  imageUrl: string;
  usedDefaultImage: boolean;
} | null {
  const date = options.date || todayDateKey();
  const entry = parseTodaysAffirmationEntries(options.entries).find(
    (item) => item.date === date,
  );
  if (!entry) return null;

  const entryImage = entry.imageUrl.trim();
  const defaultImage = options.defaultImageUrl.trim();
  const imageUrl = entryImage || defaultImage;

  return {
    id: entry.id,
    date,
    imageUrl,
    usedDefaultImage: !entryImage && Boolean(defaultImage),
  };
}
