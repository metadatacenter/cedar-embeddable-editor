import { ComponentFixture, TestBed} from '@angular/core/testing';

import {CedarInputDatetimeComponent} from './cedar-input-datetime.component';

describe('CedarInputDatetimeComponent', () => {
  let component: CedarInputDatetimeComponent;
  let fixture: ComponentFixture<CedarInputDatetimeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CedarInputDatetimeComponent]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CedarInputDatetimeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
