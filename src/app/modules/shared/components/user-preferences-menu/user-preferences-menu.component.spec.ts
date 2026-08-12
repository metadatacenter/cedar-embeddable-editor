import { vi } from 'vitest';
import { UserPreferencesMenuComponent } from './user-preferences-menu.component';
import { UserPreferencesService } from '../../service/user-preferences.service';

/**
 * Read-only as host policy, which a user cannot then undo.
 *
 * The toggle wrote straight to the service the widgets subscribe to, and the input
 * carrying the host's own `readOnlyMode` was a one-way gate — so a host embedding a
 * form as a viewer got a form the user could switch back to editable, and a host
 * offering its own save button would then store the edits. Host policy and user
 * preference shared one piece of state. They are now distinguished, and the policy
 * wins.
 */
describe('UserPreferencesMenuComponent', () => {
  const make = (): { component: UserPreferencesMenuComponent; setReadOnlyMode: ReturnType<typeof vi.fn> } => {
    const setReadOnlyMode = vi.fn();
    const component = new UserPreferencesMenuComponent({
      setReadOnlyMode,
    } as unknown as UserPreferencesService);
    return { component, setReadOnlyMode };
  };

  it('lets the user turn read-only on and off when the host has not set it', () => {
    const { component, setReadOnlyMode } = make();

    component.toggleReadOnly(true);
    component.toggleReadOnly(false);

    expect(component.locked).toBe(false);
    expect(setReadOnlyMode.mock.calls).toEqual([[true], [false]]);
  });

  it('enters read-only and locks the toggle when the host sets it', () => {
    const { component, setReadOnlyMode } = make();

    component.hostReadOnly = true;

    expect(component.locked).toBe(true);
    expect(component.readOnlyMode$).toBe(true);
    expect(setReadOnlyMode).toHaveBeenCalledWith(true);
  });

  it('refuses to leave read-only once the host has set it', () => {
    const { component, setReadOnlyMode } = make();
    component.hostReadOnly = true;
    setReadOnlyMode.mockClear();

    component.toggleReadOnly(false);

    expect(component.readOnlyMode$, 'the host set read-only, so it stays on').toBe(true);
    expect(setReadOnlyMode, 'nothing should reach the service the widgets read').not.toHaveBeenCalled();
  });

  /** A host that leaves it off is not making policy, so the toggle stays live. */
  it('does not lock when the host sets read-only false', () => {
    const { component, setReadOnlyMode } = make();

    component.hostReadOnly = false;
    component.toggleReadOnly(true);

    expect(component.locked).toBe(false);
    expect(setReadOnlyMode).toHaveBeenCalledWith(true);
  });
});
