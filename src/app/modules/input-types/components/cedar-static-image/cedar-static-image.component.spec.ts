import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CedarStaticImageComponent } from './cedar-static-image.component';

describe('CedarStaticImageComponent', () => {
  let component: CedarStaticImageComponent;
  let fixture: ComponentFixture<CedarStaticImageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CedarStaticImageComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CedarStaticImageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
