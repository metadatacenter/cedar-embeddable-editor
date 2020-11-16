import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { CedarInputNumericComponent } from './cedar-input-numeric.component';

describe('CedarInputNumericComponent', () => {
  let component: CedarInputNumericComponent;
  let fixture: ComponentFixture<CedarInputNumericComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ CedarInputNumericComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(CedarInputNumericComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
