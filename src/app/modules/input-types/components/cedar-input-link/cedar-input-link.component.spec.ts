import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import {CedarInputLinkComponent} from './cedar-input-link.component';


describe('CedarInputLinkComponent', () => {
  let component: CedarInputLinkComponent;
  let fixture: ComponentFixture<CedarInputLinkComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ CedarInputLinkComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(CedarInputLinkComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
