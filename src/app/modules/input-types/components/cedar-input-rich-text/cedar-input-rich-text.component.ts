import {Component, Input, OnInit, ViewEncapsulation} from '@angular/core';
import {StaticFieldComponent} from '../../../shared/models/static/static-field-component.model';
import {FormBuilder, FormControl} from '@angular/forms';
import {ComponentDataService} from '../../../shared/service/component-data.service';
import {CedarUIComponent} from '../../../shared/models/ui/cedar-ui-component.model';
import {ActiveComponentRegistryService} from '../../../shared/service/active-component-registry.service';
import {HandlerContext} from '../../../shared/util/handler-context';
// import * as ClassicEditor from '@ckeditor/ckeditor5-build-classic';

@Component({
  selector: 'app-cedar-input-rich-text',
  templateUrl: './cedar-input-rich-text.component.html',
  styleUrls: ['./cedar-input-rich-text.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class CedarInputRichTextComponent extends CedarUIComponent implements OnInit {

  component: StaticFieldComponent;
  inputValueControl = new FormControl(null, null);
  activeComponentRegistry: ActiveComponentRegistryService;
  @Input() handlerContext: HandlerContext;
  // public Editor = ClassicEditor;

  constructor(fb: FormBuilder, public cds: ComponentDataService, activeComponentRegistry: ActiveComponentRegistryService) {
    super();
    this.activeComponentRegistry = activeComponentRegistry;
  }

  ngOnInit(): void {
  }

  @Input() set componentToRender(componentToRender: StaticFieldComponent) {
    this.component = componentToRender;
    this.activeComponentRegistry.registerComponent(this.component, this);
  }

  setCurrentValue(currentValue: any): void {
    // DO NOTHING
  }

}
