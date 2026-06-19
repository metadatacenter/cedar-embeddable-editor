import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CedarComponentRendererComponent } from './cedar-component-renderer.component';
import { MultiFieldComponent } from '../../models/field/multi-field-component.model';
import { InputType } from '../../models/input-type.model';
import { HandlerContext } from '../../util/handler-context';

describe('CedarComponentRendererComponent', () => {
  let component: CedarComponentRendererComponent;
  let fixture: ComponentFixture<CedarComponentRendererComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CedarComponentRendererComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CedarComponentRendererComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('shouldRenderContentOfNonIterable', () => {
    it('should return true for a multi non-multipage list field even if it has 0 instances', () => {
      const field = new MultiFieldComponent();
      field.basicInfo.inputType = InputType.list;

      expect(field.isMulti()).toBeTrue();
      expect(field.isMultiPage()).toBeFalse();

      const result = component.shouldRenderContentOfNonIterable(field);
      expect(result).toBeTrue();
    });

    it('should return false for a multi multipage text field if it has 0 instances', () => {
      const field = new MultiFieldComponent();
      field.basicInfo.inputType = InputType.text;

      expect(field.isMulti()).toBeTrue();
      expect(field.isMultiPage()).toBeTrue();

      const mockService = jasmine.createSpyObj('MultiInstanceObjectHandler', ['hasMultiInstances']);
      mockService.hasMultiInstances.and.returnValue(false);

      const mockHandlerContext = {
        multiInstanceObjectService: mockService
      } as unknown as HandlerContext;

      component.handlerContext = mockHandlerContext;

      const result = component.shouldRenderContentOfNonIterable(field);
      expect(result).toBeFalse();
      expect(mockService.hasMultiInstances).toHaveBeenCalledWith(field);
    });

    it('should return true for a multi multipage text field if it has instances', () => {
      const field = new MultiFieldComponent();
      field.basicInfo.inputType = InputType.text;

      expect(field.isMulti()).toBeTrue();
      expect(field.isMultiPage()).toBeTrue();

      const mockService = jasmine.createSpyObj('MultiInstanceObjectHandler', ['hasMultiInstances']);
      mockService.hasMultiInstances.and.returnValue(true);

      const mockHandlerContext = {
        multiInstanceObjectService: mockService
      } as unknown as HandlerContext;

      component.handlerContext = mockHandlerContext;

      const result = component.shouldRenderContentOfNonIterable(field);
      expect(result).toBeTrue();
      expect(mockService.hasMultiInstances).toHaveBeenCalledWith(field);
    });
  });
});
