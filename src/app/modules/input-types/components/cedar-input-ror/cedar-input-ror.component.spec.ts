import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CedarInputRorComponent } from './cedar-input-ror.component';

describe('CedarInputLinkComponent', () => {
  let component: CedarInputRorComponent;
  let fixture: ComponentFixture<CedarInputRorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CedarInputRorComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CedarInputRorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
