import {Component, EventEmitter, Input, OnInit, Output, ViewEncapsulation} from '@angular/core';
import {HttpErrorResponse, HttpResponse} from '@angular/common/http';
import {TranslateService} from '@ngx-translate/core';


@Component({
    selector: 'app-file-uploader',
    templateUrl: './file-uploader.component.html',
    styleUrls: ['./file-uploader.component.scss'],
    encapsulation: ViewEncapsulation.None
})
export class FileUploaderComponent implements OnInit {

    // Number of milliseconds to display the file upload success message
    private static readonly SUCCESS_MESSAGE_TIMEOUT = 5000;

    @Input() fileAlias: string;
    @Input() httpUrl: string;
    @Output() fileUploaded = new EventEmitter<object>();
    showSuccess = false;
    showError = false;
    successMessage = '';
    errorMessage = '';

    protected translateService: TranslateService;

    constructor(translateService: TranslateService) {
        this.translateService = translateService;
    }

    ngOnInit(): void {
    }

    onFileUploaded(event): void {
        if (event && event.event instanceof HttpResponse) {
            this.clearError();
            const fileName = event.file.name;
            this.successMessage = this.translateService.instant('Uploader.Success', {fileName});
            this.showSuccess = true;
            setTimeout(() => {
                this.clearSuccess();
            }, FileUploaderComponent.SUCCESS_MESSAGE_TIMEOUT);
        } else if (typeof event === 'object' && event.event instanceof HttpErrorResponse) {
            this.clearSuccess();
            const fileName = event.file.name;
            let responseMessage = '';
            const response = event.event;
            if (response.message && response.message.length > 0) {
                responseMessage = response.message;
            }
            this.errorMessage = this.translateService.instant('Uploader.Error', {fileName, responseMessage});
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
