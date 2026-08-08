import { describe, expect, it } from 'vitest';
import { Observable, Subject, of, throwError } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { catchLookupFailure } from '@cee/util/lookup-failure';

/**
 * Two separate defects, one operator.
 *
 * Lives in the harness rather than beside the source because `catchLookupFailure`
 * is pure rxjs with no Angular in it, and the harness is what the coverage floor
 * for `shared/util` measures. Run from `src/` it was tested but uncounted, which
 * read in the report as an untested file.
 *
 * The reported one: every authority and terminology field turned a failed
 * lookup into an empty list and lost the fact, so a service being down was
 * shown as "No results found".
 *
 * The one found while fixing it: the controlled-terms field had no catch at
 * all, so a failing request ended its `valueChanges` pipeline and the field's
 * autocomplete stayed dead for the rest of the session.
 */
describe('catchLookupFailure', () => {
  const collect = <T>(source: { subscribe: (o: unknown) => unknown }): { values: T[]; errored: boolean } => {
    const seen = { values: [] as T[], errored: false };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (source as any).subscribe({
      next: (v: T) => seen.values.push(v),
      error: () => (seen.errored = true),
    });
    return seen;
  };

  it('passes a successful result through untouched', () => {
    const onFailure = (): void => {
      throw new Error('must not be called');
    };
    const seen = collect<string[]>(of(['a', 'b']).pipe(catchLookupFailure<string>(onFailure)));
    expect(seen.values).toEqual([['a', 'b']]);
  });

  it('substitutes an empty list for a failure rather than erroring', () => {
    const seen = collect<string[]>(throwError(new Error('down')).pipe(catchLookupFailure<string>(() => undefined)));
    expect(seen.values).toEqual([[]]);
    expect(seen.errored).toBe(false);
  });

  it('reports the failure, with the error, so a caller can tell it from an empty result', () => {
    const cause = new Error('503');
    let reported: unknown = 'not called';
    collect(throwError(cause).pipe(catchLookupFailure<string>((e) => (reported = e))));
    expect(reported).toBe(cause);
  });

  it('does not report anything when the lookup succeeds with no matches', () => {
    let called = false;
    const seen = collect<string[]>(of([]).pipe(catchLookupFailure<string>(() => (called = true))));
    expect(seen.values).toEqual([[]]);
    expect(called).toBe(false);
  });

  /**
   * The regression guard for the dead-autocomplete bug. Applied inside the
   * `switchMap` the fields use, a failed query must not take the pipeline with
   * it — the next keystroke has to still search.
   */
  it('keeps the surrounding pipeline alive, so a later query still runs', () => {
    const queries = new Subject<string>();
    const lookup = (q: string): Observable<string[]> =>
      q === 'boom' ? throwError(new Error('down')) : of([`hit:${q}`]);

    const seen = collect<string[]>(
      queries.pipe(switchMap((q) => lookup(q).pipe(catchLookupFailure<string>(() => undefined)))),
    );

    queries.next('one');
    queries.next('boom');
    queries.next('two');

    expect(seen.errored).toBe(false);
    expect(seen.values).toEqual([['hit:one'], [], ['hit:two']]);
  });
});
