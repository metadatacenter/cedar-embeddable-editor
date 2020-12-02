import {async, ComponentFixture, TestBed} from '@angular/core/testing';
import {CedarFooBarComponent} from './cedar-foo-bar.component';

describe('CedarFooBarComponent', () => {
  let component: CedarFooBarComponent;
  let fixture: ComponentFixture<CedarFooBarComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [CedarFooBarComponent]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(CedarFooBarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
