import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideTranslateService } from '@ngx-translate/core';
import { draftTemplate } from '../../../../../harness/src/validation-state-fixtures';
import { SharedModule } from '../shared.module';
import { CedarEmbeddableMetadataEditorWrapperComponent } from './cedar-embeddable-metadata-editor-wrapper/cedar-embeddable-metadata-editor-wrapper.component';
import { ActiveComponentRegistryService } from '../service/active-component-registry.service';
import { componentsAlong } from '../util/component-location';
import { FieldComponent } from '../models/component/field-component.model';
import { MultiComponent } from '../models/component/multi-component.model';
import { CedarInputDatetimeComponent } from '../../input-types/components/cedar-input-datetime/cedar-input-datetime.component';
import { CedarInputAttributeValueComponent } from '../../input-types/components/cedar-input-attribute-value/cedar-input-attribute-value.component';
import { CeeJsonObject } from '../../../cee-public-api';
import { CedarMultiPagerComponent } from './cedar-multi-pager/cedar-multi-pager.component';

for (const depth of [1, 3, 6]) {
  describe(`real widgets and coordinator at depth ${depth}`, () => {
    for (const type of ['temporal', 'attrValue'] as const) {
      it(`${type}: unfinished edit → other occurrence → return → copy → delete → repair`, async () => {
        await TestBed.configureTestingModule({
          imports: [SharedModule],
          providers: [provideHttpClient(), provideTranslateService()],
        }).compileComponents();
        const fixture = TestBed.createComponent(CedarEmbeddableMetadataEditorWrapperComponent);
        fixture.componentInstance.templateObject = draftTemplate(depth, type) as CeeJsonObject;
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
        const context = fixture.componentInstance.handlerContext;
        const registry = fixture.debugElement.injector.get(ActiveComponentRegistryService);
        const path = Array.from({ length: depth }, (_, index) => `_level${index}`).concat('_f');
        const chain = componentsAlong(context.dataContext.templateRepresentation, path)!;
        const field = chain.at(-1)! as FieldComponent;
        const parent = chain.at(-2)! as MultiComponent;
        if (type === 'attrValue') {
          // The field starts with no rows. Add one with the field's own add button, as a user
          // would, and leave it unnamed. The click is what marks the renderers for checking.
          const pager = fixture.debugElement
            .queryAll(By.directive(CedarMultiPagerComponent))
            .find((candidate) => candidate.componentInstance.component === field)!;
          (pager.nativeElement as HTMLElement)
            .querySelector<HTMLButtonElement>('button[aria-label="Add empty after current"]')!
            .click();
          fixture.detectChanges();
          await fixture.whenStable();
          fixture.detectChanges();
        }
        const widget = registry.modelToUI.get(field)!;
        const report = () => context.dataContext.dataQualityReport!;
        const draftCode = type === 'temporal' ? 'incompleteValue' : 'attributeName';
        if (widget instanceof CedarInputDatetimeComponent) {
          widget.dateInputChanged(new Date(2026, 9, 3));
        } else {
          const attribute = widget as CedarInputAttributeValueComponent;
          attribute.valueInputControl.setValue('retain this draft');
          attribute.valueChanged({ target: { value: 'retain this draft' } } as unknown as Event);
          registry.updateViewToModel(field, context);
        }
        expect(report().problems.some((p) => p.code === draftCode && p.severity === 'error')).toBe(true);
        const initialProblems = report().problems;
        context.setCurrentIndex(parent, 1);
        registry.updateViewToModel(parent, context);
        context.buildQualityReport();
        expect(report().problems).toEqual(initialProblems);
        context.setCurrentIndex(parent, 0);
        registry.updateViewToModel(parent, context);
        if (widget instanceof CedarInputDatetimeComponent) expect(widget.datetimeParsed.dateIsSet).toBe(true);
        else expect((widget as CedarInputAttributeValueComponent).valueInputControl.value).toBe('retain this draft');
        expect(context.copyMultiInstance(parent)).toBe(true);
        registry.updateViewToModel(parent, context);
        expect(report().problems.filter((p) => p.code === draftCode && p.severity === 'error')).toHaveLength(2);
        expect(context.deleteMultiInstance(parent)).toBe(true);
        expect(report().problems.filter((p) => p.code === draftCode && p.severity === 'error')).toHaveLength(1);
        context.setCurrentIndex(parent, 0);
        registry.updateViewToModel(parent, context);
        if (widget instanceof CedarInputDatetimeComponent) widget.clearValue();
        else context.changeAttributeValue(field, 'finished', 'retain this draft');
        expect(report().problems.filter((p) => p.severity === 'error')).toEqual([]);
        fixture.destroy();
      });
    }
  });
}
