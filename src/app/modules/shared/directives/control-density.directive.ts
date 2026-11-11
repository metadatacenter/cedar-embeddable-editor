import { Directive, ElementRef, OnDestroy, OnInit, inject } from '@angular/core';
import { CdkTextareaAutosize } from '@angular/cdk/text-field';

/**
 * Marks the growing box that holds a read-only line of text. A long value wraps in it, and a short
 * one keeps the one row of the line it replaces.
 */
export const LINE_VALUE_CLASS = 'cee-line-value';

/**
 * Apply the shared density to autosizing textareas through CDK's public API.
 *
 * A paragraph starts at the density's rows. A line value states no rows, so it starts at one. Both
 * are measured again when the density changes, since that changes the line they are set in.
 */
@Directive({ selector: 'textarea[cdkTextareaAutosize]', standalone: true })
export class ControlDensityDirective implements OnInit, OnDestroy {
  private readonly element = inject<ElementRef<HTMLTextAreaElement>>(ElementRef).nativeElement;
  private readonly autosize = inject(CdkTextareaAutosize);
  private observer?: MutationObserver;
  ngOnInit(): void {
    const root = this.element.getRootNode();
    const host = root instanceof ShadowRoot ? root.host : null;
    const lineValue = this.element.classList.contains(LINE_VALUE_CLASS);
    const apply = () => {
      if (!lineValue) {
        const rows = Number(getComputedStyle(this.element).getPropertyValue('--_cedar-textarea-rows').trim());
        this.autosize.minRows = rows > 0 ? rows : 6;
      }
      this.autosize.resizeToFitContent(true);
    };
    apply();
    if (host) {
      this.observer = new MutationObserver(apply);
      this.observer.observe(host, { attributes: true, attributeFilter: ['density', 'style'] });
    }
  }
  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}
