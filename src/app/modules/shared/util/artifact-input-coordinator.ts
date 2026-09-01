import type { CeeJsonObject, CeeTemplateAndInstance } from '../../../cee-public-api';
import type { TemplateInstance } from 'cedar-model-typescript-library';
import { DataContext } from './data-context';
import { HandlerContext } from './handler-context';
import { InstanceDeserializer } from './instance-deserializer';
import { MessageHandlerService } from '../service/message-handler.service';

type ArtifactClaim = 'template' | 'instance';

export interface ArtifactEditorState {
  readonly dataContext: DataContext;
  readonly handlerContext: HandlerContext;
  readonly templateJson: CeeJsonObject | null;
  readonly instanceJson: CeeJsonObject | null;
  readonly templateAndInstanceJson: CeeTemplateAndInstance | null;
  readonly revision: number;
}

/**
 * Accepts the overlapping host artifact inputs as atomic editor states.
 *
 * Parsing into a candidate context before publishing it is the important part:
 * a malformed template cannot consume its set-once claim, and a failure halfway
 * through initialization cannot leave the live context half replaced. The inner
 * Angular component receives the completed state and renders it; it never parses
 * the host artifact a second time.
 */
export class ArtifactInputCoordinator {
  private readonly claimed = new Set<ArtifactClaim>();
  private acceptedTemplate: CeeJsonObject | null = null;
  private acceptedInstanceJson: CeeJsonObject | null = null;
  private nextRevision = 0;
  private _instanceInputRejected = false;
  private _state: ArtifactEditorState;

  constructor(private readonly messages: MessageHandlerService) {
    this._state = this.contextOnly(null, false);
  }

  get state(): ArtifactEditorState {
    return this._state;
  }

  get instanceInputRejected(): boolean {
    return this._instanceInputRejected;
  }

  acceptTemplate(template: CeeJsonObject): boolean {
    if (!this.mayAcceptTemplate()) {
      return false;
    }
    // An instance accepted before its template is already the live waiting
    // state. Re-read the host document for the candidate so template building
    // cannot mutate that live model before the whole transaction succeeds.
    const instance =
      this.acceptedInstanceJson === null ? null : this.readInstance('instanceObject', this.acceptedInstanceJson);
    if (this.acceptedInstanceJson !== null && instance === null) {
      this._instanceInputRejected = true;
      return false;
    }
    const candidate = this.buildCandidate('templateObject', template, instance, instance !== null);
    if (candidate === null) {
      return false;
    }
    this.commit(['template']);
    this.acceptedTemplate = template;
    this._state = this.publish(candidate, template, this._state.instanceJson, null);
    return true;
  }

  acceptInstance(instance: CeeJsonObject): boolean {
    if (!this.claimAvailable('instanceObject', ['instance'])) {
      return false;
    }
    const parsed = this.readInstance('instanceObject', instance);
    if (parsed === null) {
      this._instanceInputRejected = true;
      return false;
    }
    const candidate =
      this.acceptedTemplate === null
        ? this.contextOnly(parsed, true)
        : this.buildCandidate('instanceObject', this.acceptedTemplate, parsed, true);
    if (candidate === null) {
      this._instanceInputRejected = true;
      return false;
    }
    this._instanceInputRejected = false;
    this.commit(['instance']);
    this.acceptedInstanceJson = instance;
    this._state = this.publish(candidate, this._state.templateJson, instance, null);
    return true;
  }

  acceptCombined(value: CeeTemplateAndInstance): boolean {
    if (!this.claimAvailable('templateAndInstanceObject', ['template', 'instance'])) {
      return false;
    }
    const { templateObject, instanceObject } = value;
    if (!ArtifactInputCoordinator.isJsonObject(templateObject)) {
      this.messages.error('Template Object is missing.');
      return false;
    }
    if (!ArtifactInputCoordinator.isJsonObject(instanceObject)) {
      this.messages.error('Instance Object is missing.');
      return false;
    }
    const parsed = this.readInstance('templateAndInstanceObject.instanceObject', instanceObject);
    if (parsed === null) {
      this._instanceInputRejected = true;
      return false;
    }
    const candidate = this.buildCandidate('templateAndInstanceObject.templateObject', templateObject, parsed, true);
    if (candidate === null) {
      return false;
    }
    this._instanceInputRejected = false;
    this.commit(['template', 'instance']);
    this.acceptedTemplate = templateObject;
    this._state = this.publish(candidate, null, null, value);
    return true;
  }

  private buildCandidate(
    input: string,
    template: CeeJsonObject,
    instance: TemplateInstance | null,
    instanceSupplied: boolean,
  ): ArtifactEditorState | null {
    const candidate = this.contextOnly(instance, instanceSupplied);
    try {
      candidate.dataContext.setInputTemplate(template, candidate.handlerContext, null);
      return candidate;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.messages.error(
        `CEDAR Embeddable Editor: "${input}" rejected because it is not a readable CEDAR template: ${detail}`,
      );
      return null;
    }
  }

  private contextOnly(instance: TemplateInstance | null, instanceSupplied: boolean): ArtifactEditorState {
    const dataContext = new DataContext();
    dataContext.instanceFullData = instance;
    dataContext.invalidateDerivedViews();
    const handlerContext = new HandlerContext(dataContext, this.messages);
    handlerContext.instanceSupplied = instanceSupplied;
    return {
      dataContext,
      handlerContext,
      templateJson: null,
      instanceJson: null,
      templateAndInstanceJson: null,
      revision: this.nextRevision,
    };
  }

  private publish(
    candidate: ArtifactEditorState,
    templateJson: CeeJsonObject | null,
    instanceJson: CeeJsonObject | null,
    templateAndInstanceJson: CeeTemplateAndInstance | null,
  ): ArtifactEditorState {
    this.nextRevision += 1;
    return { ...candidate, templateJson, instanceJson, templateAndInstanceJson, revision: this.nextRevision };
  }

  private readInstance(input: string, instance: CeeJsonObject): TemplateInstance | null {
    try {
      return InstanceDeserializer.read(instance, (message) => this.messages.error(message)).full;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.messages.error(
        `CEDAR Embeddable Editor: "${input}" rejected because it is not a readable CEDAR instance: ${detail}`,
      );
      return null;
    }
  }

  /**
   * Whether a template may be accepted, which a template already accepted does not settle.
   *
   * A second template is ambiguous only when someone is filling the form in: the answers in front
   * of them were recorded against the template being taken away, and there is no good answer to
   * what becomes of them. That is the case set-once exists for, and it still refuses.
   *
   * With no instance there is nothing to lose. A host driving a live view of a template it is
   * itself editing — a designer previewing its own work — is replacing a rendering rather than
   * swapping an artifact out from under anyone, and making it discard the element and start a
   * whole editor for each edit costs a second of bootstrapping to show a form that differs by a
   * word. Each accepted template still builds a fresh context, so nothing of the previous one
   * survives into the new form.
   */
  private mayAcceptTemplate(): boolean {
    if (!this.claimed.has('template') || !this.claimed.has('instance')) {
      return true;
    }
    this.messages.error(
      'CEDAR Embeddable Editor: "templateObject" ignored, because an instance is loaded against the template it ' +
        'would replace. Create a new editor element to load a different artifact.',
    );
    return false;
  }

  private claimAvailable(input: string, parts: readonly ArtifactClaim[]): boolean {
    const spent = parts.filter((part) => this.claimed.has(part));
    if (spent.length === 0) {
      return true;
    }
    const subject = spent.length > 1 ? 'template and instance are' : `${spent[0]} is`;
    this.messages.error(
      `CEDAR Embeddable Editor: "${input}" ignored, because the ${subject} already set. Each input takes ` +
        'one assignment; create a new editor element to load a different artifact.',
    );
    return false;
  }

  private commit(parts: readonly ArtifactClaim[]): void {
    parts.forEach((part) => this.claimed.add(part));
  }

  private static isJsonObject(value: unknown): value is CeeJsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
