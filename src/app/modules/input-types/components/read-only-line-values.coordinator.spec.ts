import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { CdkTextareaAutosize } from '@angular/cdk/text-field';
import { provideHttpClient } from '@angular/common/http';
import { provideTranslateService } from '@ngx-translate/core';
import { vi } from 'vitest';
import { SharedModule } from '../../shared/shared.module';
import { FieldComponent } from '../../shared/models/component/field-component.model';
import { InputType } from '../../shared/models/input-type.model';
import { LINE_VALUE_CLASS } from '../../shared/directives/control-density.directive';
import { UserPreferencesService } from '../../shared/service/user-preferences.service';
import { HandlerContext } from '../../shared/util/handler-context';
import { InputTypesModule } from '../input-types.module';
import { CedarInputEmailComponent } from './cedar-input-email/cedar-input-email.component';
import { CedarInputPhoneComponent } from './cedar-input-phone/cedar-input-phone.component';
import { CedarInputTextComponent } from './cedar-input-text/cedar-input-text.component';

/**
 * Read-only, a text, email or phone value is drawn in the box a paragraph grows in.
 *
 * An input shows one line and cuts off what does not fit, with nothing to say that more follows. A
 * growing box wraps the value instead. It is marked as a line value, so the density's paragraph rows
 * do not reach it and a short value keeps the one row of the input it replaces. Editing, each of the
 * three is still an input.
 *
 * A claim about markup, so it is made over a render, and once for the three widgets that share it.
 */
type LineWidget = CedarInputTextComponent | CedarInputEmailComponent | CedarInputPhoneComponent;

const WIDGETS: readonly { name: string; widget: Type<LineWidget>; inputType: string; value: string }[] = [
  { name: 'text', widget: CedarInputTextComponent, inputType: InputType.text, value: 'A stored value' },
  { name: 'email', widget: CedarInputEmailComponent, inputType: InputType.email, value: 'curator@example.org' },
  { name: 'phone', widget: CedarInputPhoneComponent, inputType: InputType.phoneNumber, value: '+1 650 555 0100' },
];

describe.each(WIDGETS)('a read-only $name value', ({ widget, inputType, value }) => {
  const field = (): FieldComponent =>
    ({
      path: ['field'],
      name: 'field',
      basicInfo: { inputType },
      valueInfo: { requiredValue: false, minLength: null, maxLength: null, regex: null, defaultValue: null },
      numberInfo: { numberType: null, decimalPlace: null, minValue: null, maxValue: null, unitOfMeasure: null },
      choiceInfo: { multipleChoice: false, choices: [] },
      multiInfo: { maxItems: null, minItems: null },
      labelInfo: { label: 'field', preferredLabel: null },
      controlledInfo: {},
    }) as unknown as FieldComponent;

  const render = async (readOnly: boolean) => {
    await TestBed.configureTestingModule({
      imports: [SharedModule, InputTypesModule],
      providers: [provideHttpClient(), provideTranslateService()],
    }).compileComponents();
    const preferences = TestBed.inject(UserPreferencesService);
    preferences.setReadOnlyMode(readOnly);
    const fixture = TestBed.createComponent<LineWidget>(widget);
    const changeValue = vi.fn();
    fixture.componentInstance.handlerContext = { changeValue, statesSpecification: false } as unknown as HandlerContext;
    fixture.componentInstance.componentToRender = field();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.componentInstance.setCurrentValue(value);
    fixture.detectChanges();
    return { fixture, preferences, changeValue };
  };

  it('is drawn in a growing box that holds the value and cannot be typed into', async () => {
    const { fixture } = await render(true);

    const box = fixture.debugElement.query(By.css('textarea'));
    expect(box).not.toBeNull();
    const textarea = box.nativeElement as HTMLTextAreaElement;
    expect(textarea.value).toBe(value);
    expect(textarea.readOnly).toBe(true);
    expect(box.injector.get(CdkTextareaAutosize, null)).not.toBeNull();
    expect(fixture.debugElement.query(By.css('input'))).toBeNull();
  });

  it('is marked as a line value, which takes no paragraph rows from the density', async () => {
    const { fixture } = await render(true);

    const box = fixture.debugElement.query(By.css('textarea'));
    expect((box.nativeElement as HTMLTextAreaElement).classList.contains(LINE_VALUE_CLASS)).toBe(true);
    // The density directive gives a paragraph two rows or six. A line value states none.
    expect(box.injector.get(CdkTextareaAutosize).minRows).toBeFalsy();
    expect((box.nativeElement as HTMLTextAreaElement).style.minHeight).toBe('');
  });

  it('writes nothing when the box receives an input event', async () => {
    const { fixture, changeValue } = await render(true);

    const box = fixture.debugElement.query(By.css('textarea')).nativeElement as HTMLTextAreaElement;
    box.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();

    expect(changeValue).not.toHaveBeenCalled();
  });

  it('is an input again once the form is editable, and a growing box once it is read again', async () => {
    const { fixture, preferences } = await render(true);

    preferences.setReadOnlyMode(false);
    fixture.detectChanges();
    const input = fixture.debugElement.query(By.css('input'));
    expect(input).not.toBeNull();
    expect((input.nativeElement as HTMLInputElement).value).toBe(value);
    expect((input.nativeElement as HTMLInputElement).readOnly).toBe(false);
    expect(fixture.debugElement.query(By.css('textarea'))).toBeNull();

    preferences.setReadOnlyMode(true);
    fixture.detectChanges();
    const box = fixture.debugElement.query(By.css('textarea'));
    expect((box.nativeElement as HTMLTextAreaElement).value).toBe(value);
    expect(fixture.debugElement.query(By.css('input'))).toBeNull();
  });

  it('is an input while the form is edited', async () => {
    const { fixture } = await render(false);

    expect(fixture.debugElement.query(By.css('input'))).not.toBeNull();
    expect(fixture.debugElement.query(By.css('textarea'))).toBeNull();
  });
});

describe('a paragraph', () => {
  it('keeps the rows the density gives it, read-only or not, and is not a line value', async () => {
    await TestBed.configureTestingModule({
      imports: [SharedModule, InputTypesModule],
      providers: [provideHttpClient(), provideTranslateService()],
    }).compileComponents();
    TestBed.inject(UserPreferencesService).setReadOnlyMode(true);
    const fixture = TestBed.createComponent(CedarInputTextComponent);
    fixture.componentInstance.handlerContext = {
      changeValue: vi.fn(),
      statesSpecification: false,
    } as unknown as HandlerContext;
    fixture.componentInstance.componentToRender = {
      path: ['field'],
      name: 'field',
      basicInfo: { inputType: InputType.textarea },
      valueInfo: { requiredValue: false, minLength: null, maxLength: null, regex: null, defaultValue: null },
      labelInfo: { label: 'field', preferredLabel: null },
    } as unknown as FieldComponent;
    fixture.detectChanges();
    await fixture.whenStable();

    const box = fixture.debugElement.query(By.css('textarea'));
    expect((box.nativeElement as HTMLTextAreaElement).classList.contains(LINE_VALUE_CLASS)).toBe(false);
    expect(box.injector.get(CdkTextareaAutosize).minRows).toBeGreaterThanOrEqual(2);
  });
});
