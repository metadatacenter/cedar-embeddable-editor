import {async, ComponentFixture, TestBed} from '@angular/core/testing';
import {CedarStaticImageComponent} from './cedar-static-image.component';

describe('CedarStaticSectionBreakComponent', () => {
  let component: CedarStaticImageComponent;
  let fixture: ComponentFixture<CedarStaticImageComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [CedarStaticImageComponent]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(CedarStaticImageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
