import {
  AfterViewChecked,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  Optional,
  SimpleChanges,
  ViewEncapsulation,
} from '@angular/core';
import { CedarComponent } from '../../models/component/cedar-component.model';
import { ElementComponent } from '../../models/component/element-component.model';
import { MultiElementComponent } from '../../models/element/multi-element-component.model';
import { FieldComponent } from '../../models/component/field-component.model';
import { MultiFieldComponent } from '../../models/field/multi-field-component.model';
import { HandlerContext } from '../../util/handler-context';
import { PageBreakPaginatorService } from '../../service/page-break-paginator.service';
import { ComponentRenderDecision, decideComponentRender } from './component-render-decision';
import { specHeaderFactsOf } from '../../util/field-spec';
import { FieldRevealService, RevealTarget } from '../../service/field-reveal.service';
import { ShortenedName } from '../cedar-component-header/cedar-component-header.component';

@Component({
  selector: 'app-cedar-component-renderer',
  templateUrl: './cedar-component-renderer.component.html',
  styleUrls: ['./cedar-component-renderer.component.scss'],
  encapsulation: ViewEncapsulation.Emulated,
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class CedarComponentRendererComponent implements OnChanges, AfterViewChecked, OnDestroy, RevealTarget {
  renderDecision: ComponentRenderDecision | null = null;
  panelOpenState = false;
  /** An element's name while its header shortens it, which the header then shows in a tooltip. */
  shortenedName: ShortenedName | null = null;
  private shown: CedarComponent | null = null;
  private pagerLayoutObserver: ResizeObserver | null = null;
  private pagerLayoutTargets: Element[] = [];
  private observedPanel: HTMLElement | null = null;

  /*
   * Both optional, and null by default, because a renderer is also built by hand to
   * test its decisions, where nothing is on a page to reveal.
   */
  constructor(
    @Optional() private readonly elementRef: ElementRef<HTMLElement> | null = null,
    @Optional() private readonly reveal: FieldRevealService | null = null,
  ) {}

  get host(): HTMLElement | null {
    return this.elementRef?.nativeElement ?? null;
  }
  @Input({ required: true }) handlerContext!: HandlerContext;
  @Input({ required: true }) pageBreakPaginatorService!: PageBreakPaginatorService;
  // tslint:disable-next-line:variable-name
  private _allExpanded = false;
  @Input()
  get allExpanded(): boolean {
    return this._allExpanded;
  }

  set allExpanded(allExpanded: boolean) {
    this.panelOpenState = allExpanded;
    this._allExpanded = allExpanded;
  }
  @Input({ required: true }) set componentToRender(componentToRender: CedarComponent) {
    this.renderDecision = decideComponentRender(componentToRender);
    if (this.shown !== null) {
      this.reveal?.unregisterTarget(this.shown, this);
    }
    this.shown = componentToRender;
    this.reveal?.registerTarget(componentToRender, this);
  }

  ngOnDestroy(): void {
    this.pagerLayoutObserver?.disconnect();
    if (this.shown !== null) {
      this.reveal?.unregisterTarget(this.shown, this);
    }
  }

  ngAfterViewChecked(): void {
    const panel =
      this.renderDecision?.kind === 'element'
        ? (this.host?.querySelector<HTMLElement>(':scope > mat-accordion > mat-expansion-panel') ?? null)
        : null;
    this.observedPanel = panel;
    this.observeElementPagerLayout(panel);
    this.updateElementPagerPlacement();
  }

  /**
   * Measure again when the heading or the pager's chips or actions change size. The panel is not
   * observed: the stacking class changes its height, and an observed box that its own observer's
   * callback resizes is a ResizeObserver loop. The heading spans the panel's width, so a width change
   * still arrives, and the chips and actions report paging and added or removed occurrences. The
   * targets follow the rendered nodes, which a later render can replace.
   */
  private observeElementPagerLayout(panel: HTMLElement | null): void {
    const heading = panel?.querySelector(':scope > mat-expansion-panel-header');
    const pager = panel?.querySelector('.mat-expansion-panel-body')?.querySelector(':scope > app-cedar-multi-pager');
    const targets =
      heading && pager && typeof ResizeObserver !== 'undefined'
        ? [heading, ...pager.querySelectorAll(':scope > div > .pager-chips, :scope > div > .pager-actions')]
        : [];
    const unchanged =
      targets.length === this.pagerLayoutTargets.length &&
      targets.every((target, index) => target === this.pagerLayoutTargets[index]);
    if (unchanged) return;
    this.pagerLayoutObserver?.disconnect();
    this.pagerLayoutTargets = targets;
    if (targets.length === 0) {
      this.pagerLayoutObserver = null;
      return;
    }
    this.pagerLayoutObserver ??= new ResizeObserver(() => this.updateElementPagerPlacement());
    for (const target of targets) this.pagerLayoutObserver.observe(target);
  }

  private updateElementPagerPlacement(): void {
    const panel = this.observedPanel;
    if (!panel || panel.getBoundingClientRect().width === 0) return;
    const heading = panel.querySelector(':scope > mat-expansion-panel-header');
    const body = panel.querySelector('.mat-expansion-panel-body');
    const pager = body?.querySelector<HTMLElement>(':scope > app-cedar-multi-pager');
    if (!heading || !pager) return;
    const controls = [...pager.querySelectorAll('mat-chip-option, button')]
      .map((control) => control.getBoundingClientRect())
      .filter((box) => box.width > 0);
    // Collapsed panels have no visible pager geometry yet.
    if (controls.length === 0) return;
    const firstControl = Math.min(...controls.map((box) => box.left));
    const text = [...heading.querySelectorAll('.title-label, .multi-instance-range')].flatMap((label) => {
      const range = document.createRange();
      range.selectNodeContents(label);
      return [...range.getClientRects()];
    });
    const stacked = text.some((box) => box.right + 8 > firstControl);
    if (pager.classList.contains('stacked-element-pager') !== stacked) {
      pager.classList.toggle('stacked-element-pager', stacked);
    }
  }

  /** Expand the element's panel, so a reveal can reach what it holds. */
  open(): void {
    this.panelOpenState = true;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['componentToRender'] && this.renderDecision?.kind === 'unsupported') {
      this.handlerContext.messageHandlerService.error(this.renderDecision.reason);
    }
  }

  shouldRenderContentOfIterable(iterableComponent: ElementComponent): boolean {
    if (iterableComponent instanceof MultiElementComponent) {
      if (!this.handlerContext.multiInstanceObjectService.hasMultiInstances(iterableComponent)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Whether to draw the occurrence pager for a repeating field.
   *
   * It exists to move between occurrences, so it earns its place when there are occurrences to move
   * between. Reading a template on its own there are none: every occurrence the bounds imply is
   * empty and identical, and the chips sit on the field's title row where they collide with the
   * specification. An instance keeps its pager — that is how a reader reaches occurrence two.
   */
  shouldRenderOccurrencePager(): boolean {
    return !this.handlerContext.statesSpecification;
  }

  /**
   * Whether the occurrence chips can share a read-only field's title row.
   *
   * The earlier read-only placement always made a second row because some fields put terse facts
   * beside their name. Most fields put that specification in their control instead, leaving the
   * title row empty on the right; those can keep the chips beside the name without covering
   * anything. Editable placement and narrow-width stacking remain unchanged.
   */
  shouldInlineReadOnlyPager(nonIterableComponent: FieldComponent): boolean {
    return (
      this.handlerContext.readOnlyMode &&
      nonIterableComponent instanceof MultiFieldComponent &&
      this.shouldRenderOccurrencePager() &&
      (this.handlerContext.multiInstanceObjectService.getMultiInstanceInfoForComponent(nonIterableComponent)
        ?.currentCount ?? 0) > 1 &&
      specHeaderFactsOf(nonIterableComponent).length === 0
    );
  }

  shouldRenderContentOfNonIterable(nonIterableComponent: FieldComponent): boolean {
    if (nonIterableComponent instanceof MultiFieldComponent) {
      if (
        nonIterableComponent.isMultiPage() &&
        !this.handlerContext.multiInstanceObjectService.hasMultiInstances(nonIterableComponent)
      ) {
        // Editing, an unoccupied repeating field is its add control and nothing else, which is right:
        // there is no occurrence to show until someone adds one. Read-only still draws the empty
        // field, whether the host supplied an instance or only a template: an optional field omitted
        // by an instance remains part of the form a reader is inspecting. Rendering the widget does
        // not create an occurrence; it only keeps the field's empty visual affordance present.
        return this.handlerContext.readOnlyMode;
      }
    }
    return true;
  }
}
