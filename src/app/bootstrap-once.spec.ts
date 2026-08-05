import { bootstrapCedarEditorOnce, CedarEditorBootstrapState } from './bootstrap-once';

describe('bootstrapCedarEditorOnce', () => {
  it('starts only one bootstrap while the custom element is being registered', () => {
    const state: CedarEditorBootstrapState = {};
    const pending = new Promise<void>(() => undefined);
    let bootstrapCount = 0;

    const bootstrap = () => {
      bootstrapCount++;
      return pending;
    };

    bootstrapCedarEditorOnce(state, bootstrap, () => undefined);
    bootstrapCedarEditorOnce(state, bootstrap, () => undefined);

    expect(bootstrapCount).toBe(1);
    expect(state.cedarEmbeddableEditorBootstrap).toBe(pending);
  });

  it('reports a bootstrap failure without opening a second bootstrap slot', async () => {
    const state: CedarEditorBootstrapState = {};
    const failure = new Error('bootstrap failed');
    const rejected = Promise.reject(failure);
    let reported: unknown;

    bootstrapCedarEditorOnce(
      state,
      () => rejected,
      (error) => {
        reported = error;
      },
    );
    await rejected.catch(() => undefined);

    expect(reported).toBe(failure);
    expect(state.cedarEmbeddableEditorBootstrap).toBe(rejected);
  });
});
