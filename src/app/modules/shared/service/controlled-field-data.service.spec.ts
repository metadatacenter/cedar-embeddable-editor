import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, of } from 'rxjs';
import { ControlledFieldDataService } from './controlled-field-data.service';
import { MessageHandlerService } from './message-handler.service';
import { FieldComponent } from '../models/component/field-component.model';
import { narrowByQuery } from '../util/authority-narrowing';

describe('terminology alias matches reach the controlled-term picker', () => {
  afterEach(() => vi.useRealTimers());

  it.each(['PFOA', '335-67-1', 'DTXSID8031865'])('keeps the server result for %s', async (query) => {
    vi.useFakeTimers();
    const iri = 'https://comptox.epa.gov/dashboard/chemical/details/DTXSID8031865';
    const post = vi.fn(() =>
      of({ collection: [{ '@id': iri, prefLabel: 'Perfluorooctanoic acid', matchedSynonyms: [query] }] }),
    );
    const service = new ControlledFieldDataService({ post } as unknown as HttpClient, {} as MessageHandlerService);
    service.setIntegratedSearchUrl('https://terminology.example/bioportal/integrated-search');
    const field = {
      controlledInfo: { valueSets: [{ vsCollection: 'EX', uri: 'urn:example:method' }] },
    } as unknown as FieldComponent;
    const response = firstValueFrom(service.getData(query.toLowerCase(), field));
    await vi.runAllTimersAsync();
    const results = narrowByQuery(await response, query.toLowerCase());
    expect(results).toEqual([{ iri, label: 'Perfluorooctanoic acid', matchedNames: [query] }]);
    expect(post).toHaveBeenCalledOnce();
  });
});
