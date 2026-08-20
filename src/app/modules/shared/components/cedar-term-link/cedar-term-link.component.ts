import { ChangeDetectionStrategy, Component, Input, ViewEncapsulation } from '@angular/core';

/**
 * A term a field holds, read rather than edited: its label, and its identifier as a link.
 *
 * Read-only these fields showed `asthma - http://purl.obolibrary.org/obo/DOID_2841` inside a
 * readonly `input`, so the identifier was text a reader had to select and paste. An `input` cannot
 * contain an anchor, which is why it was: the box has to stop being a control before the identifier
 * can be a destination. So read-only with a value renders this instead — the same rectangle, the
 * same two halves, and the identifier addressable.
 *
 * The authority's own link-out keeps its place through content projection: it belongs to the widget
 * that knows which authority it is, and for a controlled term it points somewhere else entirely —
 * the term's BioPortal page rather than the term IRI, which is two destinations worth having.
 */
@Component({
  selector: 'app-cedar-term-link',
  templateUrl: './cedar-term-link.component.html',
  styleUrls: ['./cedar-term-link.component.scss'],
  encapsulation: ViewEncapsulation.Emulated,
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class CedarTermLinkComponent {
  /** What the term is called, which is what a reader reads. */
  @Input() label: string | null = null;

  /** What it is, which is what a reader follows. Rendered as text when it is not addressable. */
  @Input() iri: string | null = null;

  /** Named for assistive technology, since the box is a value and not a control. */
  @Input({ required: true }) fieldLabel!: string;

  /**
   * Whether the identifier can be followed. An `http` or `https` IRI addresses something a browser
   * can open; a `urn:`, a bare CURIE or anything else identifies without locating, and a link to it
   * would go nowhere.
   */
  get isAddressable(): boolean {
    return this.iri !== null && /^https?:\/\//.test(this.iri);
  }
}
