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
        providers: [provideHttpClient(), provideTranslateService()],
      }).compileComponents();
      TestBed.inject(UserPreferencesService).setReadOnlyMode(true);
      const translate = TestBed.inject(TranslateService);
      translate.setTranslation('en', { Spec: { TermKind: { branch: 'branch' }, TermIn: 'of the {{container}}' } });
      translate.use('en');
    });

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
      await fixture.whenStable();
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
  });
}
