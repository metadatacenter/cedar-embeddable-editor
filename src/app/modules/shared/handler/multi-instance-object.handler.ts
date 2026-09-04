import { TemplateComponent } from '../models/template/template-component.model';
import { ElementComponent } from '../models/component/element-component.model';
import { MultiComponent } from '../models/component/multi-component.model';
import { MultiFieldComponent } from '../models/field/multi-field-component.model';
import { SingleFieldComponent } from '../models/field/single-field-component.model';
import { MultiElementComponent } from '../models/element/multi-element-component.model';
import { SingleElementComponent } from '../models/element/single-element-component.model';
import { CedarComponent } from '../models/component/cedar-component.model';
import { CedarTemplate } from '../models/template/cedar-template.model';
import { MultiInstanceInfo } from '../models/info/multi-instance-info.model';
import { MultiInstanceObjectInfo } from '../models/info/multi-instance-object-info.model';
import { InstanceObject } from '../models/instance-node.model';
import { InstanceCardinalityReader } from './instance-cardinality-reader';
import { ModelLibraryInstanceReader } from './model-library-instance-reader';
import { InstanceDataAttributeValueField } from 'cedar-model-typescript-library';

export class MultiInstanceObjectHandler {
  private static readonly defaultInstanceReader: InstanceCardinalityReader = new ModelLibraryInstanceReader();

  /** The sole multi-instance state tree for this editor. */
  private stateRoot = new MultiInstanceInfo();
  private templateRepresentation: TemplateComponent | null = null;
  private sourceInstance: InstanceObject | null = null;
  private initialized = false;

  /**
   * Resolves a component path in the live instance, through the current cursors.
   *
   * Installed by `HandlerContext`, which owns both the instance and the path
   * resolver. It is how `currentCount` stops being a number this handler
   * maintains and becomes a fact about the document — see
   * `MultiInstanceObjectInfo`.
   *
   * There is no cycle to worry about: resolving a path reads each multi
   * ancestor's `currentIndex`, never its count.
   */
  private resolveInstanceNode: ((path: string[]) => unknown) | null = null;
  private static readonly indexRegEx = /^@#index\[(\d+)]#@$/;

  setInstanceResolver(resolve: (path: string[]) => unknown): void {
    this.resolveInstanceNode = resolve;
  }

  /** How many occurrences the instance actually holds at this path. */
  private countInInstance(path: string[]): number {
    if (!this.resolveInstanceNode) {
      return 0;
    }
    const node = this.resolveInstanceNode(path);
    if (Array.isArray(node)) {
      return node.length;
    }
    /*
     * An attribute-value field is the exception, and only once it has been read
     * back: the reader folds a list of attribute names into a single node keyed
     * by name, so the occurrences are its names rather than a list's length.
     * While the tree was a document there was nothing to fold into and every
     * field counted the same way, so a reloaded instance reported no attributes
     * at all and the pager offered no pages.
     */
    if (node instanceof InstanceDataAttributeValueField) {
      return Object.keys(node.values).length;
    }
    return 0;
  }

  buildNewOrFromMetadata(
    templateRepresentation: TemplateComponent,
    /** The instance root, which is a JSON-LD document and so always an object. */
    instance: InstanceObject | null = null,
    instanceReader: InstanceCardinalityReader = MultiInstanceObjectHandler.defaultInstanceReader,
  ): void {
    this.initialized = false;
    this.sourceInstance = null;
    this.templateRepresentation = templateRepresentation;
    this.stateRoot = new MultiInstanceInfo();
    this.buildRecursively(templateRepresentation, this.stateRoot);

    if (instance) {
      // The template gave us a skeleton at each component's `minItems`; the
      // instance says what is actually there, and wins.
      instanceReader.read(instance, (path, count) => this.setSingleMultiInstance(path, count, this.stateRoot));
    }
    this.sourceInstance = instance;
    this.initialized = true;
  }

  /** Read-only access to the root container; mutation stays inside this handler. */
  get rootState(): MultiInstanceInfo {
    return this.stateRoot;
  }

  /** Whether the state tree has been built successfully for the current template. */
  isInitialized(): boolean {
    return this.initialized;
  }

  /** Whether this tree already describes this exact template/instance pair. */
  isBuiltFor(template: TemplateComponent, instance: InstanceObject | null): boolean {
    return this.initialized && this.templateRepresentation === template && this.sourceInstance === instance;
  }

  private setSingleMultiInstance(path: string[], count: number, multiInstanceObject: MultiInstanceInfo): void {
    let container = multiInstanceObject;
    let component: CedarComponent | null = this.templateRepresentation;
    let state: MultiInstanceObjectInfo | null = null;

    for (const step of path) {
      const indexMatch = step.match(MultiInstanceObjectHandler.indexRegEx);
      if (indexMatch !== null) {
        if (
          state === null ||
          !(component instanceof MultiElementComponent || component instanceof SingleElementComponent)
        ) {
          return;
        }
        const occurrenceIndex = Number(indexMatch[1]);
        while (state.occurrences.length <= occurrenceIndex) {
          const occurrence = new MultiInstanceInfo();
          this.buildRecursively(component, occurrence);
          state.addOccurrence(occurrence);
        }
        container = state.occurrences[occurrenceIndex];
        continue;
      }

      if (
        !(
          component instanceof MultiElementComponent ||
          component instanceof SingleElementComponent ||
          component instanceof CedarTemplate
        )
      ) {
        return;
      }
      component = component.getChildByName(step);
      state = container.getState(step);
      if (component === null || state === null) {
        // Instance envelopes and user-defined attribute names are not template
        // components. They have no cursor state and are intentionally ignored.
        return;
      }
    }

    if (state !== null) {
      state.currentCount = count;
      state.currentIndex = count > 0 ? 0 : -1;
    }
  }

  private buildRecursively(cedarComponent: CedarComponent, multiInstanceObject: MultiInstanceInfo): void {
    if (
      !(
        cedarComponent instanceof MultiElementComponent ||
        cedarComponent instanceof SingleElementComponent ||
        cedarComponent instanceof CedarTemplate
      )
    ) {
      return;
    }
    const elementComponent = cedarComponent as ElementComponent;
    for (const child of elementComponent.children) {
      const name = child.name;
      const countSupplier =
        child instanceof MultiFieldComponent || child instanceof MultiElementComponent
          ? () => this.countInInstance(child.path)
          : null;
      const multiInfo = new MultiInstanceObjectInfo(name, countSupplier);
      // The count comes from the instance from here on. Only multi components
      // have an array to count; a single field or element is always one, and
      // stays a stored number.
      multiInstanceObject.addState(multiInfo);
      let count = 0;
      let currentIndex = -1;
      if (child instanceof MultiFieldComponent) {
        count = (child as MultiComponent).multiInfo.getSafeMinItems();
        currentIndex = count > 0 ? 0 : -1;
      } else if (child instanceof SingleFieldComponent) {
        count = 1;
        currentIndex = -1;
      } else if (child instanceof MultiElementComponent) {
        count = (child as MultiComponent).multiInfo.getSafeMinItems();
        currentIndex = count > 0 ? 0 : -1;
        for (let i = 0; i < count; i++) {
          const mc = new MultiInstanceInfo();
          this.buildRecursively(child, mc);
          multiInfo.addOccurrence(mc);
        }
      } else if (child instanceof SingleElementComponent) {
        count = 1;
        currentIndex = -1;
        const mc = new MultiInstanceInfo();
        this.buildRecursively(child, mc);
        multiInfo.addOccurrence(mc);
      }
      multiInfo.currentCount = count;
      multiInfo.currentIndex = currentIndex;
    }
  }

  setCurrentIndex(component: MultiComponent, currentIdx: number): void {
    const multiInstanceInfo = this.getDataPathNode(component.path);
    if (multiInstanceInfo === null) {
      return;
    }
    multiInstanceInfo.currentIndex = currentIdx;
  }

  multiInstanceItemAdd(component: MultiComponent): void {
    const multiInstanceInfo = this.getDataPathNode(component.path);
    if (multiInstanceInfo === null) {
      return;
    }

    if (component instanceof MultiElementComponent) {
      const newMultiInstanceObject: MultiInstanceInfo = new MultiInstanceInfo();
      this.buildRecursively(component, newMultiInstanceObject);
      multiInstanceInfo.occurrences.splice(multiInstanceInfo.currentIndex + 1, 0, newMultiInstanceObject);
    }
    // No `currentCount++`: the instance was spliced before this ran, and the
    // count is read from it.
    multiInstanceInfo.currentIndex++;
  }

  multiInstanceItemCopy(component: MultiComponent): void {
    const multiInstanceInfo = this.getDataPathNode(component.path);
    if (multiInstanceInfo === null) {
      return;
    }

    if (component instanceof MultiElementComponent) {
      const currentIdx = multiInstanceInfo.currentIndex;
      const sourceItem = multiInstanceInfo.occurrences[currentIdx];
      if (sourceItem === undefined) {
        return;
      }
      multiInstanceInfo.occurrences.splice(currentIdx + 1, 0, sourceItem.clone());
    }
    multiInstanceInfo.currentIndex++;
  }

  multiInstanceItemDelete(component: MultiComponent): void {
    const multiInstanceInfo = this.getDataPathNode(component.path);
    if (multiInstanceInfo === null) {
      return;
    }

    if (component instanceof MultiElementComponent) {
      const currentIdx = multiInstanceInfo.currentIndex;
      multiInstanceInfo.occurrences.splice(currentIdx, 1);
    }
    // The cursor may now point past the end, and `MultiInstanceObjectInfo` keeps
    // it inside the occurrences that exist. It was clamped here by hand, which is
    // the same rule applied in one of the places it holds — see that class.
  }

  /*
   * Both return null for a component the info tree has no node for — a path into a
   * template that has since been replaced, say. Every caller already tests the
   * result, which is what the declaration now says.
   */
  getMultiInstanceInfoForComponent(component: MultiComponent): MultiInstanceObjectInfo | null {
    return this.getDataPathNode(component.path);
  }

  public getDataPathNode(path: string[]): MultiInstanceObjectInfo | null {
    return this.getDataPathNodeRecursively(this.stateRoot, this.templateRepresentation, path);
  }

  private getDataPathNodeRecursively(
    multiInstanceObject: MultiInstanceInfo,
    /*
     * Nullable, as in the matching walk in `DataObjectStructureHandler`. It is null
     * before a template is set, which is the state CEE starts in and the state a
     * host can return it to. None of the three `instanceof` branches below matches
     * null, so `childComponent` stays null and the walk ends where it stands —
     * which is the answer, not an oversight to guard against at the top.
     */
    component: CedarComponent | null,
    path: string[],
  ): MultiInstanceObjectInfo | null {
    const firstPath = path[0];
    const remainingPath = path.slice(1);
    let childComponent: CedarComponent | null = null;
    let childMultiInfo: MultiInstanceObjectInfo | null = null;
    if (component instanceof SingleElementComponent) {
      childComponent = (component as SingleElementComponent).getChildByName(firstPath);
      childMultiInfo = multiInstanceObject.getState(firstPath);
    } else if (component instanceof CedarTemplate) {
      childComponent = (component as CedarTemplate).getChildByName(firstPath);
      childMultiInfo = multiInstanceObject.getState(firstPath);
    } else if (component instanceof MultiElementComponent) {
      childComponent = (component as MultiElementComponent).getChildByName(firstPath);
      childMultiInfo = multiInstanceObject.getState(firstPath);
    }

    if (remainingPath.length === 0) {
      return childMultiInfo;
    }
    // A path step naming a child that the component or the info tree does not have
    // ends the walk, which is the same `null` the empty-tree case above returns.
    if (childMultiInfo === null || childComponent === null) {
      return null;
    }
    const goIdx = childMultiInfo.currentIndex > 0 ? childMultiInfo.currentIndex : 0;
    const occurrence = childMultiInfo.occurrences[goIdx];
    if (occurrence === undefined) {
      return null;
    }
    return this.getDataPathNodeRecursively(occurrence, childComponent, remainingPath);
  }

  hasMultiInstances(multiComponent: MultiComponent): boolean {
    // A component with no node in the info tree has no occurrences, which is the
    // same answer as a node reporting a count of zero.
    return (this.getMultiInstanceInfoForComponent(multiComponent)?.currentCount ?? 0) > 0;
  }
}
