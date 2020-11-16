import {async, ComponentFixture, TestBed} from '@angular/core/testing';
import {CedarStaticSectionBreakComponent} from './cedar-static-section-break.component';

describe('CedarStaticSectionBreakComponent', () => {
  let component: CedarStaticSectionBreakComponent;
  let fixture: ComponentFixture<CedarStaticSectionBreakComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [CedarStaticSectionBreakComponent]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(CedarStaticSectionBreakComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
