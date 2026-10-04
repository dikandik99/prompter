// Text metrics for scripts and teleprompter timing.
export function countWords(text: string): number {
  const t = (text || "").trim();
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}

export function countChars(text: string): number {
  return (text || "").length;
}

// Estimated speaking seconds for a given word count and words-per-minute.
export function estimateSeconds(words: number, wpm: number): number {
  if (!words || wpm <= 0) return 0;
  return Math.round((words / wpm) * 60);
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function formatClock(ms: number): string {
  return formatDuration(ms / 1000);
}
