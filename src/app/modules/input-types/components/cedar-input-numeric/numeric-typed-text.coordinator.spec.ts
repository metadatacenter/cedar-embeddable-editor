import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { TranslateModule } from '@ngx-translate/core';
import { vi } from 'vitest';
import { SharedModule } from '../../../shared/shared.module';
import { FieldComponent } from '../../../shared/models/component/field-component.model';
import { InputType } from '../../../shared/models/input-type.model';
import { Xsd } from '../../../shared/models/xsd.model';
import { HandlerContext } from '../../../shared/util/handler-context';
import { InputTypesModule } from '../../input-types.module';
import { CedarInputNumericComponent } from './cedar-input-numeric.component';

/**
 * A numeric field judges the text the user typed.
 *
 * Here rather than beside the widget's unit spec because the defect lived
 * between two listeners on one element. Angular's number accessor hands the
 * control `parseFloat` of the box on `input`, and the widget's own handler runs
 * on the same event; only a render puts both on the element in the order the
 * browser runs them, and only a render can say whether the verdict then reaches
 * a `mat-error`. `1.50` in a one-decimal field validated as `1.5` and passed
 * here while the quality report failed the `1.50` the model held.
 */
describe('a numeric field typed into', () => {
  const field = (): FieldComponent =>
    ({
      path: ['amount'],
      name: 'amount',
      basicInfo: { inputType: InputType.numeric },
      valueInfo: { requiredValue: false, minLength: null, maxLength: null, regex: null },
      numberInfo: { numberType: Xsd.decimal, decimalPlace: 1, minValue: null, maxValue: null, unitOfMeasure: null },
      choiceInfo: { multipleChoice: false, choices: [] },
      multiInfo: { maxItems: null },
      labelInfo: { label: 'amount', preferredLabel: null },
    }) as unknown as FieldComponent;

  const render = async () => {
    await TestBed.configureTestingModule({
      imports: [SharedModule, InputTypesModule, TranslateModule.forRoot()],
      providers: [provideHttpClient()],
    }).compileComponents();
    const fixture = TestBed.createComponent(CedarInputNumericComponent);
    const changeValue = vi.fn();
    fixture.componentInstance.handlerContext = { changeValue } as unknown as HandlerContext;
    fixture.componentInstance.componentToRender = field();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, changeValue };
  };

  /** What the browser does when someone types and leaves: the box holds the text, `input` and then `blur` fire. */
  const typeAndLeave = (fixture: Awaited<ReturnType<typeof render>>['fixture'], text: string): void => {
    const input = fixture.debugElement.query(By.css('input[type="number"]')).nativeElement as HTMLInputElement;
    input.value = text;
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
  };

  const errorText = (fixture: Awaited<ReturnType<typeof render>>['fixture']): string =>
    fixture.debugElement
      .queryAll(By.css('mat-error'))
      .map((element) => (element.nativeElement as HTMLElement).textContent?.trim() ?? '')
      .join('');

  it('holds the typed text, and records it', async () => {
    const { fixture, changeValue } = await render();

    typeAndLeave(fixture, '1.50');

    expect(fixture.componentInstance.inputValueControl.value).toBe('1.50');
    expect(changeValue).toHaveBeenCalledWith(expect.anything(), '1.50');
  });

  it('states the decimal places a value exceeds', async () => {
    const { fixture } = await render();

    typeAndLeave(fixture, '1.50');

    expect(errorText(fixture)).toContain('decimal place');
  });

  it('states nothing about a value within them', async () => {
    const { fixture } = await render();

    typeAndLeave(fixture, '1.5');

    expect(errorText(fixture)).toBe('');
  });
});
