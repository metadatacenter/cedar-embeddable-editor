import {ComponentFixture, TestBed} from '@angular/core/testing';

import {CedarInputTextComponent} from './cedar-input-text.component';

describe('CedarInputTextComponent', () => {
  let component: CedarInputTextComponent;
  let fixture: ComponentFixture<CedarInputTextComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CedarInputTextComponent]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CedarInputTextComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
