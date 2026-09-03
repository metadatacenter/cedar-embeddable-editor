import { ActiveComponentRegistryService } from './active-component-registry.service';
import type { CedarComponent } from '../models/component/cedar-component.model';
import type { CedarUIDirective } from '../models/ui/cedar-ui-component.model';
import type { CedarMultiPagerComponent } from '../components/cedar-multi-pager/cedar-multi-pager.component';
import { InstanceDataAtomType, InstanceDataEmptyAtom, InstanceDataStringAtom } from 'cedar-model-typescript-library';
import { MultiFieldComponent } from '../models/field/multi-field-component.model';
import { InputType } from '../models/input-type.model';
import type { HandlerContext } from '../util/handler-context';

describe('ActiveComponentRegistryService lifecycle', () => {
  let registry: ActiveComponentRegistryService;

  beforeEach(() => {
    registry = new ActiveComponentRegistryService();
  });

  const model = (): CedarComponent => ({}) as CedarComponent;
  const widget = (): CedarUIDirective => ({}) as CedarUIDirective;
  const pager = (): CedarMultiPagerComponent => ({}) as CedarMultiPagerComponent;
  const pagerMap = (): Map<CedarComponent, CedarMultiPagerComponent> =>
    (
      registry as unknown as {
        modelToMultiPagerUI: Map<CedarComponent, CedarMultiPagerComponent>;
      }
    ).modelToMultiPagerUI;

  it('removes a destroyed widget without removing its replacement', () => {
    const component = model();
    const oldWidget = widget();
    const replacement = widget();
    registry.registerComponent(component, oldWidget);
    registry.registerComponent(component, replacement);

    registry.unregisterComponent(component, oldWidget);
    expect(registry.modelToUI.get(component)).toBe(replacement);

    registry.unregisterComponent(component, replacement);
    expect(registry.modelToUI.has(component)).toBe(false);
  });

  it('drops a widget previous model binding when Angular reuses it', () => {
    const oldModel = model();
    const newModel = model();
    const reusedWidget = widget();

    registry.registerComponent(oldModel, reusedWidget);
    registry.registerComponent(newModel, reusedWidget);

    expect(registry.modelToUI.has(oldModel)).toBe(false);
    expect(registry.modelToUI.get(newModel)).toBe(reusedWidget);
  });

  it('applies the same identity-safe lifecycle to multi-pagers', () => {
    const component = model();
    const oldPager = pager();
    const replacement = pager();
    registry.registerMultiPagerComponent(component, oldPager);
    registry.registerMultiPagerComponent(component, replacement);

    registry.unregisterMultiPagerComponent(component, oldPager);
    expect(pagerMap().get(component)).toBe(replacement);

    registry.unregisterMultiPagerComponent(component, replacement);
    expect(pagerMap().has(component)).toBe(false);
  });

  it('clears widget and pager graphs together', () => {
    registry.registerComponent(model(), widget());
    registry.registerMultiPagerComponent(model(), pager());

    registry.clear();

    expect(registry.modelToUI.size).toBe(0);
    expect(pagerMap().size).toBe(0);
  });
});

/**
 * What a widget is told when the occurrence on screen holds nothing.
 *
 * The registry had a branch for an empty occurrence that tested
 * `Object.keys(node).length === 0` on a node that is a class instance, so it
 * could never hold. Deleting an unreachable branch is only safe once something
 * says what the reachable one does, which is what these are for.
 */
describe('ActiveComponentRegistryService empty occurrences', () => {
  const registry = new ActiveComponentRegistryService();

  const multiFieldShowing = (occurrences: InstanceDataAtomType[], index: number): { pushed: unknown[] } => {
    const field = new MultiFieldComponent();
    field.name = 'note';
    field.path = ['note'];
    field.basicInfo.inputType = InputType.text;

    const pushed: unknown[] = [];
    const uiComponent = {
      setCurrentValue: (value: unknown) => pushed.push(value),
      component: field,
    } as unknown as CedarUIDirective;
    registry.registerComponent(field, uiComponent);

    const handlerContext = {
      readOnlyMode: false,
      statesSpecification: false,
      getDataObjectNodeByPath: () => occurrences,
      getParentDataObjectNodeByPath: () => null,
      multiInstanceObjectService: {
        getMultiInstanceInfoForComponent: () => ({ currentIndex: index, currentCount: occurrences.length }),
      },
    } as unknown as HandlerContext;

    registry.updateViewToModel(field, handlerContext);
    return { pushed };
  };

  it('clears the widget on an occurrence holding no value', () => {
    const { pushed } = multiFieldShowing([new InstanceDataEmptyAtom()], 0);

    expect(pushed).toEqual([null]);
  });

  it('shows the literal an occurrence does hold', () => {
    const { pushed } = multiFieldShowing([new InstanceDataStringAtom('written')], 0);

    expect(pushed).toEqual(['written']);
  });

  it('clears the widget when the cursor points past the occurrences', () => {
    const { pushed } = multiFieldShowing([new InstanceDataStringAtom('written')], 1);

    expect(pushed).toEqual([null]);
  });
});
