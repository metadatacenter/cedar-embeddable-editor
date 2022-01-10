import {Component, EventEmitter, Input, OnInit, Output, ViewEncapsulation} from '@angular/core';
import {HttpErrorResponse, HttpResponse} from '@angular/common/http';


@Component({
  selector: 'app-file-uploader',
  templateUrl: './file-uploader.component.html',
  styleUrls: ['./file-uploader.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class FileUploaderComponent implements OnInit {

  // Number of milliseconds to display the file upload success message
  private static readonly SUCCESS_MESSAGE_TIMEOUT = 5000;

  @Input() fileAlias;
  @Input() httpUrl;
  @Output() fileUploaded = new EventEmitter<object>();
  showSuccess = false;
  showError = false;
  successMessage = '';
  errorMessage = '';


  constructor() {
  }

  ngOnInit(): void {
  }

  onFileUploaded(event): void {
    if (event && event['event'] instanceof HttpResponse) {
      this.clearError();
      this.successMessage = 'Upload of ' + event['file']['name'] + ' succeeded';
      this.showSuccess = true;
      setTimeout(() => {
        this.clearSuccess();
      }, FileUploaderComponent.SUCCESS_MESSAGE_TIMEOUT);
    } else if (typeof event === 'object' && event['event'] instanceof HttpErrorResponse) {
      this.clearSuccess();
      this.errorMessage = 'Upload of ' + event['file']['name'] + ' failed';
      const response = event['event'];

      if (response['message'] && response['message'].length > 0) {
        this.errorMessage += ' with an error: ' + response['message'];
      }
      this.showError = true;
    }
    this.fileUploaded.emit(event);
  }

  clearSuccess(): void {
    this.showSuccess = false;
    this.successMessage = '';
  }

  clearError(): void {
    this.showError = false;
    this.errorMessage = '';
  }

}
