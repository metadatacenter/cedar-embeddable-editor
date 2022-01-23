import {Directive, Output, EventEmitter, HostBinding, HostListener} from '@angular/core';

@Directive({
  selector: '[appDnd]'
})
export class DndDirective {

  @HostBinding('class.fileover') fileOver: boolean;


  // Dragover listener
  @HostListener('dragover', ['$event'])
  onDragOver(evt): void {
    evt.preventDefault();
    evt.stopPropagation();
    this.fileOver = true;
  }

  // Dragleave listener
  @HostListener('dragleave', ['$event'])
  public onDragLeave(evt): void {
    evt.preventDefault();
    evt.stopPropagation();
    this.fileOver = false;
  }

  // Drop listener
  @HostListener('drop', ['$event'])
  public ondrop(evt): void {
    evt.preventDefault();
    evt.stopPropagation();
    this.fileOver = false;
  }

}
