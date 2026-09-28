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
  describe(`branch source links in the ${surface}`, () => {
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

    const render = async (source: string | undefined, acronym: string | undefined = 'EVS') => {
      const field = new SingleFieldComponent();
      field.basicInfo.inputType = InputType.controlled;
      field.controlledInfo.branches = [
        {
          name: 'Sampled Environmental Media',
          source,
          acronym,
          uri: 'https://purl.exposure.io/vocab/evs/EVS_0000016',
        },
      ];
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
