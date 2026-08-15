import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import Svg, { Path, Rect, Circle as SvgCircle, Text as SvgText } from 'react-native-svg';

interface Point { x: number; y: number; }

interface Stroke {
  id: string;
  tool: 'pen' | 'line' | 'rect' | 'circle' | 'eraser' | 'text';
  color: string;
  strokeWidth: number;
  points?: Point[];
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  text?: string;
  fontSize?: number;
}

interface TextLabel {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  fontSize: number;
}

interface AnnotationPayload {
  strokes: Stroke[];
  textLabels?: TextLabel[];
  canvasWidth: number;
  canvasHeight: number;
}

interface AnnotatedPhotoProps {
  photoUri: string;
  annotationData?: string | null;
  style?: object;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
}

function parseAnnotation(annotationData?: string | null): AnnotationPayload | null {
  if (!annotationData) return null;
  try {
    const parsed = JSON.parse(annotationData);
    if (parsed && Array.isArray(parsed.strokes)) return parsed as AnnotationPayload;
    return null;
  } catch {
    return null;
  }
}

function renderStroke(stroke: Stroke, scaleX: number, scaleY: number) {
  const sw = stroke.strokeWidth;
  if (stroke.tool === 'pen') {
    if (!stroke.points || stroke.points.length < 2) return null;
    const d = stroke.points.reduce((acc, p, i) =>
      acc + (i === 0 ? `M ${p.x * scaleX} ${p.y * scaleY}` : ` L ${p.x * scaleX} ${p.y * scaleY}`), '');
    return <Path key={stroke.id} d={d} stroke={stroke.color} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />;
  }
  if (stroke.tool === 'eraser') {
    if (!stroke.points || stroke.points.length < 2) return null;
    const d = stroke.points.reduce((acc, p, i) =>
      acc + (i === 0 ? `M ${p.x * scaleX} ${p.y * scaleY}` : ` L ${p.x * scaleX} ${p.y * scaleY}`), '');
    return <Path key={stroke.id} d={d} stroke="white" strokeWidth={sw * 3} fill="none" strokeLinecap="round" strokeLinejoin="round" />;
  }
  if (stroke.tool === 'line') {
    return (
      <Path key={stroke.id}
        d={`M ${(stroke.x1 || 0) * scaleX} ${(stroke.y1 || 0) * scaleY} L ${(stroke.x2 || 0) * scaleX} ${(stroke.y2 || 0) * scaleY}`}
        stroke={stroke.color} strokeWidth={sw} fill="none" strokeLinecap="round" />
    );
  }
  if (stroke.tool === 'rect') {
    const x = Math.min(stroke.x1!, stroke.x2!) * scaleX;
    const y = Math.min(stroke.y1!, stroke.y2!) * scaleY;
    const w = Math.abs(stroke.x2! - stroke.x1!) * scaleX;
    const h = Math.abs(stroke.y2! - stroke.y1!) * scaleY;
    return <Rect key={stroke.id} x={x} y={y} width={w} height={h} stroke={stroke.color} strokeWidth={sw} fill="none" />;
  }
  if (stroke.tool === 'circle') {
    const cx = ((stroke.x1! + stroke.x2!) / 2) * scaleX;
    const cy = ((stroke.y1! + stroke.y2!) / 2) * scaleY;
    const rx = Math.abs(stroke.x2! - stroke.x1!) / 2 * scaleX;
    const ry = Math.abs(stroke.y2! - stroke.y1!) / 2 * scaleY;
    return <SvgCircle key={stroke.id} cx={cx} cy={cy} r={Math.max(rx, ry)} stroke={stroke.color} strokeWidth={sw} fill="none" />;
  }
  if (stroke.tool === 'text' && stroke.text) {
    return (
      <SvgText
        key={stroke.id}
        x={(stroke.x1 || 0) * scaleX}
        y={(stroke.y1 || 0) * scaleY}
        fill={stroke.color}
        fontSize={(stroke.fontSize || 18) * Math.min(scaleX, scaleY)}
        fontWeight="700"
        stroke="rgba(0,0,0,0.4)"
        strokeWidth={1}
      >
        {stroke.text}
      </SvgText>
    );
  }
  return null;
}

export default function AnnotatedPhoto({ photoUri, annotationData, style, resizeMode = 'cover' }: AnnotatedPhotoProps) {
  const annotation = parseAnnotation(annotationData);

  const hasContent = (annotation?.strokes?.length ?? 0) > 0 || (annotation?.textLabels?.length ?? 0) > 0;

  if (!annotation || !hasContent) {
    return <Image source={{ uri: photoUri }} style={style} resizeMode={resizeMode} />;
  }

  return (
    <View style={[styles.container, style]}>
      <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} resizeMode={resizeMode} />
      <View style={StyleSheet.absoluteFill}>
        <Svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${annotation.canvasWidth} ${annotation.canvasHeight}`}
          preserveAspectRatio={resizeMode === 'contain' ? 'xMidYMid meet' : 'xMidYMid slice'}
        >
          {annotation.strokes.map((stroke) => renderStroke(stroke, 1, 1))}
          {(annotation.textLabels ?? []).map((lbl) => (
            <SvgText
              key={lbl.id}
              x={lbl.x}
              y={lbl.y}
              fill={lbl.color}
              fontSize={lbl.fontSize}
              fontWeight="700"
              stroke="rgba(0,0,0,0.4)"
              strokeWidth={1}
            >
              {lbl.text}
            </SvgText>
          ))}
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
});
