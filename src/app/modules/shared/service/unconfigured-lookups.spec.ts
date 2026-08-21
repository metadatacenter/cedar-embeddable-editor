/**
 * What the two lookups do when the host named no server.
 *
 * Both keys that identify a CEDAR service — `terminologyBaseUrl` and
 * `bridgeBaseUrl` — lost or never had a default, because CEE cannot know which
 * deployment it is embedded in and every candidate default is wrong somewhere.
 * That makes "not configured" an ordinary state rather than a mistake, and it has
 * to be a *legible* one: a form of authority fields that quietly find nothing
 * looks exactly like a form of authority fields whose terms nobody has.
 *
 * The two used to answer it differently. Controlled-term search returned an empty
 * result in silence; an authority field threw, once per keystroke. Neither told a
 * host which key was missing. They answer the same way here.
 */
import { type Mock, vi } from 'vitest';
import { firstValueFrom, Observable } from 'rxjs';
import { defaultIfEmpty } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { ControlledFieldDataService } from './controlled-field-data.service';
import { ExternalAuthorityLookupService } from './external-authority-lookup.service';
import { MessageHandlerService } from './message-handler.service';
import { InputType } from '../models/input-type.model';
import { FieldComponent } from '../models/component/field-component.model';

/**
 * An HTTP client that fails the test if anything reaches it.
 *
 * The point of the off state is that no request is made. Were a base of `''`
 * concatenated instead, every endpoint would become a relative URL resolved
 * against the embedding page — which is a live request to the host's own origin,
 * per keystroke, and the thing this guards against.
 */
const forbiddenHttp = (): HttpClient =>
  ({
    get: (): never => {
      throw new Error('an unconfigured lookup made an HTTP request');
    },
    post: (): never => {
      throw new Error('an unconfigured lookup made an HTTP request');
    },
  }) as unknown as HttpClient;

const messaging = (): { service: MessageHandlerService; errors: Mock } => {
  const errors = vi.fn();
  return { service: { error: errors } as unknown as MessageHandlerService, errors };
};

/** What the host was told, as one string. */
const reported = (errors: Mock): string => errors.mock.calls.map(([message]) => String(message)).join('\n');

/**
 * What a lookup answered, or `SILENCE` if it completed without emitting.
 *
 * An unconfigured lookup returns `EMPTY`, which is not the same as an empty
 * result: nothing is emitted at all, so the autocomplete's option list keeps
 * whatever it had and its spinner clears through `finalize`. Naming the
 * difference here keeps the assertions about behaviour rather than about a
 * value that never arrives.
 */
const SILENCE = Symbol('completed without emitting');
const answered = <T>(observable: Observable<T>): Promise<T | typeof SILENCE> =>
  firstValueFrom(observable.pipe(defaultIfEmpty<T, typeof SILENCE>(SILENCE)));

describe('controlled-term search with no terminology server', () => {
  const field = (): FieldComponent =>
    ({ controlledInfo: { branches: [], classes: [], ontologies: [], valueSets: [] } }) as unknown as FieldComponent;

  it('offers no terms and names the key that would turn it on', async () => {
    const { service, errors } = messaging();
    const lookup = new ControlledFieldDataService(forbiddenHttp(), service);

    expect(await answered(lookup.getData('lung', field()))).toBe(SILENCE);
    expect(reported(errors)).toContain('"terminologyBaseUrl" is not configured');
  });

  /**
   * Once per editor, not once per keystroke.
   *
   * A form of controlled fields would otherwise report this on every character
   * typed into any of them, which buries the one message that matters under
   * hundreds of copies of itself.
   */
  it('says so once, however many times it is asked', async () => {
    const { service, errors } = messaging();
    const lookup = new ControlledFieldDataService(forbiddenHttp(), service);

    await answered(lookup.getData('lung', field()));
    await answered(lookup.getData('lungs', field()));
    await answered(lookup.getData('pulmonary', field()));

    expect(errors).toHaveBeenCalledTimes(1);
  });
});

describe('external authority lookups with no bridge server', () => {
  it('offers no terms and names the key that would turn them on', async () => {
    const { service, errors } = messaging();
    const lookup = new ExternalAuthorityLookupService(forbiddenHttp(), service);

    expect(await answered(lookup.search(InputType.orcid, 'curie'))).toBe(SILENCE);
    expect(reported(errors)).toContain('"bridgeBaseUrl" is not configured');
  });

  /**
   * The field's own type, so the message says which of the seven went quiet.
   *
   * Inherited from the exception this replaces, which named the input type and
   * was the one useful thing about it.
   */
  it('names the field that asked', async () => {
    const { service, errors } = messaging();
    const lookup = new ExternalAuthorityLookupService(forbiddenHttp(), service);

    await answered(lookup.search(InputType.ror, 'stanford'));

    expect(reported(errors)).toContain(InputType.ror);
  });

  /**
   * Resolving an identifier goes quiet too, rather than throwing.
   *
   * The widget resolves rather than searches whenever the text looks like an
   * identifier, so a pasted ORCID took the other path — and that path threw where
   * this one returned nothing, from the same missing key.
   */
  it('resolves nothing, and does not throw', async () => {
    const { service, errors } = messaging();
    const lookup = new ExternalAuthorityLookupService(forbiddenHttp(), service);

    expect(await answered(lookup.resolve(InputType.orcid, '0000-0002-1825-0097'))).toBe(SILENCE);
    expect(errors).toHaveBeenCalledTimes(1);
  });

  it('says so once, however many fields ask', async () => {
    const { service, errors } = messaging();
    const lookup = new ExternalAuthorityLookupService(forbiddenHttp(), service);

    await answered(lookup.search(InputType.orcid, 'curie'));
    await answered(lookup.search(InputType.doi, '10.1000'));
    await answered(lookup.resolve(InputType.rrid, 'RRID:1234'));

    expect(errors).toHaveBeenCalledTimes(1);
  });
});
