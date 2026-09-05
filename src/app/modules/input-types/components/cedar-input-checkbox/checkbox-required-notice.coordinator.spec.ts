import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { TranslateModule } from '@ngx-translate/core';
import { vi } from 'vitest';
import { SharedModule } from '../../../shared/shared.module';
import { FieldComponent } from '../../../shared/models/component/field-component.model';
import { ChoiceOption } from '../../../shared/models/info/choice-option.model';
import { InputType } from '../../../shared/models/input-type.model';
import { HandlerContext } from '../../../shared/util/handler-context';
import { InputTypesModule } from '../../input-types.module';
import { CedarInputCheckboxComponent } from './cedar-input-checkbox.component';

/**
 * A required checkbox group renders a notice saying so.
 *
 * Here rather than beside the widget's other specs because it is the one part
 * that nothing short of a render can answer. The widget's own validator was
 * installed, and reported the field unsatisfied, into a template with no
 * `mat-error` and no `mat-form-field` to put one in — so the verdict existed and
 * was shown to nobody, which is the state the validator was added to end.
 * `cedar-input-checkbox.component.spec.ts` can ask whether the widget decided;
 * only this tier can ask whether anyone was told.
 */
describe('a required checkbox group', () => {
  const field = (requiredValue: boolean): FieldComponent =>
    ({
      path: ['agreement'],
      name: 'agreement',
      basicInfo: { inputType: InputType.checkbox },
      valueInfo: { requiredValue },
      choiceInfo: { multipleChoice: true, choices: [new ChoiceOption('Yes', false), new ChoiceOption('No', false)] },
      multiInfo: { maxItems: null },
    }) as unknown as FieldComponent;

  const render = async (requiredValue: boolean) => {
    await TestBed.configureTestingModule({
      imports: [SharedModule, InputTypesModule, TranslateModule.forRoot()],
      providers: [provideHttpClient()],
    }).compileComponents();
    const fixture = TestBed.createComponent(CedarInputCheckboxComponent);
    fixture.componentInstance.handlerContext = {
      getDataObjectNodeByPath: () => null,
      changeListValue: vi.fn(),
      statesSpecification: false,
    } as unknown as HandlerContext;
    fixture.componentInstance.componentToRender = field(requiredValue);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  };

  const noticeText = (fixture: Awaited<ReturnType<typeof render>>): string =>
    fixture.debugElement
      .queryAll(By.css('mat-error'))
      .map((element) => (element.nativeElement as HTMLElement).textContent?.trim() ?? '')
      .join('');

  /**
   * Focus a box and leave it. Material marks the control touched from the blur
   * on a microtask, so the render has to wait for that before it can be asked.
   */
  const leave = async (fixture: Awaited<ReturnType<typeof render>>): Promise<void> => {
    const box = fixture.debugElement.queryAll(By.css('input[type="checkbox"]'))[0].nativeElement as HTMLInputElement;
    box.dispatchEvent(new Event('focus'));
    box.dispatchEvent(new Event('blur'));
    await fixture.whenStable();
    fixture.detectChanges();
  };

  it('renders no notice before anyone has been near the group', async () => {
    const fixture = await render(true);

    expect(noticeText(fixture)).toBe('');
  });

  it('renders a notice once the group has been left with nothing ticked', async () => {
    const fixture = await render(true);

    await leave(fixture);

    expect(noticeText(fixture)).not.toBe('');
  });

  it('takes the notice away once an option is ticked', async () => {
    const fixture = await render(true);
    const box = fixture.debugElement.queryAll(By.css('input[type="checkbox"]'))[0].nativeElement as HTMLInputElement;

    box.click();
    fixture.detectChanges();

    expect(noticeText(fixture)).toBe('');
  });

  it('renders no notice for a group the template does not require', async () => {
    const fixture = await render(false);

    await leave(fixture);

    expect(noticeText(fixture)).toBe('');
  });
});
