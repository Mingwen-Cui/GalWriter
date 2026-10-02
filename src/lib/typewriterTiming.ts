export const DEFAULT_TYPEWRITER_INTERVAL_MS = 120;

/** Upgrade the old playtest default once, while retaining later speed choices. */
export function migratePlaytestTypewriterSpeed(speed: number, version: string | null) {
  return version !== '3' && speed === 30 ? DEFAULT_TYPEWRITER_INTERVAL_MS : speed;
}

export function migratePlaytestTextPlayback(mode: string, version: string | null) {
  return version !== '3' && mode === 'immediate' ? 'typewriter' : mode;
}
