import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CedarInputMultipleChoiceComponent } from './cedar-input-multiple-choice.component';

describe('CedarInputMultipleChoiceComponent', () => {
  let component: CedarInputMultipleChoiceComponent;
  let fixture: ComponentFixture<CedarInputMultipleChoiceComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CedarInputMultipleChoiceComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CedarInputMultipleChoiceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
