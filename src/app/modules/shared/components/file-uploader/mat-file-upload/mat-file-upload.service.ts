import {Injectable} from '@angular/core';
import {BehaviorSubject} from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class MatFileUploadService {

  private uploadedFileSubject = new BehaviorSubject<object>(null);
  uploadedFile$ = this.uploadedFileSubject.asObservable();


  setUploadedFile(file): void {
    this.uploadedFileSubject.next(file);
  }

  getUploadedFile(): object {
    return this.uploadedFileSubject.getValue();
  }

}
