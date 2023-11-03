import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CedarInputPhoneComponent } from './cedar-input-phone.component';

describe('CedarInputPhoneComponent', () => {
  let component: CedarInputPhoneComponent;
  let fixture: ComponentFixture<CedarInputPhoneComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CedarInputPhoneComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CedarInputPhoneComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
