import { Directive, ElementRef, OnDestroy, OnInit, inject } from '@angular/core';
import { CdkTextareaAutosize } from '@angular/cdk/text-field';

/** Apply the shared density to autosizing textareas through CDK's public API. */
@Directive({ selector: 'textarea[cdkTextareaAutosize]', standalone: true })
export class ControlDensityDirective implements OnInit, OnDestroy {
  private readonly element = inject<ElementRef<HTMLTextAreaElement>>(ElementRef).nativeElement;
  private readonly autosize = inject(CdkTextareaAutosize);
  private observer?: MutationObserver;
  ngOnInit(): void {
    const root = this.element.getRootNode();
    const host = root instanceof ShadowRoot ? root.host : null;
    const apply = () => {
      const rows = Number(getComputedStyle(this.element).getPropertyValue('--_cedar-textarea-rows').trim());
      this.autosize.minRows = rows > 0 ? rows : 6;
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
