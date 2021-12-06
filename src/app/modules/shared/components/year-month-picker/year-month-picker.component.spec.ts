import {async, ComponentFixture, TestBed} from '@angular/core/testing';

import {YearMonthPickerComponent} from './year-month-picker.component';

describe('YearPickerComponent', () => {
  let component: YearMonthPickerComponent;
  let fixture: ComponentFixture<YearMonthPickerComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [YearMonthPickerComponent]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(YearMonthPickerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
