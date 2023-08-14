import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SampleTemplateSelectComponent } from './sample-template-select.component';

describe('SampleTemplateSelectComponent', () => {
  let component: SampleTemplateSelectComponent;
  let fixture: ComponentFixture<SampleTemplateSelectComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SampleTemplateSelectComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SampleTemplateSelectComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
