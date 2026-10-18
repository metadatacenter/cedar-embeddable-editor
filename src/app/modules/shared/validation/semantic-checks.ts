import { JsonSourcePolicy, ValidationPolicy } from 'cedar-model-typescript-library';
import { SemanticVerification } from '../models/data-quality-report.model';

export type SemanticAnswer = Pick<SemanticVerification, 'status' | 'code' | 'message' | 'iri'>;
interface Entry {
  controller: AbortController;
  answer: SemanticAnswer;
  pending: boolean;
  promise: Promise<void>;
  expiresAt: number;
}

/** One document's verification cache. Identity includes the complete constraint/version payload. */
export class SemanticChecks {
  private entries = new Map<string, Entry>();
  private used = new Set<string>();
  private disposed = false;
  constructor(private readonly changed: () => void) {}

  begin(): void {
    this.used = new Set();
  }
  end(): void {
    for (const [key, entry] of this.entries) {
      if (!this.used.has(key)) {
        entry.controller.abort();
        this.entries.delete(key);
      }
    }
  }
  get pending(): boolean {
    return [...this.entries.values()].some((entry) => entry.pending);
  }
  hasExpired(): boolean {
    const now = Date.now();
    return [...this.entries.values()].some((entry) => !entry.pending && entry.expiresAt <= now);
  }
  async settled(): Promise<void> {
    await Promise.all([...this.entries.values()].map((entry) => entry.promise));
  }
  dispose(): void {
    this.disposed = true;
    this.entries.forEach((entry) => entry.controller.abort());
    this.entries.clear();
  }

  inspect(url: string | null, body: Record<string, unknown>, iri: string): SemanticAnswer {
    if (!url)
      return {
        iri,
        status: 'notChecked',
        code: 'semanticNotChecked',
        message: 'Semantic verification is not configured.',
      };
    const key = JsonSourcePolicy.stringify([url, body]);
    this.used.add(key);
    const existing = this.entries.get(key);
    if (existing && (existing.pending || Date.now() < existing.expiresAt)) return existing.answer;
    // Refresh lazily on the existing validation/report flow. Pending requests are never restarted.
    existing?.controller.abort();
    const controller = new AbortController();
    const entry: Entry = {
      controller,
      answer: { iri, status: 'notChecked', code: 'semanticNotChecked', message: 'Semantic verification is pending.' },
      pending: true,
      promise: Promise.resolve(),
      expiresAt: Number.POSITIVE_INFINITY,
    };
    this.entries.set(key, entry);
    entry.promise = this.request(url, body, iri, controller.signal).then((answer) => {
      if (this.disposed || controller.signal.aborted || this.entries.get(key) !== entry) return;
      entry.answer = answer;
      entry.pending = false;
      entry.expiresAt = Date.now() + (answer.status === 'passed' || answer.status === 'failed' ? 300_000 : 30_000);
      this.changed();
    });
    return entry.answer;
  }

  private async request(
    url: string,
    body: Record<string, unknown>,
    iri: string,
    signal: AbortSignal,
  ): Promise<SemanticAnswer> {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JsonSourcePolicy.stringify(body),
        signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]),
      });
      if (!response.ok) throw new Error(`Verification service answered ${response.status}.`);
      const answer: unknown = await response.json();
      if (!answer || typeof answer !== 'object') throw new Error('Unreadable verification response.');
      const result = answer as SemanticAnswer;
      if (
        !ValidationPolicy.acceptsSemanticResult(Object.hasOwn(body, 'valueConstraints'), result.status, result.code) ||
        typeof result.message !== 'string' ||
        result.iri !== iri
      )
        throw new Error('Unreadable verification response.');
      return result;
    } catch {
      return {
        iri,
        status: 'unavailable',
        code: 'semanticUnavailable',
        message: 'Semantic verification is unavailable. This value has not been verified.',
      };
    }
  }
}
