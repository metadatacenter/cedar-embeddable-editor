import {
  AfterViewChecked,
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  NgZone,
  OnDestroy,
  Optional,
  Output,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { CedarComponent } from '../../models/component/cedar-component.model';
import { ComponentDataService } from '../../service/component-data.service';
import { MultiComponent } from '../../models/component/multi-component.model';
import { ComponentTypeHandler } from '../../handler/component-type.handler';
import { SingleFieldComponent } from '../../models/field/single-field-component.model';
import { FieldComponent } from '../../models/component/field-component.model';
import { MultiFieldComponent } from '../../models/field/multi-field-component.model';
import { StaticFieldComponent } from '../../models/static/static-field-component.model';
import { InputType } from '../../models/input-type.model';
import { fieldTypeIcon } from '../../util/field-type-icon';
import { DescriptionLink } from '../../a11y/message-links';
import { textLanguageOf, uiLanguageOf } from '../../a11y/language-tag';
import { GlobalSettingsContextService } from '../../service/global-settings-context.service';

/** An element's name, which its header shows in full in a tooltip while the header shortens it. */
export interface ShortenedName {
  readonly text: string;
  /** The language the template declares for the name, as a `lang` tag, or null. */
  readonly language: string | null;
}

@Component({
  selector: 'app-cedar-component-header',
  templateUrl: './cedar-component-header.component.html',
  styleUrls: ['./cedar-component-header.component.scss'],
  encapsulation: ViewEncapsulation.Emulated,
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class CedarComponentHeaderComponent implements AfterViewInit, AfterViewChecked, OnDestroy {
  private static nextId = 0;
  /** The id of the visually hidden text holding the description. Unique within the page. */
  readonly descriptionId = `cee-description-${CedarComponentHeaderComponent.nextId++}`;
  component!: CedarComponent;
  /** Null for a component that is not multi-instance, which is most of them. */
  multiComponent: MultiComponent | null = null;
  shouldRenderRequiredMark = false;
  fieldTypeIcon: string | null = null;
  isOntologyField = false;
  /**
   * The field whose specification belongs beside this label, or null for an element, a template or a
   * static field — none of which constrains a value. Set from the same two classes the renderer tests,
   * so the two agree about what a field is.
   */
  fieldToDescribe: FieldComponent | null = null;
  private readonly describedHeading = new DescriptionLink();
  @ViewChild('titleLabel') private titleLabel?: ElementRef<HTMLElement>;
  private nameObserver: ResizeObserver | null = null;
  private nameShortened = false;

  /**
   * An element's name while its header is too narrow for it and ends it in an ellipsis, and null once
   * the name fits again. Emitted when that changes, so the panel header can show the whole name.
   */
  @Output() readonly shortenedName = new EventEmitter<ShortenedName | null>();

  /**
   * Whether the description is drawn as text below this header, which read-only fields do. The header
   * then leaves out its own visually hidden copy, so a screen reader does not read it twice.
   */
  @Input() descriptionDrawn = false;

  constructor(
    public cds: ComponentDataService,
    // Optional, so a spec can build the component without a view.
    @Optional() private readonly elementRef: ElementRef<HTMLElement> | null = null,
    @Optional() private readonly translate: TranslateService | null = null,
    @Optional() private readonly globalSettings: GlobalSettingsContextService | null = null,
    @Optional() private readonly zone: NgZone | null = null,
  ) {}

  /**
   * Watch an element's name for the ellipsis. A narrower header shrinks the label the name is clipped
   * to. A face that loads late can widen the name without resizing the label, so the name is measured
   * again once the fonts are in.
   */
  ngAfterViewInit(): void {
    const label = this.titleLabel?.nativeElement;
    if (this.disclosure === null || !label || typeof ResizeObserver === 'undefined') {
      return;
    }
    const measure = () => this.measureName(label);
    this.nameObserver = new ResizeObserver(measure);
    this.nameObserver.observe(label);
    void label.ownerDocument.fonts?.ready.then(measure);
  }

  /** Whether the name is wider than the label that clips it, and so ends in an ellipsis. */
  private measureName(label: HTMLElement): void {
    const text = label.ownerDocument.createRange();
    text.selectNodeContents(label);
    const shortened = text.getBoundingClientRect().width > label.getBoundingClientRect().width + 0.5;
    if (shortened === this.nameShortened) {
      return;
    }
    this.nameShortened = shortened;
    const name: ShortenedName | null = shortened
      ? { text: this.cds.getRenderingLabelForComponent(this.component), language: this.textLanguage }
      : null;
    // A resize is reported outside Angular's zone, and the panel header's tooltip is bound to this.
    if (this.zone) {
      this.zone.run(() => this.shortenedName.emit(name));
    } else {
      this.shortenedName.emit(name);
    }
  }

  /**
   * Describe an element's panel header with the element's description. A field's description is
   * tied to its controls by the presentation that draws them.
   */
  ngAfterViewChecked(): void {
    const host = this.elementRef?.nativeElement;
    const heading = this.disclosure === null ? null : host?.closest('mat-expansion-panel-header');
    const text = host?.querySelector(`[id="${this.descriptionId}"]`);
    this.describedHeading.set(text ? this.descriptionId : null, heading ? [heading] : []);
  }

  ngOnDestroy(): void {
    this.nameObserver?.disconnect();
    this.describedHeading.clear();
  }

  /**
   * Whether the element this header belongs to is expanded, or null for a header that does not
   * open and close. The panel header is the control; the chevron only shows its state.
   */
  @Input() disclosure: boolean | null = null;

  /** The language the template declares for the label and description, as a `lang` tag, or null. */
  get textLanguage(): string | null {
    return textLanguageOf(this.component);
  }

  /**
   * The `lang` CEE's own text takes inside the marked label: CEE's language where the template
   * declares one for the label, and none otherwise, since it then takes CEE's language from the root.
   */
  get uiLanguageMark(): string | null {
    return this.textLanguage !== null && this.translate && this.globalSettings
      ? uiLanguageOf(this.translate, this.globalSettings)
      : null;
  }

  @Input({ required: true }) set componentToRender(componentToRender: CedarComponent) {
    this.component = componentToRender;
    this.fieldToDescribe =
      componentToRender instanceof SingleFieldComponent || componentToRender instanceof MultiFieldComponent
        ? (componentToRender as FieldComponent)
        : null;
    this.shouldRenderRequiredMark = false;
    this.fieldTypeIcon = null;
    this.isOntologyField = false;

    if (componentToRender instanceof StaticFieldComponent && componentToRender.basicInfo.inputType) {
      this.fieldTypeIcon = fieldTypeIcon(componentToRender.basicInfo.inputType);
    }

    if (ComponentTypeHandler.isMulti(componentToRender)) {
      this.multiComponent = componentToRender as MultiComponent;
      if (this.multiComponent instanceof MultiFieldComponent) {
        const _multiToFieldComp = this.multiComponent as MultiFieldComponent;
        if (_multiToFieldComp.valueInfo.requiredValue) {
          this.shouldRenderRequiredMark = true;
        }
      }
    } else {
      this.multiComponent = null;
    }
    if (this.component instanceof SingleFieldComponent || this.component instanceof MultiFieldComponent) {
      const fieldComp = this.component as unknown as FieldComponent;
      const inputType = fieldComp.basicInfo.inputType;
      if (inputType) {
        this.fieldTypeIcon = fieldTypeIcon(inputType);
        this.isOntologyField = inputType === InputType.controlled;
      }
      if (fieldComp.valueInfo.requiredValue) {
        this.shouldRenderRequiredMark = true;
      }
    }
  }
}
