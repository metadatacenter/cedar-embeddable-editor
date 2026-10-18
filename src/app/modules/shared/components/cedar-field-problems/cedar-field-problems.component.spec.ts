import { Injector, runInInjectionContext } from '@angular/core';
import { CedarFieldProblemsComponent } from './cedar-field-problems.component';
import { FieldRevealService } from '../../service/field-reveal.service';
import { SingleFieldComponent } from '../../models/field/single-field-component.model';
import { HandlerContext } from '../../util/handler-context';
import { ValidationProblem } from '../../validation/validation-problem.model';

describe('field report notice visibility', () => {
  const setup = (code: string, inputType = 'radio') => {
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
    } as unknown as HandlerContext;
    return {
      component,
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
