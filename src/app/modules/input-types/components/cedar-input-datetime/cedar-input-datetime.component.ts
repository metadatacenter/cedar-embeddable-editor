import {Component, Input, OnInit, ViewEncapsulation} from '@angular/core';
import {FieldComponent} from '../../../shared/models/component/field-component.model';
import {FormBuilder, FormControl, FormGroup} from '@angular/forms';
import {ComponentDataService} from '../../../shared/service/component-data.service';
import {CedarUIComponent} from '../../../shared/models/ui/cedar-ui-component.model';
import {ActiveComponentRegistryService} from '../../../shared/service/active-component-registry.service';
import {HandlerContext} from '../../../shared/util/handler-context';
import {DatePickerComponent} from '../../../shared/components/date-picker/date-picker.component';


@Component({
  selector: 'app-cedar-input-datetime',
  templateUrl: './cedar-input-datetime.component.html',
  styleUrls: ['./cedar-input-datetime.component.scss'],
  encapsulation: ViewEncapsulation.None,
})






export class CedarInputDatetimeComponent extends CedarUIComponent implements OnInit {

  readonly YEAR_FORMAT = DatePickerComponent.YEAR_FORMAT;
  readonly YEAR_MONTH_FORMAT = DatePickerComponent.YEAR_MONTH_FORMAT;
  readonly YEAR_MONTH_DAY_FORMAT = DatePickerComponent.YEAR_MONTH_DAY_FORMAT;

  component: FieldComponent;
  activeComponentRegistry: ActiveComponentRegistryService;

  timePickerTime: Date;
  enableMeridian = true;
  disableMinute = true;
  showSeconds = true;


  showYearPicker = true;



  @Input() handlerContext: HandlerContext;

  constructor(fb: FormBuilder, public cds: ComponentDataService, activeComponentRegistry: ActiveComponentRegistryService) {
    super();
    this.activeComponentRegistry = activeComponentRegistry;
  }

  ngOnInit(): void {
    this.timePickerTime = new Date();
    this.timePickerTime.setHours(0,0,0,0);
  }












  @Input() set componentToRender(componentToRender: FieldComponent) {
    this.component = componentToRender;
    this.activeComponentRegistry.registerComponent(this.component, this);
  }

  inputChanged(event): void {
  }

  setCurrentValue(currentValue: any): void {
  }

}
