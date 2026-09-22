import { Directive, Input, inject } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { MatIcon, MatIconRegistry } from '@angular/material/icon';
import { getIcon, iconSvg } from '@org.metadatacenter/cedar-design-tokens/icons';

/** Material owns the host behavior; the shared package owns all icon geometry. */
@Directive({ selector: 'mat-icon[cedarIcon]', standalone: true, host: { class: 'cedar-icon' } })
export class CedarIconDirective {
  private readonly icon = inject(MatIcon);
  private readonly registry = inject(MatIconRegistry);
  private readonly sanitizer = inject(DomSanitizer);
  @Input({ required: true }) set cedarIcon(name: string) {
    const canonical = getIcon(name).name;
    // Only SVG generated from the build-validated registry crosses this boundary.
    this.registry.addSvgIconLiteralInNamespace(
      'cedar',
      canonical,
      this.sanitizer.bypassSecurityTrustHtml(iconSvg(canonical)),
    );
    this.icon.svgIcon = 'cedar:' + canonical;
  }
}
