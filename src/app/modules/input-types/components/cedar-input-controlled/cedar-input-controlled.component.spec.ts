import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CedarInputControlledComponent } from './cedar-input-controlled.component';

describe('CedarInputControlledComponent', () => {
  let component: CedarInputControlledComponent;
  let fixture: ComponentFixture<CedarInputControlledComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CedarInputControlledComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CedarInputControlledComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
