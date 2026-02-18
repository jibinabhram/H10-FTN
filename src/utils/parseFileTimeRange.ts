export function parseFileTimeRange(filename?: string) {
  if (!filename) return null;

  // remove extension if present
  const clean = filename.replace(".csv", "");

  // Supported format:
  // 2025-11-18T00-18-50
  // (Old format was 2025-11-18T00-18-50_2025-11-18T00-19-50)

  const parsePart = (p: string) => {
    // Try T separator first: 2025-11-18T00-18-50
    if (p.includes("T")) {
      const [date, time] = p.split("T");
      const iso = `${date}T${time.replace(/-/g, ":")}`;
      return new Date(iso).getTime();
    }

    // Try dash separator: 2026-02-17-14-49-06
    // We expect YYYY-MM-DD-HH-mm-ss
    const parts = p.split("-");
    if (parts.length >= 6) {
      const date = `${parts[0]}-${parts[1]}-${parts[2]}`;
      const time = `${parts[3]}:${parts[4]}:${parts[5]}`;
      return new Date(`${date}T${time}`).getTime();
    }

    return NaN;
  };

  // If there's an underscore, it might be the old format, but we'll prioritize the first part
  const parts = clean.split("_");
  const start = parsePart(parts[0]);

  if (isNaN(start)) return null;

  // Calculate end of the same day (23:59:59.999)
  const startDate = new Date(start);
  const end = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 23, 59, 59, 999).getTime();

  return {
    fileStartMs: start,
    fileEndMs: end,
    durationMs: end - start,
  };
}
