import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { provideTranslateService, TranslateService } from '@ngx-translate/core';
import { vi } from 'vitest';
import * as english from '../../../../../assets/i18n-cee/en.json';
import * as hungarian from '../../../../../assets/i18n-cee/hu.json';
import { SharedModule } from '../../../shared/shared.module';
import { FieldComponent } from '../../../shared/models/component/field-component.model';
import { InputType } from '../../../shared/models/input-type.model';
import { HandlerContext } from '../../../shared/util/handler-context';
import { UserPreferencesService } from '../../../shared/service/user-preferences.service';
import { InputTypesModule } from '../../input-types.module';
import { CedarInputTextComponent } from './cedar-input-text.component';

for (const inputType of [InputType.text, InputType.textarea]) {
  it(`explains a pattern mismatch in ${inputType} and clears it after correction`, async () => {
    await TestBed.configureTestingModule({
      imports: [SharedModule, InputTypesModule],
      providers: [provideHttpClient(), provideTranslateService()],
    }).compileComponents();
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('en', english);
    translate.setTranslation('hu', hungarian);
    translate.use('en');
    const fixture = TestBed.createComponent(CedarInputTextComponent);
    fixture.componentInstance.handlerContext = {
      changeValue: vi.fn(),
      statesSpecification: false,
    } as unknown as HandlerContext;
    fixture.componentInstance.componentToRender = {
      path: ['parent'],
      name: 'parent',
      basicInfo: { inputType },
      valueInfo: { requiredValue: true, minLength: null, maxLength: null, regex: '^HBM[0-9]{3}$', defaultValue: null },
      numberInfo: { numberType: null, decimalPlace: null, minValue: null, maxValue: null, unitOfMeasure: null },
      choiceInfo: { multipleChoice: false, choices: [] },
      multiInfo: { minItems: null, maxItems: null },
      labelInfo: { label: 'Parent sample ID', preferredLabel: null },
      controlledInfo: {},
    } as unknown as FieldComponent;
    fixture.detectChanges();
    await fixture.whenStable();
    const input = fixture.debugElement.query(By.css('input, textarea')).nativeElement as HTMLInputElement;
    input.value = 'dsdsdsd';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(fixture.debugElement.query(By.css('mat-error')).nativeElement.textContent.trim()).toBe(
      english.Validation.Text.Pattern,
    );
    const preferences = TestBed.inject(UserPreferencesService);
    preferences.suppressEmptyFieldErrors = true;
    input.value = '';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(fixture.componentInstance.inputValueControl.hasError('required')).toBe(true);
    expect(fixture.debugElement.query(By.css('mat-error'))).toBeNull();
    expect(fixture.componentInstance.quietEmptyPreview([])).toBe(true);
    expect(fixture.componentInstance.quietEmptyPreview(null)).toBe(true);
    expect(fixture.componentInstance.quietEmptyPreview(0)).toBe(false);
    expect(fixture.componentInstance.quietEmptyPreview(false)).toBe(false);
    expect(fixture.componentInstance.quietEmptyPreview(' ')).toBe(false);
    input.value = 'dsdsdsd';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('mat-error')).nativeElement.textContent.trim()).toBe(
      english.Validation.Text.Pattern,
    );
    preferences.suppressEmptyFieldErrors = false;
    translate.use('hu');
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('mat-error')).nativeElement.textContent.trim()).toBe(
      hungarian.Validation.Text.Pattern,
    );
    TestBed.inject(UserPreferencesService).setReadOnlyMode(true);
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('mat-error'))).toBeNull();
    TestBed.inject(UserPreferencesService).setReadOnlyMode(false);
    input.value = 'HBM123';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(fixture.componentInstance.inputValueControl.valid).toBe(true);
    expect(fixture.debugElement.query(By.css('mat-error'))).toBeNull();
  });
}
