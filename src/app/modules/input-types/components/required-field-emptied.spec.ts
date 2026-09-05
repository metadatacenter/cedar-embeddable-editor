import { ChangeDetectorRef, Injector, runInInjectionContext } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
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
 * A required field emptied by the user says so.
 *
 * Every widget installs `Validators.required` when the template asks for a
 * value, and every one offers a way to take a value out again. The two have to
 * meet: the moment the last value goes, the control has to report the
 * requirement, or the notice each template hangs on that report stays dark. The
 * external authority widgets did not meet it. Their clear action wiped the
 * control's errors after emptying it — a leftover from a validator that no
 * longer sits on the control — so a required ORCID field emptied by backspacing
 * reported itself satisfied over nothing, and said nothing.
 *
 * One table, because the requirement is one and the widgets are copies of each
 * other. Each entry gives its widget a value, empties it the way a user does,
 * and answers whether the widget now reports the requirement.
 */
interface RequiredField {
  name: string;
  /** Fill, empty, and say whether the requirement is reported. */
  emptied: () => boolean;
}

const registry = (): ActiveComponentRegistryService =>
  ({ registerComponent: vi.fn(), unregisterComponent: vi.fn() }) as unknown as ActiveComponentRegistryService;

const inject = <T>(build: () => T): T => {
  const injector = Injector.create({
    providers: [
      { provide: ActiveComponentRegistryService, useValue: registry() },
      { provide: UserPreferencesService, useValue: { readOnlyMode$: of(false) } },
      { provide: ChangeDetectorRef, useValue: { markForCheck: vi.fn(), detectChanges: vi.fn() } },
    ],
  });
  return runInInjectionContext(injector, build);
};

/** A field the template requires an answer to. */
const required = (inputType: string, extra: Record<string, unknown> = {}): FieldComponent =>
  ({
    path: ['field'],
    name: 'field',
    basicInfo: { inputType, temporalGranularity: Temporal.minute, timezoneEnabled: false },
    valueInfo: { requiredValue: true, minLength: null, maxLength: null, regex: null, temporalType: Xsd.dateTime },
    numberInfo: { numberType: null, decimalPlace: null, minValue: null, maxValue: null, unitOfMeasure: null },
    choiceInfo: { multipleChoice: false, choices: [new ChoiceOption('A', false), new ChoiceOption('B', false)] },
    multiInfo: { maxItems: null },
    controlledInfo: {},
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

/** The one event a text-like widget reads: an input whose box is now empty. */
const emptiedBox = (): Event => ({ target: { value: '' } }) as unknown as Event;

const TERM = { iri: 'https://orcid.org/0000-0002-1825-0097', label: 'Josiah Carberry' };
/** What Material says about a suggestion the user picked. */
const chosen = { isUserInput: true };

const authority = (): CedarInputOrcidComponent => {
  const widget = inject(
    () =>
      new CedarInputOrcidComponent(
        new FormBuilder(),
        {} as ComponentDataService,
        registry(),
        {} as ExternalAuthorityLookupService,
      ),
  );
  widget.componentToRender = required(InputType.orcid);
  widget.handlerContext = context();
  widget.ngOnInit();
  widget.onSelectionChange(TERM, chosen);
  return widget;
};

const FIELDS: RequiredField[] = [
  {
    name: 'a text field, by its clear action',
    emptied: () => {
      const widget = inject(
        () =>
          new CedarInputTextComponent(new FormBuilder(), {} as ComponentDataService, registry(), {
            isHtmlString: () => false,
          } as unknown as HtmlDetectService),
      );
      widget.componentToRender = required(InputType.text);
      widget.handlerContext = context();
      widget.ngOnInit();
      widget.setCurrentValue('some text');
      widget.clearValue();
      return widget.inputValueControl.hasError('required');
    },
  },
  {
    name: 'a numeric field, by its clear action',
    emptied: () => {
      const widget = inject(
        () =>
          new CedarInputNumericComponent(new FormBuilder(), {} as ComponentDataService, registry(), {
            instant: () => '',
          } as unknown as TranslateService),
      );
      widget.componentToRender = required(InputType.numeric);
      widget.handlerContext = context();
      widget.ngOnInit();
      widget.setCurrentValue('42');
      widget.clearValue();
      return widget.inputValueControl.hasError('required');
    },
  },
  {
    name: 'a link field, by its clear action',
    emptied: () => {
      const widget = inject(
        () => new CedarInputLinkComponent(new FormBuilder(), {} as ComponentDataService, registry()),
      );
      widget.componentToRender = required(InputType.link);
      widget.handlerContext = context();
      widget.ngOnInit();
      widget.setCurrentValue('https://example.org/');
      widget.clearValue();
      return widget.inputValueControl.hasError('required');
    },
  },
  {
    name: 'an email field, by its clear action',
    emptied: () => {
      const widget = inject(
        () => new CedarInputEmailComponent(new FormBuilder(), {} as ComponentDataService, registry()),
      );
      widget.componentToRender = required(InputType.email);
      widget.handlerContext = context();
      widget.ngOnInit();
      widget.setCurrentValue('someone@example.org');
      widget.clearValue();
      return widget.inputValueControl.hasError('required');
    },
  },
  {
    name: 'a phone field, by its clear action',
    emptied: () => {
      const widget = inject(
        () => new CedarInputPhoneComponent(new FormBuilder(), {} as ComponentDataService, registry()),
      );
      widget.componentToRender = required(InputType.phoneNumber);
      widget.handlerContext = context();
      widget.ngOnInit();
      widget.setCurrentValue('+1 650 555 0100');
      widget.clearValue();
      return widget.inputValueControl.hasError('required');
    },
  },
  {
    name: 'a radio group, by its clear action',
    emptied: () => {
      const widget = inject(() => new CedarInputMultipleChoiceComponent(new FormBuilder(), registry()));
      widget.componentToRender = required(InputType.radio);
      widget.handlerContext = context();
      widget.ngOnInit();
      widget.setCurrentValue('A');
      widget.clearValue();
      return widget.selectedChoiceInputControl.hasError('required');
    },
  },
  {
    name: 'a single-choice select, by its clear action',
    emptied: () => {
      const widget = inject(
        () => new CedarInputSelectComponent(registry(), {} as ComponentDataService, new FormBuilder()),
      );
      widget.componentToRender = required(InputType.list);
      widget.handlerContext = context();
      widget.ngOnInit();
      widget.setCurrentValue('A');
      widget.clearValue(new Event('click'));
      return widget.inputValueControl.hasError('required');
    },
  },
  {
    name: 'a multiple-choice select, by its clear action',
    emptied: () => {
      const widget = inject(
        () => new CedarInputSelectComponent(registry(), {} as ComponentDataService, new FormBuilder()),
      );
      widget.componentToRender = required(InputType.list, {
        choiceInfo: { multipleChoice: true, choices: [new ChoiceOption('A', false), new ChoiceOption('B', false)] },
      });
      widget.handlerContext = context();
      widget.ngOnInit();
      widget.setCurrentValue(['A', 'B']);
      widget.clearValue(new Event('click'));
      return widget.inputValueControl.hasError('required');
    },
  },
  {
    name: 'a checkbox group, by unticking its last option',
    emptied: () => {
      const widget = inject(() => new CedarInputCheckboxComponent(new FormBuilder(), registry()));
      widget.componentToRender = required(InputType.checkbox, {
        choiceInfo: { multipleChoice: true, choices: [new ChoiceOption('A', false), new ChoiceOption('B', false)] },
      });
      widget.handlerContext = context();
      widget.ngOnInit();
      widget.inputChanged({ target: { value: 'A', checked: true } } as unknown as Event);
      widget.inputChanged({ target: { value: 'A', checked: false } } as unknown as Event);
      return widget.options.hasError('required');
    },
  },
  {
    name: 'a controlled term, by its clear action',
    emptied: () => {
      const widget = inject(
        () =>
          new CedarInputControlledComponent(
            new FormBuilder(),
            {} as ComponentDataService,
            registry(),
            { getData: () => of([]) } as unknown as ControlledFieldDataService,
            {} as MessageHandlerService,
          ),
      );
      widget.componentToRender = required(InputType.controlled);
      widget.handlerContext = context();
      widget.ngOnInit();
      widget.onSelectionChange(TERM, chosen);
      widget.clearValue();
      return widget.inputValueControl.hasError('required');
    },
  },
  {
    name: 'an external authority, by its clear action',
    emptied: () => {
      const widget = authority();
      widget.clearValue();
      return widget.inputValueControl.hasError('required');
    },
  },
  {
    name: 'an external authority, by deleting its text',
    emptied: () => {
      const widget = authority();
      widget.inputChanged(emptiedBox());
      return widget.inputValueControl.hasError('required');
    },
  },
  {
    name: 'a temporal field, by its clear action',
    emptied: () => {
      const widget = inject(() => new CedarInputDatetimeComponent(new FormBuilder(), registry()));
      // Through the setter, which is what installs the validators.
      widget.componentToRender = required(InputType.temporal, {
        basicInfo: { inputType: InputType.temporal, temporalGranularity: Temporal.day, timezoneEnabled: false },
        valueInfo: { requiredValue: true, temporalType: Xsd.date },
      });
      widget.handlerContext = context();
      widget.ngOnInit();
      widget.dateInputChanged(new Date(2027, 5, 17));
      widget.clearValue();
      return widget.valueControl.hasError('required') && widget.showsValidationMessage;
    },
  },
];

describe('a required field emptied by the user reports the requirement', () => {
  for (const subject of FIELDS) {
    it(`for ${subject.name}`, () => {
      expect(subject.emptied()).toBe(true);
    });
  }
});
