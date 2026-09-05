import { ChangeDetectorRef, Injector, runInInjectionContext } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { describe, expect, it, vi } from 'vitest';
import { FieldComponent } from '../../../shared/models/component/field-component.model';
import { InputType } from '../../../shared/models/input-type.model';
import { ActiveComponentRegistryService } from '../../../shared/service/active-component-registry.service';
import { ComponentDataService } from '../../../shared/service/component-data.service';
import { HtmlDetectService } from '../../../shared/service/html-detect.service';
import { UserPreferencesService } from '../../../shared/service/user-preferences.service';
import { HandlerContext } from '../../../shared/util/handler-context';
import { CedarInputTextComponent } from './cedar-input-text.component';

/**
 * How a text field presents what it holds, and when.
 *
 * A text field holding an ORCID or a ROR reads as a link to it, and one holding
 * markup renders the markup. Both are presentations for reading, decided by the
 * value in hand. They used to be decided once and kept: the flags were raised by
 * a value and never lowered, so a form switched from read-only to editable kept
 * the link where the input should be and the field could not be edited.
 * `paging-between-occurrences.spec.ts` covers the same flags across pages;
 * `text-editable-after-read-only.coordinator.spec.ts` covers the markup.
 */
describe('CedarInputTextComponent presenting an identifier', () => {
  const ORCID = 'https://orcid.org/0000-0002-1825-0097';

  const makeComponent = (
    readOnly: boolean,
  ): { component: CedarInputTextComponent; preferences: UserPreferencesService } => {
    const registry = {
      registerComponent: vi.fn(),
      unregisterComponent: vi.fn(),
    } as unknown as ActiveComponentRegistryService;
    const preferences = new UserPreferencesService();
    preferences.setReadOnlyMode(readOnly);
    const injector = Injector.create({
      providers: [
        { provide: ActiveComponentRegistryService, useValue: registry },
        { provide: UserPreferencesService, useValue: preferences },
        { provide: ChangeDetectorRef, useValue: { markForCheck: vi.fn() } },
      ],
    });
    const component = runInInjectionContext(
      injector,
      () =>
        new CedarInputTextComponent(new FormBuilder(), {} as ComponentDataService, registry, new HtmlDetectService()),
    );
    component.componentToRender = {
      path: ['contributor'],
      name: 'contributor',
      basicInfo: { inputType: InputType.text },
      valueInfo: { requiredValue: false, minLength: null, maxLength: null, regex: null },
      choiceInfo: { choices: [] },
    } as unknown as FieldComponent;
    component.handlerContext = { changeValue: vi.fn() } as unknown as HandlerContext;
    component.ngOnInit();
    return { component, preferences };
  };

  it('reads an ORCID as a link to the whole identifier, showing its last segment', () => {
    const { component } = makeComponent(true);

    component.setCurrentValue(ORCID);

    expect(component.isOrcid).toBe(true);
    expect(component.originalValue).toBe(ORCID);
    expect(component.inputValueControl.value).toBe('0000-0002-1825-0097');
  });

  it('becomes an input over the whole identifier once the form is editable', () => {
    const { component, preferences } = makeComponent(true);
    component.setCurrentValue(ORCID);

    preferences.setReadOnlyMode(false);

    expect(component.isOrcid).toBe(false);
    expect(component.originalValue).toBeNull();
    expect(component.inputValueControl.value).toBe(ORCID);
  });

  it('reads as a link again once the form is read-only again', () => {
    const { component, preferences } = makeComponent(false);
    component.setCurrentValue(ORCID);

    preferences.setReadOnlyMode(true);

    expect(component.isOrcid).toBe(true);
    expect(component.inputValueControl.value).toBe('0000-0002-1825-0097');
  });

  it('lowers the identifier flag for a value that is not one', () => {
    const { component } = makeComponent(true);
    component.setCurrentValue(ORCID);

    component.setCurrentValue('plain text');

    expect(component.isOrcid).toBe(false);
    expect(component.originalValue).toBeNull();
    expect(component.inputValueControl.value).toBe('plain text');
  });

  it('renders markup only for a value that carries some', () => {
    const { component } = makeComponent(true);

    component.setCurrentValue('<b>bold</b>');
    expect(component.isRichText).toBe(true);

    component.setCurrentValue('plain text');
    expect(component.isRichText).toBe(false);
  });

  it('holds an editable box as text whatever it is given', () => {
    const { component } = makeComponent(false);

    component.setCurrentValue(ORCID);

    expect(component.isOrcid).toBe(false);
    expect(component.isRichText).toBe(false);
    expect(component.inputValueControl.value).toBe(ORCID);
  });
});
