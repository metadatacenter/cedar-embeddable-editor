import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CedarInputNihGrantComponent } from './cedar-input-nih-grant.component';

describe('CedarInputNihGrantComponent', () => {
  let component: CedarInputNihGrantComponent;
  let fixture: ComponentFixture<CedarInputNihGrantComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ CedarInputNihGrantComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CedarInputNihGrantComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
