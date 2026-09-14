import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { provideTranslateService } from '@ngx-translate/core';
import { vi } from 'vitest';
import { SharedModule } from '../../../shared/shared.module';
import { FieldComponent } from '../../../shared/models/component/field-component.model';
import { InputType } from '../../../shared/models/input-type.model';
import { Temporal } from '../../../shared/models/temporal.model';
import { Xsd } from '../../../shared/models/xsd.model';
import { UserPreferencesService } from '../../../shared/service/user-preferences.service';
import { HandlerContext } from '../../../shared/util/handler-context';
import { InputTypesModule } from '../../input-types.module';
import { CedarInputDatetimeComponent } from './cedar-input-datetime.component';

/**
 * A read-only temporal field is named to a screen reader the way it is named on the screen.
 *
 * Every other widget asks `ComponentDataService` for the name to show, so an override and a
 * `skos:prefLabel` reach the control's accessible name along with the visible label. This one
 * read `labelInfo.label` straight, which is `schema:name` and nothing else — so a HuBMAP field
 * displayed "Parent sample ID" above a box announced as `parent_sample_id`.
 *
 * Here rather than in the widget's own spec because it is a claim about markup: the component
 * can hold the right label and still bind the wrong one into the attribute.
 */
describe('a read-only temporal field', () => {
  /** The production shape: named for its key, with the only legible name in `skos:prefLabel`. */
  const field = (): FieldComponent =>
    ({
      path: ['lab_id'],
      name: 'lab_id',
      basicInfo: {
        inputType: InputType.temporal,
        temporalGranularity: Temporal.day,
        timezoneEnabled: false,
      },
      valueInfo: {
        temporalType: Xsd.date,
        requiredValue: false,
        minLength: null,
        maxLength: null,
        regex: null,
        defaultValue: null,
      },
      numberInfo: { numberType: null, decimalPlace: null, minValue: null, maxValue: null, unitOfMeasure: null },
      choiceInfo: { multipleChoice: false, choices: [] },
      multiInfo: { maxItems: null, minItems: null },
      controlledInfo: {},
      labelInfo: { deploymentLabel: null, preferredLabel: 'Lab ID', label: 'lab_id' },
    }) as unknown as FieldComponent;

  const render = async () => {
    await TestBed.configureTestingModule({
      imports: [SharedModule, InputTypesModule],
      providers: [provideHttpClient(), provideTranslateService()],
    }).compileComponents();
    TestBed.inject(UserPreferencesService).setReadOnlyMode(true);
    const fixture = TestBed.createComponent(CedarInputDatetimeComponent);
    fixture.componentInstance.handlerContext = {
      changeValue: vi.fn(),
      statesSpecification: false,
    } as unknown as HandlerContext;
    fixture.componentInstance.componentToRender = field();
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  };

  it('announces the label the form displays, not the property key', async () => {
    const fixture = await render();

    const input = fixture.debugElement.query(By.css('input[readonly]'));
    expect(input, 'the read-only branch rendered no input to name').not.toBeNull();
    expect((input.nativeElement as HTMLInputElement).getAttribute('aria-label')).toBe('Lab ID');
  });
});
