import type { Page, expect } from '@playwright/test';

export type LayoutCheck = 'reflow' | 'resize' | 'spacing';
export type Check = LayoutCheck | 'placeholder' | 'boundary' | 'indicators';
export type LayoutKind = 'page scrolls' | 'scrolls' | 'unreachable' | 'clipped' | 'ellipsis' | 'overlap';
export type IndicatorKind = 'icon' | 'focus' | 'selection';
export type Kind = LayoutKind | 'placeholder' | 'boundary' | IndicatorKind;

export interface Viewport {
  readonly width: number;
  readonly height: number;
}
export const VIEWPORTS: Readonly<Record<Check, Viewport>>;
export const TEXT_SPACING: string;

interface Recorded {
  /** A selector the element matches, or for an overlap either of the two texts. */
  readonly selector: string;
  /** The states it occurs in. */
  readonly states: readonly string[];
  /** What it is, and the visible change that would remove it. */
  readonly why: string;
}
/** A finding that waits on a visible change. A page that scrolls sideways cannot be one. */
export type Exception =
  | (Recorded & { readonly check: 'reflow'; readonly kind: Exclude<LayoutKind, 'page scrolls'> })
  | (Recorded & { readonly check: 'resize'; readonly kind: 'unreachable' | 'clipped' | 'ellipsis' | 'overlap' })
  | (Recorded & { readonly check: 'spacing'; readonly kind: 'clipped' | 'ellipsis' | 'overlap' })
  | (Recorded & { readonly check: 'placeholder'; readonly kind: 'placeholder' })
  | (Recorded & { readonly check: 'boundary'; readonly kind: 'boundary' })
  | (Recorded & { readonly check: 'indicators'; readonly kind: IndicatorKind });

/**
 * A region holding a data table, which 1.4.10 lets scroll sideways at 320 CSS px. Where `states` is
 * given, the region must scroll sideways in each of them.
 */
export interface InPlaceScroller {
  readonly selector: string;
  readonly why: string;
  readonly states?: readonly string[];
}

interface Base {
  /** The state the page is in, which selects the exceptions recorded for it. */
  readonly state: string;
  /** A selector for the surface measured, or null for the whole page. */
  readonly scope?: string | null;
  /** Selectors for hosts whose content another suite measures, such as an embedded component. */
  readonly exclude?: readonly string[];
  readonly exceptions?: readonly Exception[];
}
interface Reaching extends Base {
  /** Selectors for open overlays beyond the top layer, dialogs and menus, whose cover hides a control. */
  readonly overlays?: readonly string[];
}
export interface ReflowRequest extends Reaching {
  readonly check: 'reflow';
  readonly scrollsInPlace?: readonly InPlaceScroller[];
}
export interface ResizeRequest extends Reaching {
  readonly check: 'resize';
}
export interface SpacingRequest extends Base {
  readonly check: 'spacing';
}
export interface PlaceholderRequest extends Base {
  readonly check: 'placeholder';
}
export interface BoundaryRequest extends Base {
  readonly check: 'boundary';
}
export interface IndicatorRequest extends Base {
  readonly check: 'indicators';
  /** Selectors for selected items beyond the ARIA states, such as a component's own class. */
  readonly selected?: readonly string[];
}
export type Request =
  ReflowRequest | ResizeRequest | SpacingRequest | PlaceholderRequest | BoundaryRequest | IndicatorRequest;

export interface Finding {
  readonly kind: Kind;
  readonly message: string;
  /** Whether a recorded exception or a region that scrolls in place covers it. */
  readonly excused: boolean;
}
export interface Report<Measured> {
  readonly findings: readonly Finding[];
  /** Recorded exceptions and regions that no longer match a finding in this state. */
  readonly stale: readonly string[];
  /** The unexcused findings, the stale records and, for spacing, text the spacing did not reach. */
  readonly failures: readonly string[];
  /** How much was measured, so a test can prove a selector still matches something. */
  readonly measured: Measured;
}
export interface LayoutMeasured {
  readonly texts: number;
  readonly controls: number;
}
export interface PlaceholderMeasured {
  readonly placeholder: number;
}
export interface BoundaryMeasured {
  readonly boundary: number;
}
export type IndicatorMeasured = Readonly<Record<IndicatorKind, number>>;

export function settle(page: Page): Promise<void>;

export function measure(
  page: Page,
  request: ReflowRequest | ResizeRequest | SpacingRequest,
): Promise<Report<LayoutMeasured>>;
export function measure(page: Page, request: PlaceholderRequest): Promise<Report<PlaceholderMeasured>>;
export function measure(page: Page, request: BoundaryRequest): Promise<Report<BoundaryMeasured>>;
export function measure(page: Page, request: IndicatorRequest): Promise<Report<IndicatorMeasured>>;

export function check(
  page: Page,
  assertions: typeof expect,
  request: ReflowRequest | ResizeRequest | SpacingRequest,
): Promise<Report<LayoutMeasured>>;
export function check(
  page: Page,
  assertions: typeof expect,
  request: PlaceholderRequest,
): Promise<Report<PlaceholderMeasured>>;
export function check(
  page: Page,
  assertions: typeof expect,
  request: BoundaryRequest,
): Promise<Report<BoundaryMeasured>>;
export function check(
  page: Page,
  assertions: typeof expect,
  request: IndicatorRequest,
): Promise<Report<IndicatorMeasured>>;
