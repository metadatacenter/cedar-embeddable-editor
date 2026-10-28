import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { GlobalSettingsContextService } from './global-settings-context.service';
import { ResourceDescriptionService } from './resource-description.service';
import { ConstraintReference } from '../models/terminology-resource';

describe('resource descriptions on reopening', () => {
  const ref: ConstraintReference = {
    type: 'valueSet',
    sourceSystem: 'unknown-provider',
    sourceAcronym: 'FUTURE',
    sourceIri: 'urn:source:future',
    termBaseIri: 'urn:set:1',
    version: { id: 'pinned-hash' },
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
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(ref);
    const description = {
      constraint: ref,
      presentation: { href: 'https://future.example/one', label: 'Future registry', versionScope: 'current' },
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
      .expectOne((req) => req.body.version.id === 'pinned-hash')
      .flush({}, { status: 404, statusText: 'Version not held' });
    expect(service.describe(ref)).toBeNull();
    TestBed.inject(HttpTestingController).expectNone((req) => req.url.endsWith('/resources/description'));
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
