import { ComponentFixture, TestBed } from '@angular/core/testing';
import {CedarInputEmailComponent} from './cedar-input-email.component';


describe('CedarInputEmailComponent', () => {
  let component: CedarInputEmailComponent;
  let fixture: ComponentFixture<CedarInputEmailComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ CedarInputEmailComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CedarInputEmailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
