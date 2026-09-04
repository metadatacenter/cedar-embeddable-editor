import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { TranslateModule } from '@ngx-translate/core';
import { vi } from 'vitest';
import { SharedModule } from '../../../shared/shared.module';
import { FieldComponent } from '../../../shared/models/component/field-component.model';
import { InputType } from '../../../shared/models/input-type.model';
import { UserPreferencesService } from '../../../shared/service/user-preferences.service';
import { HandlerContext } from '../../../shared/util/handler-context';
import { InputTypesModule } from '../../input-types.module';
import { CedarInputTextComponent } from './cedar-input-text.component';

/**
 * A text field holding an ORCID is a link while the form is read, and an input
 * once it is edited.
 *
 * Here because the second half is a claim about markup: the widget's unit spec
 * can say the identifier flag came down, and only a render can say that an
 * `input` took the link's place. It did not — the template chose the link on a
 * flag the mode change never lowered, and nothing then marked the view for a
 * redraw. A host sets the mode once, from configuration, so no embedder reaches
 * this today; the widget subscribes to the mode all the same, and what it does
 * when the mode moves is its contract.
 */
describe('a text field holding an ORCID', () => {
  const ORCID = 'https://orcid.org/0000-0002-1825-0097';

  const field = (): FieldComponent =>
    ({
      path: ['contributor'],
      name: 'contributor',
      basicInfo: { inputType: InputType.text },
      valueInfo: { requiredValue: false, minLength: null, maxLength: null, regex: null, defaultValue: null },
      numberInfo: { numberType: null, decimalPlace: null, minValue: null, maxValue: null, unitOfMeasure: null },
      choiceInfo: { multipleChoice: false, choices: [] },
      multiInfo: { maxItems: null, minItems: null },
      labelInfo: { label: 'contributor', preferredLabel: null },
      controlledInfo: {},
    }) as unknown as FieldComponent;

  const render = async () => {
    await TestBed.configureTestingModule({
      imports: [SharedModule, InputTypesModule, TranslateModule.forRoot()],
      providers: [provideHttpClient()],
    }).compileComponents();
    const preferences = TestBed.inject(UserPreferencesService);
    preferences.setReadOnlyMode(true);
    const fixture = TestBed.createComponent(CedarInputTextComponent);
    fixture.componentInstance.handlerContext = {
      changeValue: vi.fn(),
      statesSpecification: false,
    } as unknown as HandlerContext;
    fixture.componentInstance.componentToRender = field();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.componentInstance.setCurrentValue(ORCID);
    fixture.detectChanges();
    return { fixture, preferences };
  };

  it('reads as a link while the form is read-only', async () => {
    const { fixture } = await render();

    const link = fixture.debugElement.query(By.css('a'));
    expect(link).not.toBeNull();
    expect((link.nativeElement as HTMLAnchorElement).getAttribute('href')).toBe(ORCID);
    expect(fixture.debugElement.query(By.css('input'))).toBeNull();
  });

  it('becomes an input over the whole identifier once the form is editable', async () => {
    const { fixture, preferences } = await render();

    preferences.setReadOnlyMode(false);
    fixture.detectChanges();

    const input = fixture.debugElement.query(By.css('input'));
    expect(input).not.toBeNull();
    expect((input.nativeElement as HTMLInputElement).value).toBe(ORCID);
    expect(fixture.debugElement.query(By.css('a'))).toBeNull();
  });
});
