import {Component, EventEmitter, Input, OnInit, Output, ViewEncapsulation} from '@angular/core';


@Component({
  selector: 'app-file-uploader',
  templateUrl: './file-uploader.component.html',
  styleUrls: ['./file-uploader.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class FileUploaderComponent implements OnInit {

  @Input() fileAlias;
  @Input() httpUrl;
  @Output() fileUploaded = new EventEmitter<object>();

  constructor() {
  }

  ngOnInit(): void {
  }

  onFileUploaded(event): void {
    this.fileUploaded.emit(event);
  }

}
