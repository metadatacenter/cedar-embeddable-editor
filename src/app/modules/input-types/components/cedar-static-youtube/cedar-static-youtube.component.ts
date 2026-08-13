import { Component, Input, ViewEncapsulation, ChangeDetectionStrategy } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ComponentDataService } from '../../../shared/service/component-data.service';
import { CedarUIDirective } from '../../../shared/models/ui/cedar-ui-component.model';
import { ActiveComponentRegistryService } from '../../../shared/service/active-component-registry.service';
import { HandlerContext } from '../../../shared/util/handler-context';
import { StaticFieldComponent } from '../../../shared/models/static/static-field-component.model';
import { resolveStaticYoutubeView } from './static-youtube-view';
import { DEFAULT_YOUTUBE_SIZE, resolveYoutubeSize } from './static-youtube-size';

@Component({
  selector: 'app-cedar-static-youtube',
  templateUrl: './cedar-static-youtube.component.html',
  styleUrls: ['./cedar-static-youtube.component.scss'],
  encapsulation: ViewEncapsulation.Emulated,
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class CedarStaticYoutubeComponent extends CedarUIDirective {
  component!: StaticFieldComponent;
  @Input({ required: true }) handlerContext!: HandlerContext;
  // What the template asked for, or the size CEE has always used. Not readonly
  // any more: these follow `componentToRender`, which changes while a renderer
  // instance is reused.
  videoWidth: number = DEFAULT_YOUTUBE_SIZE.width;
  videoHeight: number = DEFAULT_YOUTUBE_SIZE.height;
  videoEmbedUrl: SafeResourceUrl | null = null;
  contentError: string | null = null;

  constructor(
    public cds: ComponentDataService,
    private activeComponentRegistry: ActiveComponentRegistryService,
    private sanitizer: DomSanitizer,
  ) {
    super();
  }

  @Input({ required: true }) set componentToRender(componentToRender: StaticFieldComponent) {
    this.component = componentToRender;
    const view = resolveStaticYoutubeView(componentToRender.contentInfo?.content);
    this.videoEmbedUrl = view.videoId
      ? this.sanitizer.bypassSecurityTrustResourceUrl(`https://www.youtube.com/embed/${view.videoId}`)
      : null;
    this.contentError = view.error;
    const size = resolveYoutubeSize(componentToRender.contentInfo?.width, componentToRender.contentInfo?.height);
    this.videoWidth = size.width;
    this.videoHeight = size.height;
    this.activeComponentRegistry.registerComponent(this.component, this);
  }

  get videoTitle(): string {
    return (
      this.component?.labelInfo?.label ||
      this.component?.labelInfo?.preferredLabel ||
      this.component?.name ||
      'YouTube video'
    );
  }

  setCurrentValue(_currentValue: unknown): void {
    // DO NOTHING
  }
}
