import { ChangeDetectorRef, Injector, runInInjectionContext } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { requireFormArray } from '../../shared/forms/form-control';
import { FieldComponent } from '../../shared/models/component/field-component.model';
import { ChoiceOption } from '../../shared/models/info/choice-option.model';
import { InputType } from '../../shared/models/input-type.model';
import { Temporal } from '../../shared/models/temporal.model';
import { Xsd } from '../../shared/models/xsd.model';
import { ActiveComponentRegistryService } from '../../shared/service/active-component-registry.service';
import { ComponentDataService } from '../../shared/service/component-data.service';
import { ControlledFieldDataService } from '../../shared/service/controlled-field-data.service';
import { ExternalAuthorityLookupService } from '../../shared/service/external-authority-lookup.service';
import { HtmlDetectService } from '../../shared/service/html-detect.service';
import { MessageHandlerService } from '../../shared/service/message-handler.service';
import { UserPreferencesService } from '../../shared/service/user-preferences.service';
import { HandlerContext } from '../../shared/util/handler-context';
import { CedarInputAttributeValueComponent } from './cedar-input-attribute-value/cedar-input-attribute-value.component';
import { CedarInputCheckboxComponent } from './cedar-input-checkbox/cedar-input-checkbox.component';
import { CedarInputControlledComponent } from './cedar-input-controlled/cedar-input-controlled.component';
import { CedarInputDatetimeComponent } from './cedar-input-datetime/cedar-input-datetime.component';
import { CedarInputEmailComponent } from './cedar-input-email/cedar-input-email.component';
import { CedarInputLinkComponent } from './cedar-input-link/cedar-input-link.component';
import { CedarInputMultipleChoiceComponent } from './cedar-input-multiple-choice/cedar-input-multiple-choice.component';
import { CedarInputNumericComponent } from './cedar-input-numeric/cedar-input-numeric.component';
import { CedarInputOrcidComponent } from './cedar-input-orcid/cedar-input-orcid.component';
import { CedarInputPhoneComponent } from './cedar-input-phone/cedar-input-phone.component';
import { CedarInputSelectComponent } from './cedar-input-select/cedar-input-select.component';
import { CedarInputTextComponent } from './cedar-input-text/cedar-input-text.component';

/**
 * A widget shown one occurrence and then another shows the second, and nothing
 * of the first.
 *
 * The same widget instance is reused as a repeating field pages between its
 * occurrences: the registry hands it the next occurrence's value through
 * `setCurrentValue`, and everything the widget derived from the last one has to
 * go with it. Two of the September audit's thirteen defects sat here — a
 * temporal widget keeping stale parts over a value it could not read, a select
 * restoring a selection that had been cleared — and the text widget kept a
 * third: its identifier flag was raised by an ORCID and never lowered, so the
 * plain text on the next page rendered as a link to the previous page's ORCID.
 *
 * Stated once, generically: a widget shown A and then B is indistinguishable
 * from a widget shown B alone. Each entry says what its widget shows, and the
 * one assertion compares the two.
 */
interface PagedWidget {
  name: string;
  readOnly?: boolean;
  first: unknown;
  second: unknown;
  build: (readOnly: boolean) => Shown;
}

/** A built widget, and what it shows. */
interface Shown {
  show: (value: unknown) => void;
  shown: () => unknown;
}

const registry = (): ActiveComponentRegistryService =>
  ({ registerComponent: vi.fn(), unregisterComponent: vi.fn() }) as unknown as ActiveComponentRegistryService;

const inject = <T>(readOnly: boolean, build: () => T): T => {
  const preferences = new UserPreferencesService();
  preferences.setReadOnlyMode(readOnly);
  const injector = Injector.create({
    providers: [
      { provide: ActiveComponentRegistryService, useValue: registry() },
      { provide: UserPreferencesService, useValue: preferences },
      { provide: ChangeDetectorRef, useValue: { markForCheck: vi.fn(), detectChanges: vi.fn() } },
    ],
  });
  return runInInjectionContext(injector, build);
};

const field = (inputType: string, extra: Record<string, unknown> = {}): FieldComponent =>
  ({
    path: ['field'],
    name: 'field',
    basicInfo: { inputType, temporalGranularity: Temporal.minute, timezoneEnabled: false },
    valueInfo: { requiredValue: false, minLength: null, maxLength: null, regex: null, temporalType: Xsd.dateTime },
    numberInfo: { numberType: null, decimalPlace: null, minValue: null, maxValue: null, unitOfMeasure: null },
    choiceInfo: { multipleChoice: false, choices: [new ChoiceOption('A', false), new ChoiceOption('B', false)] },
    multiInfo: { maxItems: null },
    controlledInfo: { ontologies: [], valueSets: [], classes: [], branches: [] },
    ...extra,
  }) as unknown as FieldComponent;

/** A model that takes every write and holds nothing. */
const context = (): HandlerContext =>
  ({
    changeValue: vi.fn(),
    changeListValue: vi.fn(),
    changeControlledValue: vi.fn(),
    changeAttributeValue: vi.fn(() => null),
    getDataObjectNodeByPath: () => null,
  }) as unknown as HandlerContext;

const ORCID = 'https://orcid.org/0000-0002-1825-0097';
const ROR = 'https://ror.org/00f54p054';
const TERM_A = { iri: 'http://purl.obolibrary.org/obo/DOID_162', label: 'cancer' };
const TERM_B = { iri: 'http://purl.obolibrary.org/obo/DOID_4', label: 'disease' };

const text = (readOnly: boolean): Shown => {
  const widget = inject(
    readOnly,
    () =>
      new CedarInputTextComponent(new FormBuilder(), {} as ComponentDataService, registry(), new HtmlDetectService()),
  );
  widget.componentToRender = field(InputType.text);
  widget.handlerContext = context();
  widget.ngOnInit();
  return {
    show: (value) => widget.setCurrentValue(value),
    shown: () => ({
      value: widget.inputValueControl.value,
      isOrcid: widget.isOrcid,
      isRor: widget.isRor,
      originalValue: widget.originalValue,
      isRichText: widget.isRichText,
    }),
  };
};

const radio = (readOnly: boolean): Shown => {
  const widget = inject(readOnly, () => new CedarInputMultipleChoiceComponent(new FormBuilder(), registry()));
  widget.componentToRender = field(InputType.radio);
  widget.handlerContext = context();
  widget.ngOnInit();
  return {
    show: (value) => widget.setCurrentValue(value),
    shown: () => ({ value: widget.selectedChoiceInputControl.value, selected: widget.selected }),
  };
};

const select =
  (multipleChoice: boolean) =>
  (readOnly: boolean): Shown => {
    const widget = inject(
      readOnly,
      () => new CedarInputSelectComponent(registry(), {} as ComponentDataService, new FormBuilder()),
    );
    widget.componentToRender = field(InputType.list, {
      choiceInfo: {
        multipleChoice,
        choices: [new ChoiceOption('A', false), new ChoiceOption('B', false), new ChoiceOption('C', false)],
      },
    });
    widget.handlerContext = context();
    widget.ngOnInit();
    return {
      show: (value) => widget.setCurrentValue(value),
      shown: () => ({ value: widget.inputValueControl.value, selections: widget.selections }),
    };
  };

const controlled = (readOnly: boolean): Shown => {
  const widget = inject(
    readOnly,
    () =>
      new CedarInputControlledComponent(
        new FormBuilder(),
        {} as ComponentDataService,
        registry(),
        { getData: () => of([]) } as unknown as ControlledFieldDataService,
        {} as MessageHandlerService,
      ),
  );
  widget.componentToRender = field(InputType.controlled);
  widget.handlerContext = context();
  widget.ngOnInit();
  return {
    show: (value) => widget.setCurrentValue(value),
    shown: () => ({
      value: widget.inputValueControl.value,
      selectedData: widget.selectedData,
      showsTermAsValue: widget.showsTermAsValue,
      hasQuery: widget.hasQuery,
    }),
  };
};

const authority = (readOnly: boolean): Shown => {
  const widget = inject(
    readOnly,
    () =>
      new CedarInputOrcidComponent(
        new FormBuilder(),
        {} as ComponentDataService,
        registry(),
        {} as ExternalAuthorityLookupService,
      ),
  );
  widget.componentToRender = field(InputType.orcid);
  widget.handlerContext = context();
  widget.ngOnInit();
  return {
    show: (value) => widget.setCurrentValue(value as never),
    shown: () => ({
      value: widget.inputValueControl.value,
      selectedData: widget.selectedData,
      detailsUrl: widget.detailsUrl,
      isEmpty: widget.isEmpty,
      showsSelectedTerm: widget.showsSelectedTerm,
      showsTermAsValue: widget.showsTermAsValue,
    }),
  };
};

const datetime = (readOnly: boolean): Shown => {
  const widget = inject(readOnly, () => new CedarInputDatetimeComponent(new FormBuilder(), registry()));
  widget.componentToRender = field(InputType.temporal);
  widget.handlerContext = context();
  widget.ngOnInit();
  return {
    show: (value) => widget.setCurrentValue(value),
    shown: () => ({
      date: widget.dateMonthYearControl.value?.getTime() ?? null,
      time:
        widget.timePickerTime === null
          ? null
          : [widget.timePickerTime.getHours(), widget.timePickerTime.getMinutes(), widget.timePickerTime.getSeconds()],
      decimalSeconds: widget.decimalSeconds,
      timezone: widget.timezone,
      unreadableValue: widget.unreadableValue,
      message: widget.showsValidationMessage,
      held: widget.valueControl.value,
    }),
  };
};

const WIDGETS: PagedWidget[] = [
  { name: 'a text field, an ORCID then plain text', readOnly: true, first: ORCID, second: 'plain text', build: text },
  { name: 'a text field, a ROR then plain text', readOnly: true, first: ROR, second: 'plain text', build: text },
  { name: 'a text field, markup then plain text', readOnly: true, first: '<b>bold</b>', second: 'plain', build: text },
  { name: 'a text field, an ORCID then nothing', readOnly: true, first: ORCID, second: null, build: text },
  { name: 'an editable text field', first: 'one', second: 'two', build: text },
  {
    name: 'a numeric field',
    first: '1',
    second: '2',
    build: (readOnly) => {
      const widget = inject(
        readOnly,
        () =>
          new CedarInputNumericComponent(new FormBuilder(), {} as ComponentDataService, registry(), {
            instant: () => '',
          } as unknown as TranslateService),
      );
      widget.componentToRender = field(InputType.numeric);
      widget.handlerContext = context();
      widget.ngOnInit();
      return {
        show: (value) => widget.setCurrentValue(value),
        shown: () => ({ value: widget.inputValueControl.value }),
      };
    },
  },
  {
    name: 'a link field',
    first: 'https://example.org/one',
    second: 'https://example.org/two',
    build: (readOnly) => {
      const widget = inject(
        readOnly,
        () => new CedarInputLinkComponent(new FormBuilder(), {} as ComponentDataService, registry()),
      );
      widget.componentToRender = field(InputType.link);
      widget.handlerContext = context();
      widget.ngOnInit();
      return {
        show: (value) => widget.setCurrentValue(value),
        shown: () => ({ value: widget.inputValueControl.value, showsLinkAsValue: widget.showsLinkAsValue }),
      };
    },
  },
  {
    name: 'an email field',
    first: 'one@example.org',
    second: 'two@example.org',
    build: (readOnly) => {
      const widget = inject(
        readOnly,
        () => new CedarInputEmailComponent(new FormBuilder(), {} as ComponentDataService, registry()),
      );
      widget.componentToRender = field(InputType.email);
      widget.handlerContext = context();
      widget.ngOnInit();
      return {
        show: (value) => widget.setCurrentValue(value),
        shown: () => ({ value: widget.inputValueControl.value }),
      };
    },
  },
  {
    name: 'a phone field',
    first: '+1 650 555 0100',
    second: '+1 650 555 0199',
    build: (readOnly) => {
      const widget = inject(
        readOnly,
        () => new CedarInputPhoneComponent(new FormBuilder(), {} as ComponentDataService, registry()),
      );
      widget.componentToRender = field(InputType.phoneNumber);
      widget.handlerContext = context();
      widget.ngOnInit();
      return {
        show: (value) => widget.setCurrentValue(value),
        shown: () => ({ value: widget.inputValueControl.value }),
      };
    },
  },
  { name: 'a radio group', first: 'A', second: 'B', build: radio },
  { name: 'a radio group, then nothing', first: 'A', second: null, build: radio },
  { name: 'a single-choice select', first: 'A', second: 'B', build: select(false) },
  { name: 'a multiple-choice select', first: ['A', 'B'], second: ['C'], build: select(true) },
  { name: 'a multiple-choice select, then nothing', first: ['A', 'B'], second: [], build: select(true) },
  {
    name: 'a checkbox group',
    first: ['B'],
    second: ['A'],
    build: (readOnly) => {
      const widget = inject(readOnly, () => new CedarInputCheckboxComponent(new FormBuilder(), registry()));
      widget.componentToRender = field(InputType.checkbox, {
        choiceInfo: { multipleChoice: true, choices: [new ChoiceOption('A', false), new ChoiceOption('B', false)] },
      });
      widget.handlerContext = context();
      widget.ngOnInit();
      return {
        show: (value) => widget.setCurrentValue(value),
        shown: () => ({
          ticked: widget.component.choiceInfo.choices.map((choice) => choice.label).filter((l) => widget.isChecked(l)),
          listed: requireFormArray(widget.options, 'checkedChoices').value,
        }),
      };
    },
  },
  { name: 'a controlled term', first: TERM_A, second: TERM_B, build: controlled },
  { name: 'a controlled term, then nothing', first: TERM_A, second: null, build: controlled },
  { name: 'a read-only controlled term, then nothing', readOnly: true, first: TERM_A, second: null, build: controlled },
  { name: 'an external authority', first: TERM_A, second: TERM_B, build: authority },
  { name: 'an external authority, then nothing', first: TERM_A, second: null, build: authority },
  {
    name: 'an attribute value',
    first: { colour: 'blue' },
    second: { size: 'large' },
    build: (readOnly) => {
      const widget = inject(readOnly, () => new CedarInputAttributeValueComponent(new FormBuilder(), registry()));
      widget.componentToRender = field(InputType.attributeValue);
      widget.handlerContext = context();
      widget.ngOnInit();
      return {
        show: (value) => widget.setCurrentValue(value),
        shown: () => ({
          name: widget.nameInputControl.value,
          value: widget.valueInputControl.value,
          error: widget.attributeNameError,
          nameErrors: widget.nameInputControl.errors,
        }),
      };
    },
  },
  { name: 'a temporal field', first: '2026-08-20T14:30:00', second: '2027-01-02T03:04:00', build: datetime },
  {
    name: 'a temporal field, then one it cannot read',
    first: '2026-08-20T14:30:00',
    second: '2021-06-06',
    build: datetime,
  },
  { name: 'a temporal field, then nothing', first: '2026-08-20T14:30:00', second: null, build: datetime },
];

describe('a widget shown two occurrences in turn shows only the second', () => {
  for (const subject of WIDGETS) {
    it(`for ${subject.name}`, () => {
      const readOnly = subject.readOnly ?? false;
      const paged = subject.build(readOnly);
      paged.show(subject.first);
      paged.show(subject.second);

      const fresh = subject.build(readOnly);
      fresh.show(subject.second);

      expect(paged.shown()).toEqual(fresh.shown());
    });
  }
});
