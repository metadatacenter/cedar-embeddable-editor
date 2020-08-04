import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { StaticHeaderComponent } from './static-header.component';

describe('StaticHeaderComponent', () => {
  let component: StaticHeaderComponent;
  let fixture: ComponentFixture<StaticHeaderComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ StaticHeaderComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(StaticHeaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
