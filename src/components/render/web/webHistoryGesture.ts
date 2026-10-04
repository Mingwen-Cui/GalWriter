/** A pointer gesture records its initial snapshot only on its first mutation. */
export class WebHistoryGesture<T> {
  private active: { initial: T; recorded: boolean; cancelled: boolean } | null = null;

  begin(initial: T) {
    if (!this.active) this.active = { initial, recorded: false, cancelled: false };
  }

  record(current: T): T | null {
    if (!this.active) return current;
    if (this.active.recorded || this.active.cancelled) return null;
    this.active.recorded = true;
    return this.active.initial;
  }

  get cancelled() { return this.active?.cancelled === true; }
  cancel() { if (this.active) this.active.cancelled = true; }
  end() { this.active = null; }
}
