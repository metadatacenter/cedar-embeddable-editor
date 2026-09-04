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
import { CedarInputAttributeValueComponent } from './cedar-input-attribute-value/cedar-input-attribute-value.component';
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
 * What every widget hands the model when its field is emptied.
 *
 * An unfilled literal is `{"@value": null}` and an unfilled IRI-valued field is
 * `{}`. `data-object-builder.handler.spec.ts` pins that for a field nobody has
 * touched. This asks the same question of a field somebody has emptied, across
 * every widget at once, because the answer is one answer and the widgets are
 * copies of each other: the attribute-value field recorded `{"@value": ""}` for
 * years, from a guard that could not run, and nothing here was placed to notice
 * that one of ten disagreed with the other nine.
 *
 * The empty string is the specific thing to keep out. A consumer testing for
 * null reads it as an answer.
 */
interface EmptiedField {
  name: string;
  /** Empty the field the way a user does, and answer with everything handed to the model. */
  empty: () => unknown[];
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

const field = (inputType: string, extra: Record<string, unknown> = {}): FieldComponent =>
  ({
    path: ['field'],
    name: 'field',
    basicInfo: { inputType, temporalGranularity: Temporal.day, timezoneEnabled: false },
    valueInfo: { requiredValue: false, minLength: null, maxLength: null, temporalType: Xsd.date },
    numberInfo: { numberType: null, decimalPlace: null, minValue: null, maxValue: null, unitOfMeasure: null },
    choiceInfo: { multipleChoice: false, choices: [new ChoiceOption('A', false)] },
    multiInfo: { maxItems: null },
    controlledInfo: {},
    ...extra,
  }) as unknown as FieldComponent;

/** Records everything a widget hands the model, whichever method it reaches for. */
const recorder = (): { context: HandlerContext; written: unknown[] } => {
  const written: unknown[] = [];
  const context = {
    changeValue: (_c: unknown, value: unknown) => written.push(value),
    changeListValue: (_c: unknown, value: unknown) => written.push(value),
    changeControlledValue: (_c: unknown, iri: unknown, label: unknown) => written.push(iri, label),
    changeAttributeValue: (_c: unknown, _key: unknown, value: unknown) => {
      written.push(value);
      return null;
    },
    getDataObjectNodeByPath: () => null,
  } as unknown as HandlerContext;
  return { context, written };
};

/** The one event a text-like widget reads: an input whose box is now empty. */
const emptiedBox = (): Event => ({ target: { value: '' } }) as unknown as Event;

const FIELDS: EmptiedField[] = [
  {
    name: 'text, by deleting its text',
    empty: () => {
      const { context, written } = recorder();
      const widget = inject(
        () =>
          new CedarInputTextComponent(new FormBuilder(), {} as ComponentDataService, registry(), {
            isHtmlString: () => false,
          } as unknown as HtmlDetectService),
      );
      widget.componentToRender = field(InputType.text);
      widget.handlerContext = context;
      widget.ngOnInit();
      widget.inputChanged(emptiedBox());
      return written;
    },
  },
  {
    name: 'text, by its clear action',
    empty: () => {
      const { context, written } = recorder();
      const widget = inject(
        () =>
          new CedarInputTextComponent(new FormBuilder(), {} as ComponentDataService, registry(), {
            isHtmlString: () => false,
          } as unknown as HtmlDetectService),
      );
      widget.componentToRender = field(InputType.text);
      widget.handlerContext = context;
      widget.ngOnInit();
      widget.clearValue();
      return written;
    },
  },
  {
    name: 'numeric, by deleting its text',
    empty: () => {
      const { context, written } = recorder();
      const widget = inject(
        () =>
          new CedarInputNumericComponent(new FormBuilder(), {} as ComponentDataService, registry(), {
            instant: () => '',
          } as unknown as TranslateService),
      );
      widget.componentToRender = field(InputType.numeric);
      widget.handlerContext = context;
      widget.ngOnInit();
      widget.inputChanged(emptiedBox());
      return written;
    },
  },
  {
    name: 'link, by deleting its text',
    empty: () => {
      const { context, written } = recorder();
      const widget = inject(
        () => new CedarInputLinkComponent(new FormBuilder(), {} as ComponentDataService, registry()),
      );
      widget.componentToRender = field(InputType.link);
      widget.handlerContext = context;
      widget.ngOnInit();
      widget.inputChanged(emptiedBox());
      return written;
    },
  },
  {
    name: 'email, by deleting its text',
    empty: () => {
      const { context, written } = recorder();
      const widget = inject(
        () => new CedarInputEmailComponent(new FormBuilder(), {} as ComponentDataService, registry()),
      );
      widget.componentToRender = field(InputType.email);
      widget.handlerContext = context;
      widget.ngOnInit();
      widget.inputChanged(emptiedBox());
      return written;
    },
  },
  {
    name: 'phone, by deleting its text',
    empty: () => {
      const { context, written } = recorder();
      const widget = inject(
        () => new CedarInputPhoneComponent(new FormBuilder(), {} as ComponentDataService, registry()),
      );
      widget.componentToRender = field(InputType.phoneNumber);
      widget.handlerContext = context;
      widget.ngOnInit();
      widget.inputChanged(emptiedBox());
      return written;
    },
  },
  {
    name: 'a radio group, by its clear action',
    empty: () => {
      const { context, written } = recorder();
      const widget = inject(() => new CedarInputMultipleChoiceComponent(new FormBuilder(), registry()));
      widget.componentToRender = field(InputType.radio);
      widget.handlerContext = context;
      widget.ngOnInit();
      widget.clearValue();
      return written;
    },
  },
  {
    name: 'a select, by its clear action',
    empty: () => {
      const { context, written } = recorder();
      const widget = inject(
        () => new CedarInputSelectComponent(registry(), {} as ComponentDataService, new FormBuilder()),
      );
      widget.componentToRender = field(InputType.list);
      widget.handlerContext = context;
      widget.ngOnInit();
      widget.clearValue(new Event('click'));
      return written;
    },
  },
  {
    name: 'a controlled term, by its clear action',
    empty: () => {
      const { context, written } = recorder();
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
      widget.componentToRender = field(InputType.controlled);
      widget.handlerContext = context;
      widget.ngOnInit();
      widget.clearValue();
      return written;
    },
  },
  {
    name: 'an external authority, by its clear action',
    empty: () => {
      const { context, written } = recorder();
      const widget = inject(
        () =>
          new CedarInputOrcidComponent(
            new FormBuilder(),
            {} as ComponentDataService,
            registry(),
            {} as ExternalAuthorityLookupService,
          ),
      );
      widget.componentToRender = field(InputType.orcid);
      widget.handlerContext = context;
      widget.ngOnInit();
      widget.clearValue();
      return written;
    },
  },
  {
    name: 'an attribute value, by deleting its text',
    empty: () => {
      const { context, written } = recorder();
      const widget = inject(() => new CedarInputAttributeValueComponent(new FormBuilder(), registry()));
      widget.componentToRender = field(InputType.attributeValue);
      widget.handlerContext = context;
      widget.nameInputControl.setValue('colour');
      widget.valueChanged(emptiedBox());
      return written;
    },
  },
  {
    name: 'an attribute value, by its clear action',
    empty: () => {
      const { context, written } = recorder();
      const widget = inject(() => new CedarInputAttributeValueComponent(new FormBuilder(), registry()));
      widget.componentToRender = field(InputType.attributeValue);
      widget.handlerContext = context;
      widget.nameInputControl.setValue('colour');
      widget.clearValue();
      return written;
    },
  },
  {
    name: 'a temporal field, by its clear action',
    empty: () => {
      const { context, written } = recorder();
      const widget = inject(() => new CedarInputDatetimeComponent(new FormBuilder(), registry()));
      widget.componentToRender = field(InputType.temporal);
      widget.handlerContext = context;
      widget.clearValue();
      return written;
    },
  },
];

describe('emptying a field records nothing, never an empty string', () => {
  for (const subject of FIELDS) {
    it(`empties ${subject.name}`, () => {
      const written = subject.empty();

      expect(written.length).toBeGreaterThan(0);
      for (const value of written) {
        expect(value).not.toBe('');
        expect(value === null || (Array.isArray(value) && value.length === 0)).toBe(true);
      }
    });
  }
});
