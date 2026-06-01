/**
 * Fixed-capacity FIFO ring buffer. Oldest entries are dropped when full.
 */
export class RingBuffer<T> {
  private buf: T[];
  private cap: number;

  constructor(capacity: number) {
    this.cap = capacity;
    this.buf = [];
  }

  push(entry: T): void {
    if (this.buf.length >= this.cap) this.buf.shift();
    this.buf.push(entry);
  }

  toArray(): readonly T[] {
    return [...this.buf];
  }

  clear(): void {
    this.buf.length = 0;
  }

  get size(): number {
    return this.buf.length;
  }
}
