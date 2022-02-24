import {Directive, ElementRef, EventEmitter, HostBinding, HostListener, Input, Output} from '@angular/core';

/**
 * A material design file upload queue component.
 */
@Directive({
  selector: 'input[fileUploadInputFor], div[fileUploadInputFor], mat-card[fileUploadInputFor]',
})
export class FileUploadInputForDirective {

  private _queue: any = null;
  private _element: HTMLElement;
  @Output() public onFileSelected: EventEmitter<File[]> = new EventEmitter<File[]>();
  @HostBinding('class.fileover') fileOver: boolean;


  constructor(private element: ElementRef) {
    this._element = this.element.nativeElement;
  }

  @Input('fileUploadInputFor')
  set fileUploadQueue(value: any) {
    if (value) {
      this._queue = value;
    }
  }

  @HostListener('change')
  public onChange(): any {
    const files = this.element.nativeElement.files;
    this.onFileSelected.emit(files);

    for (let i = 0; i < files.length; i++) {
      this._queue.add(files[i]);
    }
    this.element.nativeElement.value = '';
  }

  @HostListener('drop', ['$event'])
  public onDrop(event: any): any {
    const files = event.dataTransfer.files;
    this.onFileSelected.emit(files);

    for (let i = 0; i < files.length; i++) {
      this._queue.add(files[i]);
    }
    event.preventDefault();
    event.stopPropagation();
    this.element.nativeElement.value = '';
    this.fileOver = false;
  }

  @HostListener('dragover', ['$event'])
  public onDropOver(event: any): any {
    event.preventDefault();
    event.stopPropagation();
    this.fileOver = true;
  }

  @HostListener('dragleave', ['$event'])
  public onDragLeave(event): void {
    event.preventDefault();
    event.stopPropagation();
    this.fileOver = false;
  }

}
