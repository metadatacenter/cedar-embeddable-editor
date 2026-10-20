/**
 * Arrow, Home and End keys between the chips of a listbox inside CEE's shadow root.
 *
 * Material 22 discovers chip focus through `document.activeElement`, which is the CEE host outside
 * its shadow root, so its own key manager moves nothing there. This follows the event's actual
 * target through the control's public roles instead, skipping disabled options.
 */
export function moveChipFocus(event: KeyboardEvent): void {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
  const target = (event.target as HTMLElement).closest<HTMLElement>('[role="option"]');
  const list = target?.closest('mat-chip-listbox');
  if (!target || !list) return;
  const options = Array.from(list.querySelectorAll<HTMLElement>('[role="option"]')).filter(
    (option) => option.getAttribute('aria-disabled') !== 'true',
  );
  const index = options.indexOf(target);
  if (index < 0) return;
  const rtl = getComputedStyle(list).direction === 'rtl';
  const delta = event.key === 'ArrowUp' || event.key === (rtl ? 'ArrowRight' : 'ArrowLeft') ? -1 : 1;
  const next =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? options.length - 1
        : Math.max(0, Math.min(options.length - 1, index + delta));
  event.preventDefault();
  event.stopPropagation();
  options[next].focus();
}
