import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { CedarInputTextfieldComponent } from './cedar-input-textfield.component';

describe('CedarInputTextfieldComponent', () => {
  let component: CedarInputTextfieldComponent;
  let fixture: ComponentFixture<CedarInputTextfieldComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ CedarInputTextfieldComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(CedarInputTextfieldComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
