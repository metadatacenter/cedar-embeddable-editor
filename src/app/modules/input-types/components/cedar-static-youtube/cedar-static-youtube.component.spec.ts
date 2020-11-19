import {async, ComponentFixture, TestBed} from '@angular/core/testing';
import {CedarStaticYoutubeComponent} from './cedar-static-youtube.component';

describe('CedarStaticYoutubeComponent', () => {
  let component: CedarStaticYoutubeComponent;
  let fixture: ComponentFixture<CedarStaticYoutubeComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [CedarStaticYoutubeComponent]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(CedarStaticYoutubeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
