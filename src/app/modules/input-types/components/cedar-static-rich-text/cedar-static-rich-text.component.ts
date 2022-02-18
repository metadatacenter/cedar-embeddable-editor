import {Component, Input, OnInit, ViewEncapsulation} from '@angular/core';
import {StaticFieldComponent} from '../../../shared/models/static/static-field-component.model';
import {CedarUIComponent} from '../../../shared/models/ui/cedar-ui-component.model';
import {ActiveComponentRegistryService} from '../../../shared/service/active-component-registry.service';

@Component({
  selector: 'app-cedar-static-rich-text',
  templateUrl: './cedar-static-rich-text.component.html',
  styleUrls: ['./cedar-static-rich-text.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class CedarStaticRichTextComponent extends CedarUIComponent implements OnInit {

  component: StaticFieldComponent;


  constructor(private activeComponentRegistry: ActiveComponentRegistryService) {
    super();
  }

  ngOnInit(): void {
  }

  @Input() set componentToRender(componentToRender: StaticFieldComponent) {
    this.component = componentToRender;
    this.activeComponentRegistry.registerComponent(this.component, this);
  }

  setCurrentValue(currentValue: any): void {
    // not applicable to rich text component
  }

}
