export type TodaysMeditationEntry = {
  id: string;
  /** Local calendar date in YYYY-MM-DD form. */
  date: string;
  audioUrl: string;
  imageUrl: string;
};

export function createMeditationEntry(
  overrides: Partial<TodaysMeditationEntry> = {},
): TodaysMeditationEntry {
  return {
    id:
      overrides.id ||
      (typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `meditation-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    date: overrides.date || "",
    audioUrl: overrides.audioUrl || "",
    imageUrl: overrides.imageUrl || "",
  };
}

function isValidDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function toEntry(item: unknown): TodaysMeditationEntry | null {
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;
  const record = item as Record<string, unknown>;
  return {
    id: String(record.id ?? "").trim() || createMeditationEntry().id,
    date: String(record.date ?? "").trim(),
    audioUrl: String(record.audioUrl ?? "").trim(),
    imageUrl: String(record.imageUrl ?? "").trim(),
  };
}

/** Keep draft rows for the Settings UI (may be incomplete). */
export function normalizeTodaysMeditationEntries(
  value: unknown,
): TodaysMeditationEntry[] {
  if (!Array.isArray(value)) return [];

  const entries: TodaysMeditationEntry[] = [];
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

/** Publishable entries only: valid unique date + required audio. */
export function parseTodaysMeditationEntries(
  value: unknown,
): TodaysMeditationEntry[] {
  const seenDates = new Set<string>();
  return normalizeTodaysMeditationEntries(value).filter((entry) => {
    if (!entry.date || !entry.audioUrl || !isValidDateKey(entry.date)) {
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

export type PublicMeditationEntry = {
  id: string;
  date: string;
  audioUrl: string;
  /** Entry-specific image, if set. */
  imageUrl: string | null;
  /** Image the app should display (entry image or default fallback). */
  resolvedImageUrl: string | null;
  usedDefaultImage: boolean;
};

export function toPublicMeditationEntry(
  entry: TodaysMeditationEntry,
  defaultImageUrl: string,
): PublicMeditationEntry {
  const entryImage = entry.imageUrl.trim();
  const fallback = defaultImageUrl.trim();
  const resolvedImageUrl = entryImage || fallback || null;

  return {
    id: entry.id,
    date: entry.date,
    audioUrl: entry.audioUrl,
    imageUrl: entryImage || null,
    resolvedImageUrl,
    usedDefaultImage: !entryImage && Boolean(fallback),
  };
}

export function splitMeditationEntriesByDate(
  entries: TodaysMeditationEntry[],
  today = todayDateKey(),
): {
  past: TodaysMeditationEntry[];
  upcoming: TodaysMeditationEntry[];
} {
  const past: TodaysMeditationEntry[] = [];
  const upcoming: TodaysMeditationEntry[] = [];

  for (const entry of entries) {
    if (entry.date < today) past.push(entry);
    else upcoming.push(entry);
  }

  return { past, upcoming };
}

export function resolveTodaysMeditation(options: {
  entries: TodaysMeditationEntry[];
  defaultImageUrl: string;
  date?: string;
}): {
  id: string;
  date: string;
  audioUrl: string;
  imageUrl: string;
  usedDefaultImage: boolean;
} | null {
  const date = options.date || todayDateKey();
  const entry = parseTodaysMeditationEntries(options.entries).find(
    (item) => item.date === date,
  );
  if (!entry) return null;

  const entryImage = entry.imageUrl.trim();
  const defaultImage = options.defaultImageUrl.trim();
  const imageUrl = entryImage || defaultImage;

  return {
    id: entry.id,
    date,
    audioUrl: entry.audioUrl,
    imageUrl,
    usedDefaultImage: !entryImage && Boolean(defaultImage),
  };
}
