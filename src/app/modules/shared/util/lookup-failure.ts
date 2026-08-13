import { MonoTypeOperatorFunction, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

/**
 * Turn a failed authority or terminology lookup into an empty result list, and
 * tell the caller it happened.
 *
 * Every search field in CEE ends a failed lookup as an empty list, because an
 * autocomplete has nothing else to show. The problem was never that conversion;
 * it was that the conversion threw away the only fact that distinguishes "the
 * service is down" from "nothing matched". Both then rendered as "No results
 * found" — a statement about the query, made when nothing had been learned about
 * the query.
 *
 * `onFailure` is how the fact survives. Callers set a flag their template reads,
 * so the panel can say which of the two happened.
 *
 * The other half matters just as much and is easy to miss: a lookup error that
 * reaches a `valueChanges` pipeline *ends* it, and an ended pipeline does not
 * restart. The controlled-terms field had no catch at all, so one failing
 * request stopped its autocomplete for the rest of the session and only a reload
 * brought it back. Applied inside a `switchMap`, this keeps the failure inside
 * the one query it belongs to.
 */
export const catchLookupFailure = <T>(onFailure: (error: unknown) => void): MonoTypeOperatorFunction<T[]> =>
  catchError((error: unknown) => {
    onFailure(error);
    return of<T[]>([]);
  });
