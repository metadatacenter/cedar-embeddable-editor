import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CedarInputPmidComponent } from './cedar-input-pmid.component';

describe('CedarInputPmidComponent', () => {
  let component: CedarInputPmidComponent;
  let fixture: ComponentFixture<CedarInputPmidComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ CedarInputPmidComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CedarInputPmidComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
