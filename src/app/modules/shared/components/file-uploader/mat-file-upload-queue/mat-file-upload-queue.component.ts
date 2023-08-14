import {
  Component, ChangeDetectionStrategy, ContentChildren, forwardRef, OnDestroy, OnChanges,
  QueryList, SimpleChanges, Input, ChangeDetectorRef, AfterViewInit
} from '@angular/core';
import {Subscription, Observable, merge} from 'rxjs';
import {HttpHeaders, HttpParams} from '@angular/common/http';
import {startWith} from 'rxjs/operators';
import {MatFileUploadQueueService} from './mat-file-upload-queue.service';
import {MatFileUploadComponent} from '../mat-file-upload/mat-file-upload.component';

@Component({
  selector: 'mat-file-upload-queue',
  templateUrl: './mat-file-upload-queue.component.html',
  styleUrls: ['./mat-file-upload-queue.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [MatFileUploadQueueService],
})
export class MatFileUploadQueueComponent implements OnChanges, OnDestroy, AfterViewInit {
  @ContentChildren(forwardRef(() => MatFileUploadComponent))
  fileUploads: QueryList<MatFileUploadComponent>;

  /** Subscription to remove changes in files. */
  private _fileRemoveSubscription: Subscription | null;

  /** Subscription to changes in the files. */
  private _changeSubscription: Subscription;

  /** Combined stream of all of the file upload remove change events. */
  get fileUploadRemoveEvents(): Observable<MatFileUploadComponent> {
    return merge(
      ...this.fileUploads.map((fileUpload) => fileUpload.removeEvent)
    );
  }

  public files: Array<any> = [];

  ngOnChanges(changes: SimpleChanges): void {
    this.matFileUploadQueueService.initialize({
      httpUrl: changes['httpUrl'] ? changes['httpUrl'].currentValue : undefined,
      httpRequestHeaders: changes['httpRequestHeaders']
        ? changes['httpRequestHeaders'].currentValue
        : undefined,
      httpRequestParams: changes['httpRequestParams']
        ? changes["httpRequestParams"].currentValue
        : undefined,
      fileAlias: changes['fileAlias']
        ? changes['fileAlias'].currentValue
        : undefined,
    });
  }

  constructor(private matFileUploadQueueService: MatFileUploadQueueService, private changeDetectorRef: ChangeDetectorRef) {
  }

  /* Http request input bindings */
  @Input()
  httpUrl: string;

  @Input()
  httpRequestHeaders:
    | HttpHeaders
    | {
        [header: string]: string | string[];
      } = new HttpHeaders();

  @Input()
  httpRequestParams:
    | HttpParams
    | {
        [param: string]: string | string[];
      } = new HttpParams();

  @Input()
  fileAlias = 'file';

  @Input()
  uploadAllColor = 'primary';

  @Input()
  uploadAllLabel = 'Upload All';

  @Input()
  removeAllColor = 'primary';

  @Input()
  removeAllLabel = 'Remove All';

  ngAfterViewInit(): void {
    // When the list changes, re-subscribe
    this._changeSubscription = this.fileUploads.changes
      .pipe(startWith(null))
      .subscribe(() => {
        if (this._fileRemoveSubscription) {
          this._fileRemoveSubscription.unsubscribe();
        }
        this._listenTofileRemoved();
      });
  }

  private _listenTofileRemoved(): void {
    this._fileRemoveSubscription = this.fileUploadRemoveEvents.subscribe(
      (event: MatFileUploadComponent) => {
        this.files.splice(event.id, 1);
        this.changeDetectorRef.markForCheck();
      }
    );
  }

  add(file: any): void {
    this.files.push(file);
    this.changeDetectorRef.markForCheck();
  }

  public uploadAll(): void {
    this.fileUploads.forEach((fileUpload) => {
      fileUpload.upload();
    });
  }

  public removeAll(): void {
    this.files.splice(0, this.files.length);
    this.changeDetectorRef.markForCheck();
  }

  ngOnDestroy(): void {
    if (this._changeSubscription) {
      this._changeSubscription.unsubscribe();
    }

    if (this._fileRemoveSubscription) {
      this._fileRemoveSubscription.unsubscribe();
    }

    if (this.files) {
      this.removeAll();
    }
  }

}
