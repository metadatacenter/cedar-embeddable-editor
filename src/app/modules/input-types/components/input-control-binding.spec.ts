import { ChangeDetectorRef, Injector, runInInjectionContext } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { FieldComponent } from '../../shared/models/component/field-component.model';
import { ChoiceOption } from '../../shared/models/info/choice-option.model';
import { InputType } from '../../shared/models/input-type.model';
import { ActiveComponentRegistryService } from '../../shared/service/active-component-registry.service';
import { ComponentDataService } from '../../shared/service/component-data.service';
import { ControlledFieldDataService } from '../../shared/service/controlled-field-data.service';
import { HtmlDetectService } from '../../shared/service/html-detect.service';
import { MessageHandlerService } from '../../shared/service/message-handler.service';
import { UserPreferencesService } from '../../shared/service/user-preferences.service';
import { CedarInputControlledComponent } from './cedar-input-controlled/cedar-input-controlled.component';
import { CedarInputEmailComponent } from './cedar-input-email/cedar-input-email.component';
import { CedarInputLinkComponent } from './cedar-input-link/cedar-input-link.component';
import { CedarInputNumericComponent } from './cedar-input-numeric/cedar-input-numeric.component';
import { CedarInputPhoneComponent } from './cedar-input-phone/cedar-input-phone.component';
import { CedarInputSelectComponent } from './cedar-input-select/cedar-input-select.component';
import { CedarInputTextComponent } from './cedar-input-text/cedar-input-text.component';

/**
 * The control a widget validates is the control its template binds.
 *
 * Every widget below builds a control with the field's validators on it, and
 * wraps it in a `FormGroup` its template hangs `[formGroup]` on. Those are two
 * references to what must be one control. Seven of them built the group in the
 * constructor and then replaced the control in `ngOnInit` — where the validators
 * are, because they come off a component that arrives as an input — so the group
 * went on holding a control nothing rendered and nothing read. Angular says
 * nothing about that: an orphaned control is valid, and the numeric widget's
 * carried a placeholder `Validators.min(10)` that could never fire.
 *
 * Stated as one table because the invariant is one, and because the next widget
 * to be written will be written by copying one of these.
 */
interface WidgetUnderTest {
  name: string;
  build: (fb: FormBuilder, registry: ActiveComponentRegistryService) => BoundWidget;
}

/** Read after `init`, never captured before it — the point is what init leaves behind. */
interface BoundWidget {
  init: () => void;
  options: () => FormGroup;
  boundControl: () => AbstractControl;
}

const field = (inputType: string): FieldComponent =>
  ({
    path: ['field'],
    name: 'field',
    basicInfo: { inputType },
    valueInfo: { requiredValue: false, minLength: null, maxLength: null },
    numberInfo: { numberType: null, decimalPlace: null, minValue: null, maxValue: null, unitOfMeasure: null },
    choiceInfo: { multipleChoice: false, choices: [new ChoiceOption('A', false)] },
    multiInfo: { maxItems: null },
    controlledInfo: {},
  }) as unknown as FieldComponent;

const WIDGETS: WidgetUnderTest[] = [
  {
    name: 'text',
    build: (fb, registry) => {
      const widget = new CedarInputTextComponent(fb, {} as ComponentDataService, registry, {
        isHtmlString: () => false,
      } as unknown as HtmlDetectService);
      widget.componentToRender = field(InputType.text);
      return {
        init: () => widget.ngOnInit(),
        options: () => widget.options,
        boundControl: () => widget.inputValueControl,
      };
    },
  },
  {
    name: 'numeric',
    build: (fb, registry) => {
      const widget = new CedarInputNumericComponent(fb, {} as ComponentDataService, registry, {
        instant: () => '',
      } as unknown as TranslateService);
      widget.componentToRender = field(InputType.numeric);
      return {
        init: () => widget.ngOnInit(),
        options: () => widget.options,
        boundControl: () => widget.inputValueControl,
      };
    },
  },
  {
    name: 'link',
    build: (fb, registry) => {
      const widget = new CedarInputLinkComponent(fb, {} as ComponentDataService, registry);
      widget.componentToRender = field(InputType.link);
      return {
        init: () => widget.ngOnInit(),
        options: () => widget.options,
        boundControl: () => widget.inputValueControl,
      };
    },
  },
  {
    name: 'email',
    build: (fb, registry) => {
      const widget = new CedarInputEmailComponent(fb, {} as ComponentDataService, registry);
      widget.componentToRender = field(InputType.email);
      return {
        init: () => widget.ngOnInit(),
        options: () => widget.options,
        boundControl: () => widget.inputValueControl,
      };
    },
  },
  {
    name: 'phone',
    build: (fb, registry) => {
      const widget = new CedarInputPhoneComponent(fb, {} as ComponentDataService, registry);
      widget.componentToRender = field(InputType.phoneNumber);
      return {
        init: () => widget.ngOnInit(),
        options: () => widget.options,
        boundControl: () => widget.inputValueControl,
      };
    },
  },
  {
    name: 'controlled',
    build: (fb, registry) => {
      const widget = new CedarInputControlledComponent(
        fb,
        {} as ComponentDataService,
        registry,
        { getData: () => of([]) } as unknown as ControlledFieldDataService,
        {} as MessageHandlerService,
      );
      widget.componentToRender = field(InputType.controlled);
      return {
        init: () => widget.ngOnInit(),
        options: () => widget.options,
        boundControl: () => widget.inputValueControl,
      };
    },
  },
  {
    name: 'select',
    build: (fb, registry) => {
      const widget = new CedarInputSelectComponent(registry, {} as ComponentDataService, fb);
      widget.componentToRender = field(InputType.list);
      return {
        init: () => widget.ngOnInit(),
        options: () => widget.options,
        boundControl: () => widget.inputValueControl,
      };
    },
  },
];

describe('a widget group holds the control its template binds', () => {
  const build = (widget: WidgetUnderTest): BoundWidget => {
    const active = {
      registerComponent: vi.fn(),
      unregisterComponent: vi.fn(),
    } as unknown as ActiveComponentRegistryService;
    const injector = Injector.create({
      providers: [
        { provide: ActiveComponentRegistryService, useValue: active },
        { provide: UserPreferencesService, useValue: { readOnlyMode$: of(false) } },
        { provide: ChangeDetectorRef, useValue: { markForCheck: vi.fn() } },
      ],
    });
    return runInInjectionContext(injector, () => widget.build(new FormBuilder(), active));
  };

  for (const widget of WIDGETS) {
    it(`binds one control for the ${widget.name} field`, () => {
      const built = build(widget);

      built.init();

      expect(built.options().get('inputValue')).toBe(built.boundControl());
    });
  }

  for (const widget of WIDGETS) {
    it(`carries the field's validators on the ${widget.name} field's rendered control`, () => {
      const built = build(widget);

      built.init();

      // The group is what a template's `[formGroup]` addresses, so a group whose
      // validity is decided by a control nobody renders reports on nothing.
      expect(built.options().valid).toBe(built.boundControl().valid);
    });
  }
});
