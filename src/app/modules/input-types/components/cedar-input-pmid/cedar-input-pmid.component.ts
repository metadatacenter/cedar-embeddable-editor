import { AfterViewInit, Component, OnInit, ViewEncapsulation, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { ComponentDataService } from '../../../shared/service/component-data.service';
import { ActiveComponentRegistryService } from '../../../shared/service/active-component-registry.service';
import { ExternalAuthorityLookupService } from '../../../shared/service/external-authority-lookup.service';
import { AbstractAuthorityInputComponent } from '../authority/abstract-authority-input.component';
import {
  AuthorityDescriptor,
  authorityDescriptorFor,
} from '../../../shared/models/authority/authority-descriptor.model';
import { InputType } from '../../../shared/models/input-type.model';

/**
 * The PubMed field.
 *
 * All of the behaviour is in `AbstractAuthorityInputComponent` and all of the
 * markup is in `authority-input.component.html`; what is left here is which
 * authority this is. This file was 200-plus lines of the same
 * search-select-resolve flow every other authority field also had its own copy
 * of.
 */
@Component({
  selector: 'app-cedar-input-pmid',
  templateUrl: '../authority/authority-input.component.html',
  encapsulation: ViewEncapsulation.Emulated,
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class CedarInputPmidComponent extends AbstractAuthorityInputComponent implements OnInit, AfterViewInit {
  constructor(
    fb: FormBuilder,
    cds: ComponentDataService,
    activeComponentRegistry: ActiveComponentRegistryService,
    lookup: ExternalAuthorityLookupService,
  ) {
    super(fb, cds, activeComponentRegistry, lookup);
  }

  get descriptor(): AuthorityDescriptor {
    return authorityDescriptorFor(InputType.pmid)!;
  }
}
