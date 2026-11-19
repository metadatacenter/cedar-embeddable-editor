import { Injector, runInInjectionContext } from '@angular/core';
import { InstanceDataStringAtom } from 'cedar-model-typescript-library';
import { CedarFieldProblemsComponent } from './cedar-field-problems.component';
import { FieldRevealService } from '../../service/field-reveal.service';
import { SingleFieldComponent } from '../../models/field/single-field-component.model';
import { MultiFieldComponent } from '../../models/field/multi-field-component.model';
import { AbstractFieldComponent } from '../../models/field/abstract-field-component.model';
import { MultiElementComponent } from '../../models/element/multi-element-component.model';
import { CedarTemplate } from '../../models/template/cedar-template.model';
import { CedarComponent } from '../../models/component/cedar-component.model';
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

  describe('in a repeating element', () => {
    /**
     * `answer` inside the repeating element `_rows`, whose pager is on its second entry. A
     * repeating `answer` pages too, and is on its third.
     */
    const inRows = (answer: AbstractFieldComponent, ...problems: ValidationProblem[]) => {
      const revealedAt: (readonly number[])[] = [];
      const injector = Injector.create({
        providers: [
          {
            provide: FieldRevealService,
            useValue: {
              wasRevealed: (_path: readonly string[], occurrences: readonly number[]) => {
                revealedAt.push([...occurrences]);
                return true;
              },
            },
          },
        ],
      });
      const component = runInInjectionContext(injector, () => new CedarFieldProblemsComponent());
      const rows = new MultiElementComponent();
      rows.name = '_rows';
      rows.path = ['_rows'];
      answer.name = 'answer';
      answer.path = ['_rows', 'answer'];
      rows.children = [answer];
      const template = new CedarTemplate();
      template.children = [rows];
      const onScreen = new Map<CedarComponent, number>([
        [rows, 1],
        [answer, 2],
      ]);
      component.componentToShow = answer;
      component.handlerContext = {
        readOnlyMode: false,
        dataContext: { templateRepresentation: template, dataQualityReport: { problems } },
        validation: { draftFor: () => null },
        multiInstanceObjectService: {
          getMultiInstanceInfoForComponent: (shown: CedarComponent) =>
            onScreen.has(shown) ? { currentIndex: onScreen.get(shown) } : null,
        },
        getDataObjectNodeByPath: () => null,
      } as unknown as HandlerContext;
      return { component, revealedAt };
    };
    const problem = (code: string, value: string | null, occurrences: number[]) =>
      new ValidationProblem(['_rows', 'answer'], 'answer', 'textfield', code, 'Diagnostic', value, occurrences);

    it('shows a problem only in the entry it names', () => {
      const { component } = inRows(
        new SingleFieldComponent(),
        problem('choiceMembership', 'In the first row', [0]),
        problem('choiceMembership', 'In this row', [1]),
        problem('choiceMembership', 'In the third row', [2]),
      );

      expect(component.notices.map((notice) => notice.params)).toEqual([{ value: 'In this row' }]);
    });

    it('shows a problem with a repeating field only in the entry on screen at each level', () => {
      const { component } = inRows(
        new MultiFieldComponent(),
        problem('choiceMembership', 'Another row', [0, 2]),
        problem('choiceMembership', 'Another entry', [1, 0]),
        problem('choiceMembership', 'On screen', [1, 2]),
      );

      expect(component.notices.map((notice) => notice.params)).toEqual([{ value: 'On screen' }]);
    });

    it('locates a problem about the whole list by the element entry that holds it', () => {
      const field = new MultiFieldComponent();
      field.multiInfo.maxItems = 2;
      expect(inRows(field, problem('maxItems', null, [1])).component.notices).toEqual([
        expect.objectContaining({ params: { max: 2 } }),
      ]);
      expect(inRows(field, problem('maxItems', null, [0])).component.notices).toEqual([]);
      expect(inRows(field, problem('maxItems', null, [1, 2])).component.notices).toEqual([]);
    });

    it('asks whether the user was taken to an incomplete list in the element entry that holds it', () => {
      const field = new MultiFieldComponent();
      field.multiInfo.minItems = 3;
      const { component, revealedAt } = inRows(field, problem('minItems', null, [1]));

      expect(component.notices).toEqual([expect.objectContaining({ params: { min: 3 }, category: 'completeness' })]);
      expect(revealedAt).toEqual([[1]]);
    });
  });
});
