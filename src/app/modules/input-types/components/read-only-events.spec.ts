import { ChangeDetectorRef, Injector, runInInjectionContext } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { MatRadioChange } from '@angular/material/radio';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { FieldComponent } from '../../shared/models/component/field-component.model';
import { ChoiceOption } from '../../shared/models/info/choice-option.model';
import { InputType } from '../../shared/models/input-type.model';
import { ActiveComponentRegistryService } from '../../shared/service/active-component-registry.service';
import { ComponentDataService } from '../../shared/service/component-data.service';
import { ControlledFieldDataService } from '../../shared/service/controlled-field-data.service';
import { ExternalAuthorityLookupService } from '../../shared/service/external-authority-lookup.service';
import { MessageHandlerService } from '../../shared/service/message-handler.service';
import { UserPreferencesService } from '../../shared/service/user-preferences.service';
import { HandlerContext } from '../../shared/util/handler-context';
import { CedarInputAttributeValueComponent } from './cedar-input-attribute-value/cedar-input-attribute-value.component';
import { CedarInputCheckboxComponent } from './cedar-input-checkbox/cedar-input-checkbox.component';
import { CedarInputControlledComponent } from './cedar-input-controlled/cedar-input-controlled.component';
import { CedarInputMultipleChoiceComponent } from './cedar-input-multiple-choice/cedar-input-multiple-choice.component';
import { CedarInputOrcidComponent } from './cedar-input-orcid/cedar-input-orcid.component';

/**
 * An event a read-only widget can still receive writes nothing.
 *
 * `readonly` on an input stops keystrokes, and that is all it stops. A blur
 * still arrives; a Material checkbox or radio still flips on a click and reports
 * it; a suggestion panel still closes. Each widget that can receive one of those
 * decides for itself whether it means anything, and the attribute-value field
 * decided wrong: its name box rewrote the slot on every blur, in a form the host
 * had asked to be read, dropping the field's own context term on the way — so
 * tabbing through a read-only form published a change event carrying an
 * instance nobody had edited.
 *
 * A table of the events a browser delivers to a read-only widget, and one
 * assertion over all of them: nothing reached the model.
 */
interface ReadOnlyEvent {
  name: string;
  /** Deliver the event to a read-only widget, and answer with everything handed to the model after it. */
  deliver: () => unknown[];
}

const registry = (): ActiveComponentRegistryService =>
  ({ registerComponent: vi.fn(), unregisterComponent: vi.fn() }) as unknown as ActiveComponentRegistryService;

const readOnly = <T>(build: () => T): T => {
  const injector = Injector.create({
    providers: [
      { provide: ActiveComponentRegistryService, useValue: registry() },
      { provide: UserPreferencesService, useValue: { readOnlyMode$: of(true) } },
      { provide: ChangeDetectorRef, useValue: { markForCheck: vi.fn(), detectChanges: vi.fn() } },
    ],
  });
  return runInInjectionContext(injector, build);
};

const field = (inputType: string, extra: Record<string, unknown> = {}): FieldComponent =>
  ({
    path: ['field'],
    name: 'field',
    basicInfo: { inputType },
    valueInfo: { requiredValue: false, minLength: null, maxLength: null, regex: null },
    numberInfo: { numberType: null, decimalPlace: null, minValue: null, maxValue: null, unitOfMeasure: null },
    choiceInfo: { multipleChoice: false, choices: [new ChoiceOption('A', false), new ChoiceOption('B', false)] },
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
    changeAttributeValue: (_c: unknown, key: unknown, value: unknown) => {
      written.push({ key, value });
      return null;
    },
    getDataObjectNodeByPath: () => null,
  } as unknown as HandlerContext;
  return { context, written };
};

const EVENTS: ReadOnlyEvent[] = [
  {
    name: 'a click on a checkbox option',
    deliver: () => {
      const { context, written } = recorder();
      const widget = readOnly(() => new CedarInputCheckboxComponent(new FormBuilder(), registry()));
      widget.componentToRender = field(InputType.checkbox, {
        choiceInfo: { multipleChoice: true, choices: [new ChoiceOption('A', false), new ChoiceOption('B', false)] },
      });
      widget.handlerContext = context;
      widget.ngOnInit();
      // Showing the declared defaults on load is not the event under test.
      written.length = 0;
      widget.inputChanged({
        target: { value: 'A', checked: true },
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown as Event);
      return written;
    },
  },
  {
    name: 'a change on a radio option',
    deliver: () => {
      const { context, written } = recorder();
      const widget = readOnly(() => new CedarInputMultipleChoiceComponent(new FormBuilder(), registry()));
      widget.componentToRender = field(InputType.radio);
      widget.handlerContext = context;
      widget.ngOnInit();
      widget.inputChanged({ value: 'A' } as MatRadioChange);
      return written;
    },
  },
  {
    name: 'a blur on a controlled-term box holding text that names no term',
    deliver: () => {
      const { context, written } = recorder();
      const widget = readOnly(
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
      // Editable, this text would be discarded on blur and the discard reported.
      widget.inputValueControl.setValue('names no term');
      widget.onInputBlur();
      return written;
    },
  },
  {
    name: 'a blur on an external authority box holding text that names no term',
    deliver: () => {
      const { context, written } = recorder();
      const widget = readOnly(
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
      widget.inputValueControl.setValue('names no term');
      widget.onInputBlur();
      return written;
    },
  },
  {
    name: 'a blur on an attribute name box',
    deliver: () => {
      const { context, written } = recorder();
      const widget = readOnly(() => new CedarInputAttributeValueComponent(new FormBuilder(), registry()));
      widget.componentToRender = field(InputType.attributeValue);
      widget.handlerContext = context;
      widget.ngOnInit();
      widget.setCurrentValue({ colour: 'blue' });
      widget.nameChanged({ target: { value: 'colour' } } as unknown as Event);
      return written;
    },
  },
  {
    name: 'an input on an attribute value box',
    deliver: () => {
      const { context, written } = recorder();
      const widget = readOnly(() => new CedarInputAttributeValueComponent(new FormBuilder(), registry()));
      widget.componentToRender = field(InputType.attributeValue);
      widget.handlerContext = context;
      widget.ngOnInit();
      widget.setCurrentValue({ colour: 'blue' });
      widget.valueChanged({ target: { value: 'green' } } as unknown as Event);
      return written;
    },
  },
];

describe('an event a read-only widget can still receive writes nothing', () => {
  for (const subject of EVENTS) {
    it(`on ${subject.name}`, () => {
      expect(subject.deliver()).toEqual([]);
    });
  }
});
