import { Injector, runInInjectionContext } from '@angular/core';
import { InstanceDataStringAtom } from 'cedar-model-typescript-library';
import { CedarFieldProblemsComponent } from './cedar-field-problems.component';
import { FieldRevealService } from '../../service/field-reveal.service';
import { SingleFieldComponent } from '../../models/field/single-field-component.model';
import { HandlerContext } from '../../util/handler-context';
import { ValidationProblem } from '../../validation/validation-problem.model';
import { LABEL_SLOT } from '../../a11y/joined-name';

describe('field report notice visibility', () => {
  const setup = (code: string, inputType = 'radio', stored: InstanceDataStringAtom | null = null) => {
    let revealed = false;
    const injector = Injector.create({
      providers: [{ provide: FieldRevealService, useValue: { wasRevealed: () => revealed } }],
    });
    const component = runInInjectionContext(injector, () => new CedarFieldProblemsComponent());
    const field = new SingleFieldComponent();
    field.path = ['answer'];
    component.componentToShow = field;
    component.handlerContext = {
      readOnlyMode: false,
      dataContext: {
        templateRepresentation: null,
        dataQualityReport: {
          problems: [new ValidationProblem(['answer'], 'answer', inputType, code, 'Diagnostic', 'Maybe')],
        },
      },
      validation: { draftFor: () => null },
      multiInstanceObjectService: {},
      getDataObjectNodeByPath: () => stored,
    } as unknown as HandlerContext;
    return {
      component,
      field,
      reveal: () => {
        revealed = true;
      },
    };
  };

  it('shows a populated invalid choice immediately even though it is saveable quality', () => {
    const { component } = setup('choiceMembership');
    expect(component.notices).toEqual([
      {
        key: 'Validation.Report.ChoiceMembership',
        params: { value: 'Maybe' },
        severity: 'warning',
        category: 'constraint',
      },
    ]);
  });

  describe('a quoted stored value', () => {
    const tagged = (language: string | null): InstanceDataStringAtom =>
      Object.assign(new InstanceDataStringAtom('Maybe'), { language });

    it('is marked with the tag the stored value carries', () => {
      const { component, field } = setup('choiceMembership', 'radio', tagged('de'));
      field.basicInfo.valueLanguage = 'fr';

      expect(component.notices[0].quoted).toEqual({
        text: 'Maybe',
        language: 'de',
        params: { value: LABEL_SLOT },
      });
    });

    it('is marked with the language its field declares where the value carries no tag', () => {
      const { component, field } = setup('choiceMembership', 'radio', tagged(null));
      field.basicInfo.valueLanguage = 'fr_CA';

      expect(component.notices[0].quoted?.language).toBe('fr-CA');
    });

    it('is not split from the sentence where neither states a language', () => {
      const { component } = setup('choiceMembership', 'radio', tagged('not a tag'));

      expect(component.notices[0].quoted).toBeUndefined();
    });

    it("finds CEE's words on either side of it in the translation", () => {
      const { component } = setup('choiceMembership');

      expect(component.split(`„${LABEL_SLOT}” nem szerepel a mező választási lehetőségei között.`)).toEqual({
        before: '„',
        after: '” nem szerepel a mező választási lehetőségei között.',
        labelled: true,
      });
    });
  });

  it('keeps incomplete entries quiet until revealed and all notices absent in read-only mode', () => {
    const { component, reveal } = setup('minItems');
    expect(component.notices).toEqual([]);
    reveal();
    expect(component.notices).toEqual([expect.objectContaining({ severity: 'warning', category: 'completeness' })]);
    component.handlerContext.readOnlyMode = true;
    expect(component.notices).toEqual([]);
  });

  it('leaves malformed links to the URL input while retaining malformed authority notices', () => {
    expect(setup('iriMalformed', 'link').component.notices).toEqual([]);
    expect(setup('iriMalformed', 'ext-orcid').component.notices).toEqual([
      expect.objectContaining({ severity: 'error', category: 'structural' }),
    ]);
  });

  it('keeps unchecked semantic status in the report without decorating ordinary fields', () => {
    expect(setup('semanticNotChecked', 'controlled').component.notices).toEqual([]);
    expect(setup('semanticUnavailable', 'controlled').component.notices).toEqual([]);
  });
});
