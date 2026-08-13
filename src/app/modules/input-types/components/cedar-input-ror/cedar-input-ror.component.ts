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
 * The ROR field.
 *
 * All of the behaviour is in `AbstractAuthorityInputComponent` and all of the
 * markup is in `authority-input.component.html`; what is left here is which
 * authority this is.
 *
 * It was 340 lines, and the reason was the details panel. ROR and ORCID each
 * showed an organisation or researcher record behind an "i" button, built from a
 * detail document with its own shape — so each kept its own template, its own
 * copy of the search-select-resolve flow, a detail cache, and a model tree for
 * the response. The five other authority fields had already collapsed onto this
 * base; these two could not, because of the panel.
 *
 * With the panel gone they render the external link every other authority field
 * renders, and there is nothing authority-specific left to hold.
 */
@Component({
  selector: 'app-cedar-input-ror',
  templateUrl: '../authority/authority-input.component.html',
  encapsulation: ViewEncapsulation.Emulated,
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class CedarInputRorComponent extends AbstractAuthorityInputComponent implements OnInit, AfterViewInit {
  constructor(
    fb: FormBuilder,
    cds: ComponentDataService,
    activeComponentRegistry: ActiveComponentRegistryService,
    lookup: ExternalAuthorityLookupService,
  ) {
    super(fb, cds, activeComponentRegistry, lookup);
  }

  get descriptor(): AuthorityDescriptor {
    return authorityDescriptorFor(InputType.ror)!;
  }
}
