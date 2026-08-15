export type SlideDirection = 'left' | 'right';

export interface TabAnimationConfig {
  duration: number;
  enableHaptics: boolean;
  enableAnimations: boolean;
}

export const DEFAULT_ANIMATION_CONFIG: TabAnimationConfig = {
  duration: 320,
  enableHaptics: true,
  enableAnimations: true,
};

// Determine slide direction based on dynamic tab order
export function getSlideDirection<T extends string>(
  previousTab: T | null,
  currentTab: T,
  tabOrder: readonly T[]
): SlideDirection {
  if (!previousTab) {
    return 'right';
  }

  const previousIndex = tabOrder.indexOf(previousTab);
  const currentIndex = tabOrder.indexOf(currentTab);

  if (previousIndex === -1 || currentIndex === -1) {
    return 'right';
  }

  // iOS‑style: moving right → slide from right, moving left → slide from left
  return currentIndex > previousIndex ? 'right' : 'left';
}

// Build the REAL tab order based on visible tabs
export function getDynamicTabOrder(visibleTabs: { id: string }[]) {
  return visibleTabs.map(t => t.id);
}