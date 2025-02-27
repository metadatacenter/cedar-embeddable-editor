import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CedarInputOrcidComponent } from './cedar-input-orcid.component';

describe('CedarInputLinkComponent', () => {
  let component: CedarInputOrcidComponent;
  let fixture: ComponentFixture<CedarInputOrcidComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CedarInputOrcidComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CedarInputOrcidComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
