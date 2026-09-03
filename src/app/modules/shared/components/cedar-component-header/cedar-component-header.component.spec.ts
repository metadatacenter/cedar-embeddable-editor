import { DestroyRef } from '@angular/core';
import { of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { MultiElementComponent } from '../../models/element/multi-element-component.model';
import { SingleElementComponent } from '../../models/element/single-element-component.model';
import { MultiFieldComponent } from '../../models/field/multi-field-component.model';
import { SingleFieldComponent } from '../../models/field/single-field-component.model';
import { InputType } from '../../models/input-type.model';
import { StaticFieldComponent } from '../../models/static/static-field-component.model';
import { CedarTemplate } from '../../models/template/cedar-template.model';
import { ComponentDataService } from '../../service/component-data.service';
import { UserPreferencesService } from '../../service/user-preferences.service';
import { CedarComponentHeaderComponent } from './cedar-component-header.component';

/**
 * The row above every field: its name, whether an answer is required, and which
 * mark stands for the kind of value it takes.
 *
 * Every one of those is decided in an input setter that clears eleven fields and
 * then sets some of them, so what the header shows depends on what it showed
 * last unless the reset is complete. Angular reuses a component instance and
 * changes its input, which is exactly when that matters — and it had no spec.
 */
describe('CedarComponentHeaderComponent', () => {
  const makeHeader = (): CedarComponentHeaderComponent =>
    new CedarComponentHeaderComponent(
      new ComponentDataService(),
      { readOnlyMode$: of(false) } as unknown as UserPreferencesService,
      { destroyed: false, onDestroy: () => () => undefined } as unknown as DestroyRef,
    );

  const singleField = (inputType: string, requiredValue = false): SingleFieldComponent => {
    const field = new SingleFieldComponent();
    field.name = 'f';
    field.basicInfo.inputType = inputType;
    field.valueInfo.requiredValue = requiredValue;
    return field;
  };

  const multiField = (inputType: string, requiredValue = false): MultiFieldComponent => {
    const field = new MultiFieldComponent();
    field.name = 'f';
    field.basicInfo.inputType = inputType;
    field.valueInfo.requiredValue = requiredValue;
    return field;
  };

  describe('the required mark', () => {
    it('appears on a field the template requires an answer to', () => {
      const header = makeHeader();

      header.componentToRender = singleField(InputType.text, true);

      expect(header.shouldRenderRequiredMark).toBe(true);
    });

    it('stays off a field the template does not', () => {
      const header = makeHeader();

      header.componentToRender = singleField(InputType.text, false);

      expect(header.shouldRenderRequiredMark).toBe(false);
    });

    it('appears on a required repeating field', () => {
      const header = makeHeader();

      header.componentToRender = multiField(InputType.text, true);

      expect(header.shouldRenderRequiredMark).toBe(true);
    });

    it('comes off again when the same header is given an optional field', () => {
      // Angular reuses the instance and changes the input. Every flag the setter
      // sets has to be one it also clears, or the header keeps describing the
      // field it showed last.
      const header = makeHeader();
      header.componentToRender = singleField(InputType.text, true);

      header.componentToRender = singleField(InputType.text, false);

      expect(header.shouldRenderRequiredMark).toBe(false);
    });
  });

  describe('the mark for the kind of value', () => {
    it.each([
      [InputType.text, 'short_text'],
      [InputType.textarea, 'notes'],
      [InputType.numeric, 'dialpad'],
      [InputType.email, 'email'],
      [InputType.link, 'link'],
      [InputType.phoneNumber, 'phone'],
      [InputType.list, 'arrow_drop_down_circle'],
      [InputType.checkbox, 'check_box'],
      [InputType.radio, 'radio_button_checked'],
      [InputType.temporal, 'event'],
      [InputType.attributeValue, 'list_alt'],
      [InputType.controlled, 'device_hub'],
    ])('marks a %s field with %s', (inputType, icon) => {
      const header = makeHeader();

      header.componentToRender = singleField(inputType);

      expect(header.fieldTypeIcon).toBe(icon);
    });

    it('falls back to a generic mark for a type it has no icon for', () => {
      const header = makeHeader();

      header.componentToRender = singleField('something-new');

      expect(header.fieldTypeIcon).toBe('edit');
    });

    it('names a controlled field as the one that draws on an ontology', () => {
      const header = makeHeader();

      header.componentToRender = singleField(InputType.controlled);

      expect(header.isOntologyField).toBe(true);
    });

    it('stops naming it when the header moves to another field', () => {
      const header = makeHeader();
      header.componentToRender = singleField(InputType.controlled);

      header.componentToRender = singleField(InputType.text);

      expect(header.isOntologyField).toBe(false);
    });
  });

  describe('the authorities, which carry their own mark instead', () => {
    const flagsOf = (header: CedarComponentHeaderComponent) => ({
      orcid: header.isOrcid,
      ror: header.isRor,
      pfas: header.isPfas,
      pmid: header.isPmid,
      rrid: header.isRrid,
      nihGrant: header.isNihGrant,
      doi: header.isDoi,
    });

    it.each([
      [InputType.orcid, 'orcid'],
      [InputType.ror, 'ror'],
      [InputType.pfas, 'pfas'],
      [InputType.pmid, 'pmid'],
      [InputType.rrid, 'rrid'],
      [InputType.nihGrant, 'nihGrant'],
      [InputType.doi, 'doi'],
    ])('raises %s and nothing else', (inputType, flag) => {
      const header = makeHeader();

      header.componentToRender = singleField(inputType);

      const raised = Object.entries(flagsOf(header))
        .filter(([, value]) => value)
        .map(([name]) => name);
      expect(raised).toEqual([flag]);
      expect(header.fieldTypeIcon, 'an authority carries its own mark, not a type icon').toBeNull();
    });

    it('lowers the previous authority when the header moves to another', () => {
      const header = makeHeader();
      header.componentToRender = singleField(InputType.orcid);

      header.componentToRender = singleField(InputType.doi);

      expect(flagsOf(header)).toEqual({
        orcid: false,
        ror: false,
        pfas: false,
        pmid: false,
        rrid: false,
        nihGrant: false,
        doi: true,
      });
    });
  });

  describe('which components carry a specification', () => {
    it('describes a field', () => {
      const header = makeHeader();
      const field = singleField(InputType.text);

      header.componentToRender = field;

      expect(header.fieldToDescribe).toBe(field);
    });

    it('describes a repeating field', () => {
      const header = makeHeader();
      const field = multiField(InputType.text);

      header.componentToRender = field;

      expect(header.fieldToDescribe).toBe(field);
    });

    it.each([
      ['an element', () => new SingleElementComponent()],
      ['a repeating element', () => new MultiElementComponent()],
      ['a template', () => new CedarTemplate()],
      ['a static field', () => new StaticFieldComponent()],
    ])('describes no value for %s, which constrains none', (_name, make) => {
      const header = makeHeader();

      header.componentToRender = make();

      expect(header.fieldToDescribe).toBeNull();
      expect(header.fieldTypeIcon).toBeNull();
    });
  });

  describe('the occurrence pager it makes room for', () => {
    it('carries the repeating component that pages', () => {
      const header = makeHeader();
      const field = multiField(InputType.text);

      header.componentToRender = field;

      expect(header.multiComponent).toBe(field);
    });

    it('carries a repeating element too', () => {
      const header = makeHeader();
      const element = new MultiElementComponent();

      header.componentToRender = element;

      expect(header.multiComponent).toBe(element);
    });

    it('carries none for a component that does not page', () => {
      const header = makeHeader();
      header.componentToRender = multiField(InputType.text);

      header.componentToRender = singleField(InputType.text);

      expect(header.multiComponent).toBeNull();
    });
  });

  it('follows the read-only preference', () => {
    const header = new CedarComponentHeaderComponent(
      new ComponentDataService(),
      { readOnlyMode$: of(true) } as unknown as UserPreferencesService,
      { destroyed: false, onDestroy: () => () => undefined } as unknown as DestroyRef,
    );

    header.ngOnInit();

    expect(header.readOnlyMode).toBe(true);
  });
});
