import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { CedarDataSaverComponent } from './cedar-data-saver.component';

describe('CedarDataSaverComponent', () => {
  let component: CedarDataSaverComponent;
  let fixture: ComponentFixture<CedarDataSaverComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ CedarDataSaverComponent ]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(CedarDataSaverComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
