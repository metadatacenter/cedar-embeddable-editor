import {async, ComponentFixture, TestBed} from '@angular/core/testing';

import {CedarInputCheckboxComponent} from './cedar-input-checkbox.component';

describe('CedarInputCheckboxComponent', () => {
  let component: CedarInputCheckboxComponent;
  let fixture: ComponentFixture<CedarInputCheckboxComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [CedarInputCheckboxComponent]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(CedarInputCheckboxComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
