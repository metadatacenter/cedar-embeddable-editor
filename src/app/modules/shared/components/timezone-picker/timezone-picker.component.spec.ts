import {ComponentFixture, TestBed} from '@angular/core/testing';

import {TimezonePickerComponent} from './timezone-picker.component';

describe('TimezonePickerComponent', () => {
  let component: TimezonePickerComponent;
  let fixture: ComponentFixture<TimezonePickerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TimezonePickerComponent]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TimezonePickerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
