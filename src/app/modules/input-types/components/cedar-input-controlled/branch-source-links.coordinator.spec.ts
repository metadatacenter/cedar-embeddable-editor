import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { GlobalSettingsContextService } from '../../../shared/service/global-settings-context.service';
import { vi } from 'vitest';
import { ControlledInfo } from '../../../shared/models/info/controlled-info.model';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideTranslateService, TranslateService } from '@ngx-translate/core';
import { SharedModule } from '../../../shared/shared.module';
import { InputTypesModule } from '../../input-types.module';
import { SingleFieldComponent } from '../../../shared/models/field/single-field-component.model';
import { InputType } from '../../../shared/models/input-type.model';
import { UserPreferencesService } from '../../../shared/service/user-preferences.service';
import { HandlerContext } from '../../../shared/util/handler-context';
import { CedarSpecBoxComponent } from '../../../shared/components/cedar-spec-box/cedar-spec-box.component';
import { CedarInputControlledComponent } from './cedar-input-controlled.component';

// Compile both production templates: domain tests alone cannot detect a dropped anchor
// or a duplicated acronym in the rendered label.
for (const surface of ['spec box', 'controlled input'] as const) {
  describe(`terminology source links in the ${surface}`, () => {
    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [SharedModule, InputTypesModule],
        providers: [provideHttpClient(), provideHttpClientTesting(), provideTranslateService()],
      }).compileComponents();
      TestBed.inject(GlobalSettingsContextService).terminologyBaseUrl = 'https://terms.example/';
      TestBed.inject(UserPreferencesService).setReadOnlyMode(true);
      const translate = TestBed.inject(TranslateService);
      translate.setTranslation('en', { Spec: { TermKind: { branch: 'branch' }, TermIn: 'of the {{container}}' } });
      translate.use('en');
    });

    const declaredPages = new Map<string, string>();
    const answerDescriptions = () => {
      for (const request of TestBed.inject(HttpTestingController).match((req) =>
        req.url.endsWith('/resources/description'),
      )) {
        const p = request.request.body;
        const iri = p.termIri ?? p.termBaseIri ?? '';
        const acronym = p.sourceAcronym ?? '';
        const kind = p.type;
        const epa = p.sourceSystem === 'epa';
        const href =
          declaredPages.get(iri) ??
          (epa
            ? iri
            : 'https://bioportal.bioontology.org/ontologies/' +
              encodeURIComponent(acronym) +
              (['class', 'branch'].includes(kind ?? '') ? '?p=classes&conceptid=' + encodeURIComponent(iri) : ''));
        request.flush({
          constraint: p,
          presentation: {
            href,
            label: epa ? 'EPA' : 'BioPortal',
            versionScope: 'current',
            ...(epa ? {} : { icon: 'bioportal' }),
          },
        });
      }
    };

    const renderConstraints = async (constraints: Partial<ControlledInfo>) => {
      const field = new SingleFieldComponent();
      field.basicInfo.inputType = InputType.controlled;
      Object.assign(field.controlledInfo, constraints);
      const fixture =
        surface === 'spec box'
          ? TestBed.createComponent(CedarSpecBoxComponent)
          : TestBed.createComponent(CedarInputControlledComponent);
      if (fixture.componentInstance instanceof CedarSpecBoxComponent) {
        fixture.componentInstance.fieldToDescribe = field;
      } else {
        fixture.componentInstance.componentToRender = field;
        fixture.componentInstance.handlerContext = { statesSpecification: false } as HandlerContext;
      }
      fixture.detectChanges();
      answerDescriptions();
      await fixture.whenStable();
      fixture.detectChanges();
      return fixture.nativeElement as HTMLElement;
    };

    const render = (source: string | undefined, acronym: string | undefined = 'EVS') =>
      renderConstraints({
        branches: [
          {
            name: 'Sampled Environmental Media',
            source,
            acronym,
            uri: 'https://purl.exposure.io/vocab/evs/EVS_0000016',
          },
        ],
      });

    it.each([
      [
        'ontology',
        { ontologies: [{ name: 'Exposure Value Set (EVS)', acronym: 'EVS', uri: 'https://example.org/EVS' }] },
      ],
      [
        'value set',
        { valueSets: [{ name: 'Exposure Value Set (EVS)', vsCollection: 'EVS', uri: 'https://example.org/EVS' }] },
      ],
      ['class', { classes: [{ prefLabel: 'Exposure (EVS)', source: 'EVS', uri: 'https://example.org/term' }] }],
      [
        'value',
        { classes: [{ type: 'Value', label: 'Exposure (EVS)', source: 'EVS', uri: 'https://example.org/term' }] },
      ],
    ] satisfies [string, Partial<ControlledInfo>][])('states the acronym once for a %s', async (_kind, constraints) => {
      const root = await renderConstraints(constraints);
      const anchor = root.querySelector<HTMLAnchorElement>('a[href*="bioportal.bioontology.org"]');
      expect(anchor).not.toBeNull();
      expect(anchor!.textContent!.match(/\(EVS\)/g)).toHaveLength(1);
    });

    it.each([
      { branches: [{ name: '', uri: 'https://example.org/branch' }] },
      { ontologies: [{ name: '  ', uri: 'https://example.org/ontology' }] },
      { valueSets: [{ name: '', uri: 'https://example.org/value-set' }] },
      { classes: [{ prefLabel: '', label: 'Fallback label', uri: 'https://example.org/class' }] },
    ] satisfies Partial<ControlledInfo>[])('keeps a readable fallback for empty labels: %j', async (constraints) => {
      const root = await renderConstraints(constraints);
      expect(root.textContent).toContain(constraints.classes ? 'Fallback label' : 'https://example.org/');
      expect(root.querySelector('a[href*="bioportal.bioontology.org"]')).toBeNull();
    });

    it('renders every constraint with shared or absent URIs without duplicate tracking keys', async () => {
      const warn = vi.spyOn(console, 'warn');
      try {
        const root = await renderConstraints({
          branches: [{ name: 'Branch one', acronym: 'EVS', uri: 'https://example.org/shared' }],
          classes: [{ prefLabel: 'Class one', source: 'DOID', uri: 'https://example.org/shared' }],
          ontologies: [{ name: 'Ontology one', acronym: 'EVS' }],
          valueSets: [{ name: 'Value set one' }],
        });
        for (const name of ['Branch one', 'Class one', 'Ontology one', 'Value set one']) {
          expect(root.textContent).toContain(name);
        }
        expect(root.querySelectorAll('a[href*="bioportal.bioontology.org"]')).toHaveLength(3);
        expect(warn.mock.calls.flat().join(' ')).not.toContain('NG0955');
      } finally {
        warn.mockRestore();
      }
    });

    it.each(['Exposure Value Set (EVS)', 'Exposure Value Set', 'undefined (EVS)', undefined])(
      'keeps the link and states the acronym once for source %s',
      async (source) => {
        const root = await render(source);
        const anchor = root.querySelector<HTMLAnchorElement>('a[href*="bioportal.bioontology.org"]');
        expect(anchor).not.toBeNull();
        const url = new URL(anchor!.href);
        expect(url.pathname).toBe('/ontologies/EVS');
        expect(url.searchParams.get('conceptid')).toBe('https://purl.exposure.io/vocab/evs/EVS_0000016');
        expect(anchor!.target).toBe('_blank');
        expect(anchor!.rel).toContain('noopener');
        expect(anchor!.textContent).toContain('Sampled Environmental Media');
        expect(anchor!.textContent!.match(/\(EVS\)/g)).toHaveLength(1);
        expect(anchor!.textContent).not.toContain('undefined');
        if (source?.startsWith('Exposure')) expect(anchor!.textContent).toContain('Exposure Value Set');
      },
    );

    it('keeps the source name as plain text when the acronym is absent', async () => {
      const root = await render('Exposure Value Set', '');
      expect(root.querySelector('a[href*="bioportal.bioontology.org"]')).toBeNull();
      expect(root.textContent).toContain('Sampled Environmental Media');
      expect(root.textContent).toContain('Exposure Value Set');
    });

    it('links each of two selected EPA value sets to its own list page', async () => {
      const pages = [
        ['PFAS — EPA Method 533', 'https://cdxapps.epa.gov/oms-substance-registry-services/substance-list-details/477'],
        [
          'PFAS — EPA Method 537.1',
          'https://cdxapps.epa.gov/oms-substance-registry-services/substance-list-details/475',
        ],
      ];
      const root = await renderConstraints({
        valueSets: pages.map(([name, uri]) => ({
          sourceSystem: 'epa',
          vsCollection: 'EPA-PFAS',
          name,
          uri,
        })),
      });
      const links = [...root.querySelectorAll<HTMLAnchorElement>('a[href*="cdxapps.epa.gov"]')];
      expect(links).toHaveLength(2);
      for (const [index, [name, uri]] of pages.entries()) {
        expect(links[index].href).toBe(uri);
        expect(links[index].textContent).toContain(name);
        expect(links[index].target).toBe('_blank');
        expect(links[index].rel).toContain('noopener');
      }
      expect(root.querySelector('a[href*="bioportal.bioontology.org"]')).toBeNull();
    });

    it('renders an unknown provider using only the supplied descriptor, retaining two independent sets', async () => {
      declaredPages.set('urn:future:set:1', 'https://future.example/lists/one');
      declaredPages.set('urn:future:set:2', 'https://future.example/lists/two');
      const root = await renderConstraints({
        valueSets: [1, 2].map((id) => ({
          sourceSystem: 'unknown-future-provider',
          vsCollection: 'FUTURE',
          iri: 'urn:future:source',
          version: { id: 'exact-release' },
          uri: 'urn:future:set:' + id,
          name: 'Selected set ' + id,
        })),
      });
      expect([...root.querySelectorAll<HTMLAnchorElement>('a')].map((a) => a.href)).toEqual([
        'https://future.example/lists/one',
        'https://future.example/lists/two',
      ]);
      expect(root.textContent).toContain('Selected set 1');
      expect(root.textContent).toContain('Selected set 2');
    });

    if (surface === 'controlled input') {
      it.each([false, true])('links a selected chemical to CompTox (read-only=%s)', async (readOnly) => {
        TestBed.inject(UserPreferencesService).setReadOnlyMode(readOnly);
        const field = new SingleFieldComponent();
        field.basicInfo.inputType = InputType.controlled;
        field.controlledInfo.valueSets = [{ sourceSystem: 'epa', vsCollection: 'EPA-PFAS', name: 'Method 533' }];
        const fixture = TestBed.createComponent(CedarInputControlledComponent);
        fixture.componentInstance.componentToRender = field;
        fixture.componentInstance.handlerContext = { statesSpecification: false } as HandlerContext;
        fixture.detectChanges();
        const iri = 'https://comptox.epa.gov/dashboard/chemical/details/DTXSID8031865';
        fixture.componentInstance.setCurrentValue({ iri, label: 'Perfluorooctanoic acid' });
        fixture.detectChanges();
        answerDescriptions();
        await fixture.whenStable();
        fixture.detectChanges();
        const root = fixture.nativeElement as HTMLElement;
        const link = root.querySelector<HTMLAnchorElement>(`a[href="${iri}"]`);
        expect(link).not.toBeNull();
        expect(link!.target).toBe('_blank');
        expect(link!.rel).toContain('noopener');
        expect(root.querySelector('a[href*="bioportal.bioontology.org"]')).toBeNull();
      });
    }
  });
}
