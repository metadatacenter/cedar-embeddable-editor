import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MatFileUploadQueueComponent} from './mat-file-upload-queue.component';
import {MatProgressBarModule} from '@angular/material/progress-bar';
import {MatCardModule} from '@angular/material/card';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {CommonModule} from '@angular/common';

describe('MatFileUploadQueueComponent', () => {
  let component: MatFileUploadQueueComponent;
  let fixture: ComponentFixture<MatFileUploadQueueComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        MatProgressBarModule,
        MatCardModule,
        MatButtonModule,
        MatIconModule,
        CommonModule,
      ],
      declarations: [MatFileUploadQueueComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MatFileUploadQueueComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should add file', () => {
    expect(component.files).toEqual([]);
    component.add(new Blob());
    expect(component.files.length).toBe(1);
  });

  it('should add more file', () => {
    expect(component.files).toEqual([]);
    component.add(new Blob());
    component.add(new Blob());
    component.add(new Blob());
    expect(component.files.length).toBe(3);
  });

  it('should remove all files', () => {
    expect(component.files).toEqual([]);
    component.add(new Blob());
    component.add(new Blob());
    component.add(new Blob());
    expect(component.files.length).toBe(3);
    component.removeAll();
    expect(component.files).toEqual([]);
  });
});
