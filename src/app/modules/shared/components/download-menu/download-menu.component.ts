import { Component, EventEmitter, Output, ViewEncapsulation, ChangeDetectionStrategy } from '@angular/core';
import { DOWNLOAD_ITEMS, DownloadItemId } from '../../models/ui/download-item.model';

/**
 * The developer's way to take CEE's views of an artifact away as files.
 *
 * CEE had a menu once and it was removed, so it is worth saying why this one is a
 * different shape. The preferences menu went because host configuration reached
 * the widgets *through* it: the read-only flag was an input on the menu, whose
 * setter was the only caller of `setReadOnlyMode`, so the control could overrule
 * the host and a viewer could be made editable from inside itself.
 *
 * This menu holds no state at all. Every entry is an action, it owns nothing the
 * host also sets, and saving a file cannot change the artifact, the mode or
 * anything a widget subscribes to. Whether the menu exists is the host's
 * decision, arriving by the ordinary configuration path rather than through here.
 */
@Component({
  selector: 'app-download-menu',
  templateUrl: './download-menu.component.html',
  styleUrls: ['./download-menu.component.scss'],
  encapsulation: ViewEncapsulation.Emulated,
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class DownloadMenuComponent {
  @Output() downloadRequested = new EventEmitter<DownloadItemId>();

  protected readonly items = DOWNLOAD_ITEMS;

  protected request(id: DownloadItemId): void {
    this.downloadRequested.emit(id);
  }
}
