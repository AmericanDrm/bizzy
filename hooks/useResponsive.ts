import { useState, useEffect } from 'react';
import { Dimensions, Platform } from 'react-native';

export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

const BREAKPOINTS = {
  tablet: 768,
  desktop: 1024,
};

function getBreakpoint(width: number): Breakpoint {
  if (width >= BREAKPOINTS.desktop) return 'desktop';
  if (width >= BREAKPOINTS.tablet) return 'tablet';
  return 'mobile';
}

export function useResponsive() {
  const [dimensions, setDimensions] = useState(() => Dimensions.get('window'));
  const [breakpoint, setBreakpoint] = useState<Breakpoint>(() => getBreakpoint(Dimensions.get('window').width));

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions(window);
      setBreakpoint(getBreakpoint(window.width));
    });

    return () => subscription.remove();
  }, []);

  return {
    width: dimensions.width,
    height: dimensions.height,
    breakpoint,
    isMobile: breakpoint === 'mobile',
    isTablet: breakpoint === 'tablet',
    isDesktop: breakpoint === 'desktop',
    isWeb: Platform.OS === 'web',
    isNative: Platform.OS !== 'web',
    columns: breakpoint === 'desktop' ? 3 : breakpoint === 'tablet' ? 2 : 1,
    contentMaxWidth: breakpoint === 'desktop' ? 1200 : breakpoint === 'tablet' ? 900 : undefined,
    horizontalPadding: breakpoint === 'desktop' ? 32 : breakpoint === 'tablet' ? 24 : 16,
  };
}
