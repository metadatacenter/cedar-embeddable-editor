import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatRadioModule } from '@angular/material/radio';
import { MatInputModule } from '@angular/material/input';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { TranslateModule } from '@ngx-translate/core';
import { CedarInputMultipleChoiceComponent } from './cedar-input-multiple-choice.component';
import { ActiveComponentRegistryService } from '../../../shared/service/active-component-registry.service';
import { HandlerContext } from '../../../shared/util/handler-context';
import { SingleFieldComponent } from '../../../shared/models/field/single-field-component.model';

describe('CedarInputMultipleChoiceComponent', () => {
  let component: CedarInputMultipleChoiceComponent;
  let fixture: ComponentFixture<CedarInputMultipleChoiceComponent>;
  let mockRegistry: jasmine.SpyObj<ActiveComponentRegistryService>;
  let mockHandlerContext: jasmine.SpyObj<HandlerContext>;

  beforeEach(async () => {
    mockRegistry = jasmine.createSpyObj('ActiveComponentRegistryService', ['registerComponent']);
    mockHandlerContext = jasmine.createSpyObj('HandlerContext', ['changeValue', 'getDataObjectNodeByPath']);

    await TestBed.configureTestingModule({
      imports: [
        ReactiveFormsModule,
        MatFormFieldModule,
        MatRadioModule,
        MatInputModule,
        NoopAnimationsModule,
        TranslateModule.forRoot()
      ],
      declarations: [CedarInputMultipleChoiceComponent],
      providers: [
        FormBuilder,
        { provide: ActiveComponentRegistryService, useValue: mockRegistry }
      ]
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CedarInputMultipleChoiceComponent);
    component = fixture.componentInstance;
    component.handlerContext = mockHandlerContext;

    const field = new SingleFieldComponent();
    field.choiceInfo.choices = [
      { label: 'Private', selectedByDefault: false },
      { label: 'Limited', selectedByDefault: true },
      { label: 'Public', selectedByDefault: false }
    ] as any;
    component.component = field;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize control and load default values when no value is pre-set', () => {
    mockHandlerContext.getDataObjectNodeByPath.and.returnValue(null);
    fixture.detectChanges(); // triggers ngOnInit

    expect(component.selectedChoiceInputControl.value).toBe('Limited');
    expect(component.selected).toBe('Limited');
    expect(mockHandlerContext.changeValue).toHaveBeenCalledWith(component.component, 'Limited');
  });

  it('should NOT overwrite an already set value with the default value on load', () => {
    mockHandlerContext.getDataObjectNodeByPath.and.returnValue({ '@value': 'Private' });
    fixture.detectChanges(); // triggers ngOnInit

    expect(component.selectedChoiceInputControl.value).toBe('Private');
    expect(mockHandlerContext.changeValue).not.toHaveBeenCalledWith(component.component, 'Limited');
  });
});
