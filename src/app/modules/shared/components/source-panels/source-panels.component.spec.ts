import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { SourcePanelsComponent } from './source-panels.component';

describe('SourcePanelsComponent', () => {
  let component: SourcePanelsComponent;
  let fixture: ComponentFixture<SourcePanelsComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ SourcePanelsComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(SourcePanelsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
