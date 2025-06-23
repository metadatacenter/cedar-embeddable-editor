import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CedarInputPfasComponent } from './cedar-input-pfas.component';

describe('CedarInputPfasComponent', () => {
  let component: CedarInputPfasComponent;
  let fixture: ComponentFixture<CedarInputPfasComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ CedarInputPfasComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CedarInputPfasComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
