import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OrcidDetailsComponent } from './orcid-details.component';

describe('OrcidDetailsComponent', () => {
  let component: OrcidDetailsComponent;
  let fixture: ComponentFixture<OrcidDetailsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ OrcidDetailsComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OrcidDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
