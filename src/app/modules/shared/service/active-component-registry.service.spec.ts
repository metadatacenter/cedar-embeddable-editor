import { ActiveComponentRegistryService } from './active-component-registry.service';
import type { CedarComponent } from '../models/component/cedar-component.model';
import type { CedarUIDirective } from '../models/ui/cedar-ui-component.model';
import type { CedarMultiPagerComponent } from '../components/cedar-multi-pager/cedar-multi-pager.component';

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
