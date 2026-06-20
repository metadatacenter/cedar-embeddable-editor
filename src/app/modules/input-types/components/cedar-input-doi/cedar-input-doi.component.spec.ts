import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CedarInputDoiComponent } from './cedar-input-doi.component';

describe('CedarInputDoiComponent', () => {
  let component: CedarInputDoiComponent;
  let fixture: ComponentFixture<CedarInputDoiComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ CedarInputDoiComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CedarInputDoiComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
