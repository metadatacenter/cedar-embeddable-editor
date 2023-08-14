import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CedarStaticPageBreakComponent } from './cedar-static-page-break.component';

describe('CedarStaticPageBreakComponent', () => {
  let component: CedarStaticPageBreakComponent;
  let fixture: ComponentFixture<CedarStaticPageBreakComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ CedarStaticPageBreakComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CedarStaticPageBreakComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
