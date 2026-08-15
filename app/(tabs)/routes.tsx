import React, { useState } from 'react';
import { View } from 'react-native';
import RouteOptimizationScreen from '@/components/RouteOptimizationScreen';
import WorkflowFab from '@/components/WorkflowFab';
import { useQuickActionHandler } from '@/hooks/useQuickActionHandler';
import { useLayout } from '@/contexts/LayoutContext';
import { useTheme } from '@/contexts/ThemeContext';
import { getDynamicStyles } from '@/styles/routesStyles';

export default function RoutesTab() {
  const [fabOpen, setFabOpen] = useState(false);
  const handleQuickAction = useQuickActionHandler({});
  const { dominantHand } = useLayout();
  const { colors } = useTheme();
  const styles = getDynamicStyles(colors);

  return (
    <View style={styles.container}>
      <RouteOptimizationScreen />
      <WorkflowFab
        actions={[]}
        isOpen={fabOpen}
        onToggle={() => setFabOpen(!fabOpen)}
        onClose={() => setFabOpen(false)}
        onQuickAction={handleQuickAction}
        dominantHand={dominantHand}
      />
    </View>
  );
}
