import { ChangeDetectionStrategy, Component, Input, ViewEncapsulation } from '@angular/core';
import { FieldComponent } from '../../models/component/field-component.model';
import { bioPortalSourceLink, bioPortalTermLink } from '../../util/bioportal-term-link';
import { SpecTermSource, specDefaultTermOf, specTermSourcesOf } from '../../util/field-spec';

/**
 * The box a field shows when it is read and holds nothing: the same rectangle a control draws, saying
 * what a value must be instead of holding one.
 *
 * It replaces the control rather than dressing it, for two reasons a placeholder cannot meet. A
 * placeholder is one line, so a pattern beside a count and a unit is truncated at any narrow width,
 * and this wraps. And a placeholder is text, so an ontology cannot be a link, where here each
 * authority is one, pointing at its own BioPortal page.
 *
 * Only where there is nothing to hold. A radio or checkbox group draws its own options and an
 * attribute-value pair names its two halves, so those keep their controls and state their facts
 * beside the field's name; an instance keeps every control, because then the box has a value to show.
 */
@Component({
  selector: 'app-cedar-spec-box',
  templateUrl: './cedar-spec-box.component.html',
  styleUrls: ['./cedar-spec-box.component.scss'],
  encapsulation: ViewEncapsulation.Emulated,
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class CedarSpecBoxComponent {
  @Input({ required: true }) fieldToDescribe!: FieldComponent;

  /** The declared default when it is a term, which can be linked, rather than text, which cannot. */
  get defaultTerm(): { readonly label: string; readonly uri: string } | null {
    return specDefaultTermOf(this.fieldToDescribe);
  }

  /** Where that term can be read about, built the way the field's own value link is. */
  get defaultTermLink(): string | null {
    const term = this.defaultTerm;
    return term === null ? null : bioPortalTermLink(this.fieldToDescribe.controlledInfo, term.uri);
  }

  get termSources(): ReadonlyArray<SpecTermSource> {
    return specTermSourcesOf(this.fieldToDescribe);
  }

  /** Where the authority can be read about, or null when it names no acronym to address it by. */
  linkFor(source: SpecTermSource): string | null {
    return bioPortalSourceLink(source);
  }
}
