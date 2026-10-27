import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { GlobalSettingsContextService } from './global-settings-context.service';
import { ResourceDescriptionService } from './resource-description.service';
import { ResourceReference } from '../models/terminology-resource';

describe('resource descriptions on reopening', () => {
  const ref: ResourceReference = {
    kind: 'valueSet',
    sourceSystem: 'unknown-provider',
    sourceAcronym: 'FUTURE',
    sourceIri: 'urn:source:future',
    resourceIri: 'urn:set:1',
    versionId: 'pinned-hash',
  };

  beforeEach(() => TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] }));
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('renders without a request when the host has no terminology endpoint', () => {
    expect(TestBed.inject(ResourceDescriptionService).describe(ref)).toBeNull();
  });

  it('coalesces the same reference, preserves the pin, and reuses the returned description', () => {
    TestBed.inject(GlobalSettingsContextService).terminologyBaseUrl = 'https://terms.example/';
    const service = TestBed.inject(ResourceDescriptionService);
    expect(service.describe(ref)).toBeNull();
    expect(service.describe(ref)).toBeNull();
    const request = TestBed.inject(HttpTestingController).expectOne((req) =>
      req.url.endsWith('/resources/description'),
    );
    expect(request.request.params.get('versionId')).toBe('pinned-hash');
    expect(request.request.params.get('sourceIri')).toBe('urn:source:future');
    const description = {
      ref,
      label: 'The upstream label',
      status: 'available',
      capabilities: ['members'],
      links: [
        { rel: 'landing', href: 'https://future.example/one', label: 'Future registry', versionScope: 'current' },
      ],
    };
    request.flush(description);
    expect(service.describe(ref)).toEqual(description);
    TestBed.inject(HttpTestingController).expectNone((req) => req.url.endsWith('/resources/description'));
  });

  it('keeps a missing version unavailable and never issues a request for latest', () => {
    TestBed.inject(GlobalSettingsContextService).terminologyBaseUrl = 'https://terms.example/';
    const service = TestBed.inject(ResourceDescriptionService);
    service.describe(ref);
    TestBed.inject(HttpTestingController)
      .expectOne((req) => req.params.get('versionId') === 'pinned-hash')
      .flush({ ref, status: 'unavailable', reason: 'versionNotHeld', links: [], capabilities: [] });
    expect(service.describe(ref)?.reason).toBe('versionNotHeld');
  });

  it('tolerates a failed lookup without a request loop', () => {
    TestBed.inject(GlobalSettingsContextService).terminologyBaseUrl = 'https://terms.example/';
    const service = TestBed.inject(ResourceDescriptionService);
    service.describe(ref);
    TestBed.inject(HttpTestingController)
      .expectOne((req) => req.url.endsWith('/resources/description'))
      .flush({}, { status: 503, statusText: 'Unavailable' });
    expect(service.describe(ref)).toBeNull();
  });
});
