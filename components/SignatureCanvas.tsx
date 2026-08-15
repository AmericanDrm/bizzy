import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, PanResponder, Dimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { RotateCcw, Check } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface SignatureCanvasProps {
  onSave: (signatureData: string) => void;
  onCancel: () => void;
}

interface Point {
  x: number;
  y: number;
}

export default function SignatureCanvas({ onSave, onCancel }: SignatureCanvasProps) {
  const [paths, setPaths] = useState<string[]>([]);
  const [currentPath, setCurrentPath] = useState<Point[]>([]);
  const { colors } = useTheme();
  const { width } = Dimensions.get('window');
  const canvasHeight = 300;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const locationX = evt.nativeEvent.locationX;
        const locationY = evt.nativeEvent.locationY;
        setCurrentPath([{ x: locationX, y: locationY }]);
      },
      onPanResponderMove: (evt) => {
        const locationX = evt.nativeEvent.locationX;
        const locationY = evt.nativeEvent.locationY;
        setCurrentPath((prev) => [...prev, { x: locationX, y: locationY }]);
      },
      onPanResponderRelease: () => {
        if (currentPath.length > 0) {
          const pathData = createPathData(currentPath);
          setPaths((prev) => [...prev, pathData]);
          setCurrentPath([]);
        }
      },
    })
  ).current;

  const createPathData = (points: Point[]): string => {
    if (points.length === 0) return '';
    let pathData = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      pathData += ` L ${points[i].x} ${points[i].y}`;
    }
    return pathData;
  };

  const handleClear = () => {
    setPaths([]);
    setCurrentPath([]);
  };

  const handleSave = () => {
    if (paths.length === 0) {
      return;
    }

    const svgData = `<svg width="${width - 40}" height="${canvasHeight}" xmlns="http://www.w3.org/2000/svg">
      ${paths.map(path => `<path d="${path}" stroke="#000" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`).join('')}
    </svg>`;

    const base64 = btoa(svgData);
    onSave(`data:image/svg+xml;base64,${base64}`);
  };

  const currentPathData = createPathData(currentPath);

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Sign Here</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Draw your signature using your finger or stylus
        </Text>
      </View>

      <View
        style={[styles.canvas, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
        {...panResponder.panHandlers}
      >
        <Svg width={width - 40} height={canvasHeight}>
          {paths.map((path, index) => (
            <Path
              key={index}
              d={path}
              stroke={colors.text}
              strokeWidth={2}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {currentPath.length > 0 && (
            <Path
              d={currentPathData}
              stroke={colors.text}
              strokeWidth={2}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </Svg>
        {paths.length === 0 && currentPath.length === 0 && (
          <View style={styles.placeholderContainer}>
            <Text style={[styles.placeholder, { color: colors.textSecondary }]}>
              Sign here
            </Text>
          </View>
        )}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.clearButton, { borderColor: colors.border }]}
          onPress={handleClear}
          disabled={paths.length === 0}
        >
          <RotateCcw size={20} color={paths.length === 0 ? colors.textSecondary : colors.error} />
          <Text style={[styles.clearButtonText, { color: paths.length === 0 ? colors.textSecondary : colors.error }]}>
            Clear
          </Text>
        </TouchableOpacity>

        <View style={styles.mainActions}>
          <TouchableOpacity
            style={[styles.cancelButton, { borderColor: colors.border }]}
            onPress={onCancel}
          >
            <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.saveButton,
              { backgroundColor: colors.primary },
              paths.length === 0 && styles.saveButtonDisabled,
            ]}
            onPress={handleSave}
            disabled={paths.length === 0}
          >
            <Check size={20} color="#fff" />
            <Text style={styles.saveButtonText}>Confirm Signature</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
  },
  canvas: {
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    marginBottom: 20,
    position: 'relative',
  },
  placeholderContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'none',
  },
  placeholder: {
    fontSize: 18,
    fontStyle: 'italic',
  },
  actions: {
    gap: 16,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
  },
  clearButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  mainActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 8,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
