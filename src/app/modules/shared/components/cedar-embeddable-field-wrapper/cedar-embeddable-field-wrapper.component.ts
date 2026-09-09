import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Input,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { Overlay, OverlayContainer, OverlayPositionBuilder } from '@angular/cdk/overlay';
import { AriaDescriber } from '@angular/cdk/a11y';
import { HttpClient } from '@angular/common/http';
import { TranslateLoader, TranslateService, provideChildTranslateService } from '@ngx-translate/core';
import type { JsonNode } from 'cedar-model-typescript-library';

import * as fallbackMapEN from '../../../../../assets/i18n-cee/en.json';
import * as fallbackMapHU from '../../../../../assets/i18n-cee/hu.json';
import type {
  CedarEmbeddableFieldChangeDetail,
  CedarEmbeddableFieldConfig,
  CedarEmbeddableFieldValue,
  CeeEventHandler,
  CeeJsonObject,
} from '../../../../cee-public-api';
import { CedarComponent } from '../../models/component/cedar-component.model';
import { FieldComponent } from '../../models/component/field-component.model';
import { CedarAriaDescriber } from '../../service/cedar-aria-describer.service';
import { CedarOverlayContainer } from '../../service/cedar-overlay-container.service';
import { ActiveComponentRegistryService } from '../../service/active-component-registry.service';
import { ControlledFieldDataService } from '../../service/controlled-field-data.service';
import { ExternalAuthorityLookupService } from '../../service/external-authority-lookup.service';
import { GlobalSettingsContextService } from '../../service/global-settings-context.service';
import { MessageHandlerService } from '../../service/message-handler.service';
import { RenderSchedulerService } from '../../service/render-scheduler.service';
import { TemplateTrustService } from '../../service/template-trust.service';
import { UserPreferencesService } from '../../service/user-preferences.service';
import { CeeConfig } from '../../util/config-reader';
import { DataContext } from '../../util/data-context';
import { FallbackTranslateLoaderFactory } from '../../util/fallback-translate-loader-factory';
import { HandlerContext } from '../../util/handler-context';
import { WidgetConfigCoordinator } from '../../util/widget-config-coordinator';
import { WrapperConfigCoordinator } from '../../util/wrapper-config-coordinator';
import { readFieldValue, sameFieldValue, writeFieldValue } from '../../util/cedar-field-value';
import { templateForField } from '../../util/single-field-template';
import { decideComponentRender } from '../cedar-component-renderer/component-render-decision';

/** Nothing held, which is where every field starts and what an unfilled one reports. */
const NOTHING: CedarEmbeddableFieldValue = { kind: 'none' };

/** One field, parsed and ready to render. */
interface FieldRuntime {
  readonly dataContext: DataContext;
  readonly handlerContext: HandlerContext;
  /** What the widget draws, which may be a static block. */
  readonly component: CedarComponent;
  /** The same component where it holds a value, and null where it is a static block. */
  readonly valueComponent: FieldComponent | null;
}

/**
 * The `cedar-embeddable-field` element: one field's control, and a value in and out
 * of it.
 *
 * The editor's own wrapper is the sibling of this one, and the two differ in what they
 * are handed rather than in what they draw. That one takes a template and renders a
 * form of the widgets; this one takes a field and renders one of them. Both reach the
 * widget through `CedarFieldWidgetComponent`, so a control behaves the same in a form
 * and on its own, and neither can drift from the other by being changed alone.
 *
 * The provider block is the editor wrapper's, and has to be: the widgets read their
 * services from the component that encloses them, and the two that matter most here
 * are scoped rather than global on purpose. `CedarOverlayContainer` puts an
 * autocomplete panel or a datepicker inside this element's shadow root, which is what
 * keeps it styled and inside the boundary; the translation service is a subtree of its
 * own, so two of these on one page can be in two languages.
 *
 * A field is wrapped in a synthetic one-field template before anything is built from
 * it. `single-field-template.ts` says why, and what that wrapping deliberately leaves
 * out.
 */
@Component({
  selector: 'app-cedar-embeddable-field-wrapper',
  templateUrl: './cedar-embeddable-field-wrapper.component.html',
  styleUrls: ['./cedar-embeddable-field-wrapper.component.scss'],
  encapsulation: ViewEncapsulation.ShadowDom,
  providers: [
    { provide: AriaDescriber, useClass: CedarAriaDescriber },
    { provide: OverlayContainer, useClass: CedarOverlayContainer },
    OverlayPositionBuilder,
    Overlay,
    ActiveComponentRegistryService,
    ControlledFieldDataService,
    ExternalAuthorityLookupService,
    GlobalSettingsContextService,
    MessageHandlerService,
    RenderSchedulerService,
    TemplateTrustService,
    UserPreferencesService,
    ...provideChildTranslateService({
      loader: {
        provide: TranslateLoader,
        useFactory: (
          http: HttpClient,
          messageHandlerService: MessageHandlerService,
          globalSettingsContextService: GlobalSettingsContextService,
        ) =>
          FallbackTranslateLoaderFactory(http, messageHandlerService, globalSettingsContextService, {
            en: fallbackMapEN,
            hu: fallbackMapHU,
          }),
        deps: [HttpClient, MessageHandlerService, GlobalSettingsContextService],
      },
    }),
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class CedarEmbeddableFieldWrapperComponent implements OnInit, OnDestroy {
  /** The context the template binds to, replaced whole whenever a field is accepted. */
  dataContext: DataContext = new DataContext();
  handlerContext: HandlerContext;
  renderedComponent: CedarComponent | null = null;

  private initialized = false;
  private readonly configuration: WrapperConfigCoordinator;
  private readonly widgetConfig: WidgetConfigCoordinator;
  private runtime: FieldRuntime | null = null;
  /**
   * The value a host assigned, kept because it can arrive before the field does and
   * has to survive the field being replaced.
   */
  private assignedValue: CedarEmbeddableFieldValue | null = null;
  private lastPublished: CedarEmbeddableFieldValue = NOTHING;
  /** Raised while a host's own assignment is being written, so it is not echoed back. */
  private applyingAssignedValue = false;

  constructor(
    private readonly host: ElementRef<HTMLElement>,
    private readonly changeDetector: ChangeDetectorRef,
    private readonly activeComponentRegistry: ActiveComponentRegistryService,
    private readonly controlledFieldDataService: ControlledFieldDataService,
    private readonly externalAuthorityLookupService: ExternalAuthorityLookupService,
    private readonly globalSettingsContextService: GlobalSettingsContextService,
    private readonly messageHandlerService: MessageHandlerService,
    private readonly renderScheduler: RenderSchedulerService,
    private readonly templateTrustService: TemplateTrustService,
    private readonly translateService: TranslateService,
    private readonly userPreferencesService: UserPreferencesService,
  ) {
    this.handlerContext = new HandlerContext(this.dataContext, this.messageHandlerService);
    this.configuration = new WrapperConfigCoordinator(
      this.controlledFieldDataService,
      this.messageHandlerService,
      this.translateService,
      this.globalSettingsContextService,
    );
    this.widgetConfig = new WidgetConfigCoordinator(
      this.externalAuthorityLookupService,
      this.templateTrustService,
      this.userPreferencesService,
    );
  }

  ngOnInit(): void {
    this.initialized = true;
    this.applyConfiguration();
  }

  ngOnDestroy(): void {
    this.activeComponentRegistry.clear();
  }

  /** DOM control events are implementation traffic; `valueChange` publishes the contract. */
  suppressNativeChange(event: Event): void {
    event.stopPropagation();
  }

  /**
   * The field to render.
   *
   * Rejected as a whole or not at all: the field is parsed and its widget resolved
   * before anything replaces what is on screen, so an unreadable artifact leaves the
   * previous field standing rather than blanking the element.
   */
  @Input() set fieldObject(field: CeeJsonObject | null) {
    if (field === null) {
      return;
    }
    const runtime = this.buildRuntime(field);
    if (runtime !== null) {
      this.install(runtime);
    }
  }

  /** What the field should hold. See the public API for what a mismatched kind does. */
  @Input() set value(value: CedarEmbeddableFieldValue | null) {
    if (value === null) {
      return;
    }
    this.assignedValue = value;
    this.applyAssignedValue();
  }

  /** Configuration, which takes one assignment. */
  @Input() set config(value: CedarEmbeddableFieldConfig | null) {
    if (value === null || !this.configuration.accept(value as CeeConfig)) {
      return;
    }
    this.applyConfiguration();
  }

  @Input() set eventHandler(value: CeeEventHandler) {
    this.messageHandlerService.injectEventHandler(value);
  }

  /** What the field holds. */
  @Input() get currentValue(): CedarEmbeddableFieldValue {
    const runtime = this.runtime;
    return runtime === null || runtime.valueComponent === null
      ? NOTHING
      : readFieldValue(runtime.valueComponent, runtime.handlerContext);
  }

  /** Whether what it holds satisfies the field's own constraints. */
  @Input() get currentValueValid(): boolean {
    return this.runtime?.dataContext.dataQualityReport?.isValid === true;
  }

  /**
   * Parse a field into everything needed to render it, or report why it cannot be.
   *
   * A field CEE has no widget for is named here rather than drawn as a blank: the
   * widget answers `none` for anything it cannot route, because a form walking a
   * template and an element handed one artifact are owed different messages, and this
   * is the one that owes the host a sentence about the artifact it just supplied.
   */
  private buildRuntime(field: CeeJsonObject): FieldRuntime | null {
    let dataContext: DataContext;
    let handlerContext: HandlerContext;
    try {
      const template = templateForField(field as JsonNode);
      dataContext = new DataContext();
      handlerContext = new HandlerContext(dataContext, this.messageHandlerService);
      dataContext.setInputTemplate(template, handlerContext, null);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.messageHandlerService.error(
        `cedar-embeddable-field: "fieldObject" rejected because it is not a readable CEDAR field: ${detail}`,
      );
      return null;
    }

    const children = dataContext.templateRepresentation?.children ?? [];
    const component = children[0];
    if (component === undefined) {
      this.messageHandlerService.error(
        'cedar-embeddable-field: "fieldObject" rejected because it yielded no field to render.',
      );
      return null;
    }

    const decision = decideComponentRender(component);
    if (decision.kind === 'field') {
      return { dataContext, handlerContext, component, valueComponent: decision.component };
    }
    if (decision.kind === 'static') {
      /*
       * Except a page break, which is not a thing to draw. It divides a form into
       * pages, and a form is the one thing this element does not have — so rendering
       * it would put an empty element on the host's page with nothing to say why.
       */
      if (decision.renderer === 'page-break') {
        this.messageHandlerService.error(
          'cedar-embeddable-field: "fieldObject" rejected because a page break divides a form into pages and has nothing to ' +
            'render on its own.',
        );
        return null;
      }
      return { dataContext, handlerContext, component, valueComponent: null };
    }
    this.messageHandlerService.error(
      `cedar-embeddable-field: "fieldObject" rejected. ${
        decision.kind === 'unsupported' ? decision.reason : 'It is not a field.'
      }`,
    );
    return null;
  }

  private install(runtime: FieldRuntime): void {
    this.activeComponentRegistry.clear();
    this.runtime = runtime;
    this.dataContext = runtime.dataContext;
    this.handlerContext = runtime.handlerContext;
    this.renderedComponent = runtime.component;
    this.handlerContext.setMutationListener(() => this.publishValue());
    /*
     * The baseline is what the field starts out holding, which for a field declaring
     * its own default is that default. Left at nothing, the first thing to touch the
     * instance would announce the default as though somebody had just chosen it.
     */
    this.lastPublished = this.currentValue;
    this.redraw();
    this.applyConfiguration();
    this.applyAssignedValue();
    this.scheduleWidgetSync();
  }

  /**
   * Tell Angular the view is out of date, because a host assignment is not a binding.
   *
   * A property set on the element goes through `@angular/elements`, which marks the
   * view itself; a property set on this component directly — which is what a test does,
   * and what any other host of the component would do — marks nothing, and under
   * zoneless change detection nothing then refreshes. Saying it here covers both,
   * rather than making correctness depend on which of the two paths was taken.
   */
  private redraw(): void {
    this.changeDetector.markForCheck();
  }

  /**
   * Apply the host's configuration, once there is something for it to reach.
   *
   * Two coordinators, because configuration lands in two places: the widgets read
   * three settings from their own services, and the rest — the terminology endpoint,
   * the languages, read-only on the handler context — is what the editor's wrapper
   * applies and is applied the same way here.
   */
  private applyConfiguration(): void {
    if (!this.initialized || (!this.configuration.hasConfiguration && this.runtime === null)) {
      return;
    }
    const config = this.configuration.config ?? {};
    this.configuration.apply(this.handlerContext);
    this.widgetConfig.apply(config, this.handlerContext.readOnlyMode);
  }

  /**
   * Put the host's value into the field.
   *
   * Read-only rendering turns on what the value says: with a value in it the field
   * shows the value, and with none it states what it will accept instead. That is the
   * same distinction the editor draws between an instance and a bare template, and it
   * is `instanceSupplied` in both places.
   */
  private applyAssignedValue(): void {
    const runtime = this.runtime;
    const value = this.assignedValue;
    if (runtime === null || value === null) {
      return;
    }
    runtime.handlerContext.instanceSupplied = value.kind !== 'none';
    if (runtime.valueComponent === null) {
      if (value.kind !== 'none') {
        this.messageHandlerService.error('cedar-embeddable-field: "value" ignored, because a static field holds none.');
      }
      return;
    }

    this.applyingAssignedValue = true;
    try {
      const refusal = writeFieldValue(value, runtime.valueComponent, runtime.handlerContext);
      if (refusal !== null) {
        this.messageHandlerService.error(`cedar-embeddable-field: ${refusal}`);
      }
    } finally {
      this.applyingAssignedValue = false;
    }
    this.lastPublished = this.currentValue;
    this.redraw();
    this.scheduleWidgetSync();
  }

  /** Push the model into the live widget once Angular has built it. */
  private scheduleWidgetSync(): void {
    const runtime = this.runtime;
    if (runtime === null) {
      return;
    }
    void this.renderScheduler
      .schedule(() => {
        this.activeComponentRegistry.updateViewToModel(runtime.component, runtime.handlerContext);
        this.lastPublished = this.currentValue;
      })
      .then((rendered) => {
        if (rendered) {
          this.messageHandlerService.ready();
        }
      })
      .catch((error) => {
        const detail = error instanceof Error ? error.message : String(error);
        this.messageHandlerService.error(`cedar-embeddable-field: the field could not be rendered: ${detail}`);
      });
  }

  /**
   * Announce what the field now holds, when it holds something different.
   *
   * A host's own assignment is not announced back to it, and neither is a mutation
   * that leaves the value where it was — focus, a paged occurrence, a keystroke that
   * replaces a character with itself.
   */
  private publishValue(): void {
    if (this.applyingAssignedValue) {
      return;
    }
    const value = this.currentValue;
    if (sameFieldValue(value, this.lastPublished)) {
      return;
    }
    this.lastPublished = value;
    const detail: CedarEmbeddableFieldChangeDetail = { value, valid: this.currentValueValid };
    this.host.nativeElement.dispatchEvent(
      new CustomEvent<CedarEmbeddableFieldChangeDetail>('valueChange', { detail, bubbles: true, composed: true }),
    );
  }
}
