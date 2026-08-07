import { Component, Input, ViewEncapsulation } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { ComponentDataService } from '../../../shared/service/component-data.service';
import { CedarUIDirective } from '../../../shared/models/ui/cedar-ui-component.model';
import { ActiveComponentRegistryService } from '../../../shared/service/active-component-registry.service';
import { HandlerContext } from '../../../shared/util/handler-context';
import { StaticFieldComponent } from '../../../shared/models/static/static-field-component.model';
import { resolveStaticImageView, StaticImageView } from './static-image-view';

@Component({
    selector: 'app-cedar-static-image',
    templateUrl: './cedar-static-image.component.html',
    styleUrls: ['./cedar-static-image.component.scss'],
    encapsulation: ViewEncapsulation.Emulated,
    standalone: false
})
export class CedarStaticImageComponent extends CedarUIDirective {
  component: StaticFieldComponent;
  @Input() handlerContext: HandlerContext;

  view: StaticImageView = { src: null, error: null };
  private loadFailed = false;

  constructor(
    fb: FormBuilder,
    public cds: ComponentDataService,
    private activeComponentRegistry: ActiveComponentRegistryService,
  ) {
    super();
  }

  @Input() set componentToRender(componentToRender: StaticFieldComponent) {
    this.component = componentToRender;
    // A new field is a new URL: whatever the last one did to the browser says
    // nothing about this one.
    this.loadFailed = false;
    this.refreshView();
    this.activeComponentRegistry.registerComponent(this.component, this);
  }

  /**
   * The image is decorative only when the template gives nothing to say about
   * it. Falling back through the label and the field name keeps an empty
   * `schema:description` from emitting `alt=""`, which browsers and screen
   * readers both take as a deliberate "ignore this".
   */
  get altText(): string {
    return (
      this.component?.labelInfo?.description ||
      this.component?.labelInfo?.label ||
      this.component?.labelInfo?.preferredLabel ||
      this.component?.name ||
      'Image'
    );
  }

  onImageError(): void {
    this.loadFailed = true;
    this.refreshView();
  }

  private refreshView(): void {
    this.view = resolveStaticImageView(this.component?.contentInfo?.content, this.loadFailed);
  }

  setCurrentValue(_currentValue: any): void {
    // DO NOTHING
  }
}
