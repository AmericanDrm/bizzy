import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image,
  Dimensions,
  Platform,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  PanResponder,
} from 'react-native';
import {
  X,
  Minus,
  Plus,
  Circle,
  Square as SquareIcon,
  Trash2,
  Undo2,
  Check,
  Pen,
  Type,
  ChevronUp,
  Move,
  ZoomIn,
  ZoomOut,
  Maximize,
  Hand,
} from 'lucide-react-native';
import Svg, {
  Path,
  Rect,
  Line,
  Circle as SvgCircle,
  Text as SvgText,
} from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CANVAS_MAX_HEIGHT = Math.min(SCREEN_HEIGHT * 0.55, 600);
const RESOLUTION_SCALE = 2;

type AnnotationTool = 'pen' | 'line' | 'rect' | 'circle' | 'eraser' | 'text';
type ShapeTool = 'line' | 'rect' | 'circle';
type OpenPanel = 'shape' | 'color' | 'size' | null;

interface Point { x: number; y: number; }

interface TextLabel {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  fontSize: number;
}

interface Stroke {
  id: string;
  tool: AnnotationTool;
  color: string;
  strokeWidth: number;
  points?: Point[];
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
}

interface PhotoAnnotationModalProps {
  visible: boolean;
  photoUri: string;
  onClose: () => void;
  onSave: (annotationData: string) => void;
}

const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#ffffff', '#000000'];
const STROKE_WIDTHS = [2, 4, 7, 12];
const FONT_SIZES = [14, 18, 24, 32];
const SHAPE_TOOLS: AnnotationTool[] = ['line', 'rect', 'circle'];

const SHAPE_OPTIONS: { key: ShapeTool; icon: any; label: string }[] = [
  { key: 'line', icon: Minus, label: 'Line' },
  { key: 'rect', icon: SquareIcon, label: 'Box' },
  { key: 'circle', icon: Circle, label: 'Circle' },
];

export default function PhotoAnnotationModal({ visible, photoUri, onClose, onSave }: PhotoAnnotationModalProps) {
  const { colors } = useTheme();
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [textLabels, setTextLabels] = useState<TextLabel[]>([]);
  const [currentTool, setCurrentTool] = useState<AnnotationTool>('pen');
  const [currentColor, setCurrentColor] = useState('#ef4444');
  const [currentStrokeWidth, setCurrentStrokeWidth] = useState(4);
  const [currentFontSize, setCurrentFontSize] = useState(18);
  const [activeStroke, setActiveStroke] = useState<Stroke | null>(null);
  const [canvasWidth, setCanvasWidth] = useState(0);
  const [canvasHeight, setCanvasHeight] = useState(CANVAS_MAX_HEIGHT);
  const [saving, setSaving] = useState(false);
  const [openPanel, setOpenPanel] = useState<OpenPanel>(null);
  const [lastShape, setLastShape] = useState<ShapeTool>('rect');

  const [addingText, setAddingText] = useState(false);
  const [pendingTextPos, setPendingTextPos] = useState<Point | null>(null);
  const [pendingTextValue, setPendingTextValue] = useState('');
  const [draggingTextId, setDraggingTextId] = useState<string | null>(null);
  const draggingOffsetRef = useRef<Point>({ x: 0, y: 0 });

  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState<Point>({ x: 0, y: 0 });
  const [isPanMode, setIsPanMode] = useState(false);
  const zoomRef = useRef(1);
  const panOffsetRef = useRef<Point>({ x: 0, y: 0 });
  const isPanModeRef = useRef(false);
  const isPanningRef = useRef(false);
  const panStartRef = useRef<Point>({ x: 0, y: 0 });
  const panStartOffsetRef = useRef<Point>({ x: 0, y: 0 });

  const strokeIdRef = useRef(0);
  const toolRef = useRef<AnnotationTool>('pen');
  const colorRef = useRef('#ef4444');
  const widthRef = useRef(4);
  const fontSizeRef = useRef(18);
  const canvasWidthRef = useRef(0);
  const canvasHeightRef = useRef(CANVAS_MAX_HEIGHT);
  const isDrawingRef = useRef(false);

  useEffect(() => { toolRef.current = currentTool; }, [currentTool]);
  useEffect(() => { colorRef.current = currentColor; }, [currentColor]);
  useEffect(() => { widthRef.current = currentStrokeWidth; }, [currentStrokeWidth]);
  useEffect(() => { fontSizeRef.current = currentFontSize; }, [currentFontSize]);
  useEffect(() => { canvasWidthRef.current = canvasWidth; }, [canvasWidth]);
  useEffect(() => { canvasHeightRef.current = canvasHeight; }, [canvasHeight]);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { panOffsetRef.current = panOffset; }, [panOffset]);
  useEffect(() => { isPanModeRef.current = isPanMode; }, [isPanMode]);

  useEffect(() => {
    if (visible && photoUri) {
      Image.getSize(
        photoUri,
        (imgW, imgH) => {
          if (imgW > 0 && imgH > 0) {
            const displayW = SCREEN_WIDTH;
            const ratio = imgH / imgW;
            const h = Math.min(displayW * ratio, CANVAS_MAX_HEIGHT);
            setCanvasHeight(h);
            canvasHeightRef.current = h;
          }
        },
        () => {}
      );
    }
  }, [visible, photoUri]);

  useEffect(() => {
    if (!visible) {
      setStrokes([]);
      setTextLabels([]);
      setActiveStroke(null);
      setCurrentTool('pen');
      setCurrentColor('#ef4444');
      setCurrentStrokeWidth(4);
      setCurrentFontSize(18);
      setOpenPanel(null);
      setAddingText(false);
      setPendingTextPos(null);
      setPendingTextValue('');
      setDraggingTextId(null);
      setCanvasHeight(CANVAS_MAX_HEIGHT);
      canvasHeightRef.current = CANVAS_MAX_HEIGHT;
      setZoom(1);
      zoomRef.current = 1;
      setPanOffset({ x: 0, y: 0 });
      panOffsetRef.current = { x: 0, y: 0 };
      setIsPanMode(false);
      isPanModeRef.current = false;
    }
  }, [visible]);

  const newId = () => `s-${++strokeIdRef.current}-${Date.now()}`;

  const MIN_ZOOM = 1;
  const MAX_ZOOM = 5;
  const ZOOM_STEP = 0.5;

  const clampPan = useCallback((offset: Point, z: number): Point => {
    const cw = canvasWidthRef.current || SCREEN_WIDTH;
    const ch = canvasHeightRef.current;
    const maxX = (cw * z - cw) / (2 * z);
    const maxY = (ch * z - ch) / (2 * z);
    return {
      x: Math.max(-maxX, Math.min(maxX, offset.x)),
      y: Math.max(-maxY, Math.min(maxY, offset.y)),
    };
  }, []);

  const handleZoom = useCallback((newZoom: number, focalScreenX?: number, focalScreenY?: number) => {
    const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
    const oldZoom = zoomRef.current;
    if (clamped === oldZoom) return;

    let newPan = panOffsetRef.current;
    if (focalScreenX !== undefined && focalScreenY !== undefined) {
      const cw = canvasWidthRef.current || SCREEN_WIDTH;
      const ch = canvasHeightRef.current;
      const canvasX = (focalScreenX - cw / 2) / oldZoom - panOffsetRef.current.x;
      const canvasY = (focalScreenY - ch / 2) / oldZoom - panOffsetRef.current.y;
      newPan = {
        x: (focalScreenX - cw / 2) / clamped - canvasX,
        y: (focalScreenY - ch / 2) / clamped - canvasY,
      };
    }

    const clampedPan = clampPan(newPan, clamped);
    setZoom(clamped);
    zoomRef.current = clamped;
    setPanOffset(clampedPan);
    panOffsetRef.current = clampedPan;
  }, [clampPan]);

  const screenToCanvas = useCallback((sx: number, sy: number): Point => {
    const cw = canvasWidthRef.current || SCREEN_WIDTH;
    const ch = canvasHeightRef.current;
    const z = zoomRef.current;
    const pan = panOffsetRef.current;
    const x = (sx - cw / 2) / z - pan.x + cw / 2;
    const y = (sy - ch / 2) / z - pan.y + ch / 2;
    return { x, y };
  }, []);

  const clampPoint = useCallback((screenX: number, screenY: number): Point => {
    const { x, y } = screenToCanvas(screenX, screenY);
    const maxW = (canvasWidthRef.current || SCREEN_WIDTH) * RESOLUTION_SCALE;
    const maxH = canvasHeightRef.current * RESOLUTION_SCALE;
    return {
      x: Math.max(0, Math.min(x * RESOLUTION_SCALE, maxW)),
      y: Math.max(0, Math.min(y * RESOLUTION_SCALE, maxH)),
    };
  }, [screenToCanvas]);

  const startPan = useCallback((sx: number, sy: number) => {
    isPanningRef.current = true;
    panStartRef.current = { x: sx, y: sy };
    panStartOffsetRef.current = { ...panOffsetRef.current };
  }, []);

  const movePan = useCallback((sx: number, sy: number) => {
    if (!isPanningRef.current) return;
    const z = zoomRef.current;
    const dx = (sx - panStartRef.current.x) / z;
    const dy = (sy - panStartRef.current.y) / z;
    const newOffset = { x: panStartOffsetRef.current.x + dx, y: panStartOffsetRef.current.y + dy };
    const clamped = clampPan(newOffset, z);
    setPanOffset(clamped);
    panOffsetRef.current = clamped;
  }, [clampPan]);

  const endPan = useCallback(() => {
    isPanningRef.current = false;
  }, []);

  const startDraw = useCallback((x: number, y: number) => {
    if (isPanModeRef.current) { startPan(x, y); return; }
    const tool = toolRef.current;
    if (tool === 'text') return;
    const p = clampPoint(x, y);
    const stroke: Stroke = { id: newId(), tool, color: colorRef.current, strokeWidth: widthRef.current * RESOLUTION_SCALE };
    if (tool === 'pen' || tool === 'eraser') {
      stroke.points = [p];
    } else {
      stroke.x1 = p.x; stroke.y1 = p.y; stroke.x2 = p.x; stroke.y2 = p.y;
    }
    isDrawingRef.current = true;
    setActiveStroke(stroke);
  }, [clampPoint, startPan]);

  const moveDraw = useCallback((x: number, y: number) => {
    if (isPanningRef.current) { movePan(x, y); return; }
    if (!isDrawingRef.current) return;
    const p = clampPoint(x, y);
    setActiveStroke((prev) => {
      if (!prev) return prev;
      if (prev.tool === 'pen' || prev.tool === 'eraser') {
        return { ...prev, points: [...(prev.points || []), p] };
      }
      return { ...prev, x2: p.x, y2: p.y };
    });
  }, [clampPoint, movePan]);

  const endDraw = useCallback(() => {
    if (isPanningRef.current) { endPan(); return; }
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    setActiveStroke((prev) => {
      if (prev) setStrokes((s) => [...s, prev]);
      return null;
    });
  }, [endPan]);

  const handleTextTap = useCallback((x: number, y: number) => {
    const p = clampPoint(x, y);
    setPendingTextPos(p);
    setPendingTextValue('');
    setAddingText(true);
  }, []);

  const confirmText = () => {
    if (!pendingTextPos || !pendingTextValue.trim()) {
      setAddingText(false);
      setPendingTextPos(null);
      setPendingTextValue('');
      return;
    }
    setTextLabels((prev) => [...prev, {
      id: newId(),
      x: pendingTextPos.x,
      y: pendingTextPos.y,
      text: pendingTextValue.trim(),
      color: colorRef.current,
      fontSize: fontSizeRef.current * RESOLUTION_SCALE,
    }]);
    setAddingText(false);
    setPendingTextPos(null);
    setPendingTextValue('');
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => toolRef.current !== 'text',
      onMoveShouldSetPanResponder: () => toolRef.current !== 'text',
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        startDraw(locationX, locationY);
      },
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        moveDraw(locationX, locationY);
      },
      onPanResponderRelease: () => endDraw(),
    })
  ).current;

  const setupWebCanvas = useCallback((node: any) => {
    if (!node || Platform.OS !== 'web') return;
    const el = node as unknown as HTMLElement;
    const getPos = (e: MouseEvent | TouchEvent): Point => {
      const rect = el.getBoundingClientRect();
      const clientX = 'touches' in e ? (e.touches[0]?.clientX ?? 0) : (e as MouseEvent).clientX;
      const clientY = 'touches' in e ? (e.touches[0]?.clientY ?? 0) : (e as MouseEvent).clientY;
      return { x: clientX - rect.left, y: clientY - rect.top };
    };
    const onDown = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      if ('button' in e && (e as MouseEvent).button === 1) {
        const { x, y } = getPos(e);
        isPanningRef.current = true;
        panStartRef.current = { x, y };
        panStartOffsetRef.current = { ...panOffsetRef.current };
        return;
      }
      const { x, y } = getPos(e);
      if (toolRef.current === 'text' && !isPanModeRef.current) handleTextTap(x, y);
      else startDraw(x, y);
    };
    const onMove = (e: MouseEvent | TouchEvent) => { e.preventDefault(); const { x, y } = getPos(e); moveDraw(x, y); };
    const onUp = (e: MouseEvent | TouchEvent) => { e.preventDefault(); endDraw(); };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const fx = e.clientX - rect.left;
      const fy = e.clientY - rect.top;
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      handleZoom(zoomRef.current + delta, fx, fy);
    };
    el.addEventListener('mousedown', onDown);
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseup', onUp);
    el.addEventListener('mouseleave', onUp);
    el.addEventListener('touchstart', onDown, { passive: false });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onUp);
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('mousedown', onDown);
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseup', onUp);
      el.removeEventListener('mouseleave', onUp);
      el.removeEventListener('touchstart', onDown);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onUp);
      el.removeEventListener('wheel', onWheel);
    };
  }, [startDraw, moveDraw, endDraw, handleTextTap, handleZoom]);

  const webCanvasRef = useCallback((node: any) => { if (node) setupWebCanvas(node); }, [setupWebCanvas]);

  const setupTextDragWeb = useCallback((node: any, labelId: string) => {
    if (!node || Platform.OS !== 'web') return;
    const el = node as unknown as HTMLElement;
    el.style.cursor = 'move';
    const onDown = (e: MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const rect = (el.parentElement as HTMLElement)?.getBoundingClientRect();
      if (!rect) return;
      setTextLabels((prev) => {
        const lbl = prev.find((l) => l.id === labelId);
        if (lbl) draggingOffsetRef.current = { x: e.clientX - rect.left - lbl.x / RESOLUTION_SCALE, y: e.clientY - rect.top - lbl.y / RESOLUTION_SCALE };
        return prev;
      });
      setDraggingTextId(labelId);
      const onMove = (me: MouseEvent) => {
        const nx = (me.clientX - rect.left - draggingOffsetRef.current.x) * RESOLUTION_SCALE;
        const ny = (me.clientY - rect.top - draggingOffsetRef.current.y) * RESOLUTION_SCALE;
        setTextLabels((prev) => prev.map((l) => l.id === labelId ? { ...l, x: nx, y: ny } : l));
      };
      const onUp = () => { setDraggingTextId(null); window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    };
    el.addEventListener('mousedown', onDown);
  }, []);

  const renderStroke = (stroke: Stroke) => {
    if (stroke.tool === 'pen') {
      if (!stroke.points || stroke.points.length < 2) return null;
      const d = stroke.points.reduce((acc, p, i) => acc + (i === 0 ? `M ${p.x} ${p.y}` : ` L ${p.x} ${p.y}`), '');
      return <Path key={stroke.id} d={d} stroke={stroke.color} strokeWidth={stroke.strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" />;
    }
    if (stroke.tool === 'eraser') {
      if (!stroke.points || stroke.points.length < 2) return null;
      const d = stroke.points.reduce((acc, p, i) => acc + (i === 0 ? `M ${p.x} ${p.y}` : ` L ${p.x} ${p.y}`), '');
      return <Path key={stroke.id} d={d} stroke="rgba(0,0,0,0)" strokeWidth={stroke.strokeWidth * 3} fill="none" strokeLinecap="round" />;
    }
    if (stroke.tool === 'line') return <Path key={stroke.id} d={`M ${stroke.x1} ${stroke.y1} L ${stroke.x2} ${stroke.y2}`} stroke={stroke.color} strokeWidth={stroke.strokeWidth} fill="none" strokeLinecap="round" />;
    if (stroke.tool === 'rect') {
      const x = Math.min(stroke.x1!, stroke.x2!), y = Math.min(stroke.y1!, stroke.y2!);
      const w = Math.abs(stroke.x2! - stroke.x1!), h = Math.abs(stroke.y2! - stroke.y1!);
      return <Rect key={stroke.id} x={x} y={y} width={w} height={h} stroke={stroke.color} strokeWidth={stroke.strokeWidth} fill="none" />;
    }
    if (stroke.tool === 'circle') {
      const cx = (stroke.x1! + stroke.x2!) / 2, cy = (stroke.y1! + stroke.y2!) / 2;
      const rx = Math.abs(stroke.x2! - stroke.x1!) / 2, ry = Math.abs(stroke.y2! - stroke.y1!) / 2;
      return <SvgCircle key={stroke.id} cx={cx} cy={cy} r={Math.max(rx, ry)} stroke={stroke.color} strokeWidth={stroke.strokeWidth} fill="none" />;
    }
    return null;
  };

  const allStrokes = activeStroke ? [...strokes, activeStroke] : strokes;
  const isTextTool = currentTool === 'text';
  const isShapeActive = SHAPE_TOOLS.includes(currentTool);
  const ShapeIcon = SHAPE_OPTIONS.find((s) => s.key === lastShape)?.icon || SquareIcon;

  const handleSave = async () => {
    setSaving(true);
    try {
      onSave(JSON.stringify({ strokes, textLabels, canvasWidth: (canvasWidthRef.current || SCREEN_WIDTH) * RESOLUTION_SCALE, canvasHeight: canvasHeightRef.current * RESOLUTION_SCALE, createdAt: new Date().toISOString() }));
    } finally { setSaving(false); }
  };

  const togglePanel = (panel: OpenPanel) => setOpenPanel((p) => (p === panel ? null : panel));
  const selectShape = (shape: ShapeTool) => { setLastShape(shape); setCurrentTool(shape); setOpenPanel(null); };
  const selectColor = (c: string) => { setCurrentColor(c); setOpenPanel(null); };
  const selectSize = (val: number) => {
    if (currentTool === 'text') setCurrentFontSize(val);
    else setCurrentStrokeWidth(val);
    setOpenPanel(null);
  };

  const canvasProps = Platform.OS === 'web'
    ? { ref: webCanvasRef }
    : {
      ...(!isTextTool ? panResponder.panHandlers : {}),
      onStartShouldSetResponder: () => isTextTool,
      onResponderGrant: isTextTool ? (e: any) => handleTextTap(e.nativeEvent.locationX, e.nativeEvent.locationY) : undefined,
    };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.kavContainer}>
          <View style={[styles.modal, { backgroundColor: colors.card }]}>

            <View style={[styles.header, { borderBottomColor: colors.border }]}>
              <Text style={[styles.title, { color: colors.text }]}>Annotate Photo</Text>
              <View style={styles.headerActions}>
                <TouchableOpacity
                  style={styles.headerBtn}
                  onPress={() => {
                    if (textLabels.length > 0 && strokes.length === 0) setTextLabels((t) => t.slice(0, -1));
                    else setStrokes((s) => s.slice(0, -1));
                  }}
                  disabled={strokes.length === 0 && textLabels.length === 0}
                >
                  <Undo2 size={20} color={(strokes.length === 0 && textLabels.length === 0) ? colors.textSecondary : colors.text} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.headerBtn} onPress={() => { setStrokes([]); setTextLabels([]); }} disabled={strokes.length === 0 && textLabels.length === 0}>
                  <Trash2 size={20} color={(strokes.length === 0 && textLabels.length === 0) ? colors.textSecondary : '#ef4444'} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.headerBtn} onPress={onClose}>
                  <X size={20} color={colors.text} />
                </TouchableOpacity>
              </View>
            </View>

            <View
              style={[styles.canvas, { height: canvasHeight }, isTextTool && !isPanMode && styles.canvasTextCursor, isPanMode && styles.canvasPanCursor]}
              onLayout={(e) => {
                const w = e.nativeEvent.layout.width;
                setCanvasWidth(w);
                canvasWidthRef.current = w;
              }}
              {...canvasProps}
            >
              <View style={[styles.zoomContainer, {
                transform: [
                  { translateX: panOffset.x * zoom },
                  { translateY: panOffset.y * zoom },
                  { scale: zoom },
                ],
              }]}>
                <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="cover" />
                <Svg style={StyleSheet.absoluteFill} width={canvasWidth || SCREEN_WIDTH} height={canvasHeight} viewBox={`0 0 ${(canvasWidth || SCREEN_WIDTH) * RESOLUTION_SCALE} ${canvasHeight * RESOLUTION_SCALE}`}>
                  {allStrokes.map((s) => renderStroke(s))}
                  {textLabels.map((lbl) => (
                    <SvgText key={lbl.id} x={lbl.x} y={lbl.y} fill={lbl.color} fontSize={lbl.fontSize} fontWeight="700" stroke="rgba(0,0,0,0.5)" strokeWidth={RESOLUTION_SCALE}>
                      {lbl.text}
                    </SvgText>
                  ))}
                </Svg>
                {Platform.OS === 'web' && textLabels.map((lbl) => (
                  <View
                    key={`drag-${lbl.id}`}
                    ref={(n) => setupTextDragWeb(n, lbl.id)}
                    style={[styles.textDragHandle, { left: lbl.x / RESOLUTION_SCALE - 10, top: lbl.y / RESOLUTION_SCALE - lbl.fontSize / RESOLUTION_SCALE - 4 }]}
                  >
                    <Move size={12} color="#fff" />
                  </View>
                ))}
              </View>
              {isTextTool && !addingText && !isPanMode && (
                <View style={styles.tapHint} pointerEvents="none">
                  <Text style={styles.tapHintText}>Tap to place text, drag handle to reposition</Text>
                </View>
              )}
              {isPanMode && (
                <View style={styles.tapHint} pointerEvents="none">
                  <Text style={styles.tapHintText}>Drag to pan. Use scroll wheel to zoom.</Text>
                </View>
              )}
              {zoom > 1 && (
                <View style={styles.zoomBadge} pointerEvents="none">
                  <Text style={styles.zoomBadgeText}>{zoom.toFixed(1)}x</Text>
                </View>
              )}
            </View>

            {addingText && pendingTextPos && (
              <View style={[styles.textInputRow, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
                <TextInput
                  style={[styles.textInput, { color: colors.text, borderColor: colors.border }]}
                  placeholder="Type label..."
                  placeholderTextColor={colors.textSecondary}
                  value={pendingTextValue}
                  onChangeText={setPendingTextValue}
                  autoFocus
                  onSubmitEditing={confirmText}
                  returnKeyType="done"
                />
                <TouchableOpacity style={[styles.textConfirmBtn, { overflow: 'hidden' }]} onPress={confirmText}>
                  <LinearGradient
                    colors={['#1B4D6E', '#245d82']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <Check size={16} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.textCancelBtn, { borderColor: colors.border }]} onPress={() => { setAddingText(false); setPendingTextPos(null); setPendingTextValue(''); }}>
                  <X size={16} color={colors.text} />
                </TouchableOpacity>
              </View>
            )}

            <View style={[styles.toolbarWrap, { borderTopColor: colors.border }]}>
              {openPanel !== null && (
                <View style={[styles.panel, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
                  {openPanel === 'shape' && (
                    <View style={styles.panelRow}>
                      {SHAPE_OPTIONS.map((opt) => {
                        const Icon = opt.icon;
                        const active = currentTool === opt.key;
                        return (
                          <TouchableOpacity key={opt.key} style={[styles.panelBtn, active && { backgroundColor: colors.primary + '22', borderColor: colors.primary }]} onPress={() => selectShape(opt.key)}>
                            <Icon size={18} color={active ? colors.primary : colors.text} />
                            <Text style={[styles.panelBtnLabel, { color: active ? colors.primary : colors.textSecondary }]}>{opt.label}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                  {openPanel === 'color' && (
                    <View style={styles.panelRow}>
                      {COLORS.map((c) => (
                        <TouchableOpacity key={c} style={[styles.colorSwatch, { backgroundColor: c, borderColor: c === '#ffffff' ? '#aaa' : c }, currentColor === c && styles.colorSwatchActive]} onPress={() => selectColor(c)} />
                      ))}
                    </View>
                  )}
                  {openPanel === 'size' && (
                    <View style={styles.panelRow}>
                      {(isTextTool ? FONT_SIZES : STROKE_WIDTHS).map((val) => {
                        const active = isTextTool ? currentFontSize === val : currentStrokeWidth === val;
                        return (
                          <TouchableOpacity key={val} style={[styles.panelBtn, active && { backgroundColor: colors.primary + '22', borderColor: colors.primary }]} onPress={() => selectSize(val)}>
                            {isTextTool
                              ? <Text style={{ fontSize: Math.max(9, val * 0.5), color: active ? colors.primary : currentColor, fontWeight: '700' }}>A</Text>
                              : <View style={[styles.sizeCircle, { width: val * 1.5, height: val * 1.5, backgroundColor: active ? colors.primary : currentColor }]} />
                            }
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              )}

              <View style={styles.toolbar}>
                <TouchableOpacity
                  style={[styles.toolPill, currentTool === 'pen' && { backgroundColor: colors.primary + '20', borderColor: colors.primary }]}
                  onPress={() => { setCurrentTool('pen'); setOpenPanel(null); }}
                >
                  <Pen size={16} color={currentTool === 'pen' ? colors.primary : colors.text} />
                  <Text style={[styles.pillLabel, { color: currentTool === 'pen' ? colors.primary : colors.textSecondary }]}>Draw</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.toolPill, isShapeActive && { backgroundColor: colors.primary + '20', borderColor: colors.primary }]}
                  onPress={() => { if (!isShapeActive) setCurrentTool(lastShape); togglePanel('shape'); }}
                >
                  <ShapeIcon size={16} color={isShapeActive ? colors.primary : colors.text} />
                  <Text style={[styles.pillLabel, { color: isShapeActive ? colors.primary : colors.textSecondary }]}>Shape</Text>
                  <ChevronUp size={10} color={isShapeActive ? colors.primary : colors.textSecondary} style={{ transform: [{ rotate: openPanel === 'shape' ? '0deg' : '180deg' }] }} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.toolPill, isTextTool && { backgroundColor: colors.primary + '20', borderColor: colors.primary }]}
                  onPress={() => { setCurrentTool('text'); setOpenPanel(null); }}
                >
                  <Type size={16} color={isTextTool ? colors.primary : colors.text} />
                  <Text style={[styles.pillLabel, { color: isTextTool ? colors.primary : colors.textSecondary }]}>Text</Text>
                </TouchableOpacity>

                <View style={[styles.divider, { backgroundColor: colors.border }]} />

                <TouchableOpacity
                  style={[styles.toolPill, openPanel === 'size' && { backgroundColor: colors.primary + '20', borderColor: colors.primary }]}
                  onPress={() => togglePanel('size')}
                >
                  {isTextTool
                    ? <Text style={{ fontSize: 13, fontWeight: '800', color: openPanel === 'size' ? colors.primary : currentColor }}>A</Text>
                    : <View style={[styles.sizeCircle, { width: currentStrokeWidth * 1.4, height: currentStrokeWidth * 1.4, backgroundColor: openPanel === 'size' ? colors.primary : currentColor }]} />
                  }
                  <Text style={[styles.pillLabel, { color: openPanel === 'size' ? colors.primary : colors.textSecondary }]}>{isTextTool ? `${currentFontSize}pt` : `${currentStrokeWidth}px`}</Text>
                  <ChevronUp size={10} color={openPanel === 'size' ? colors.primary : colors.textSecondary} style={{ transform: [{ rotate: openPanel === 'size' ? '0deg' : '180deg' }] }} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.toolPill, openPanel === 'color' && { backgroundColor: colors.primary + '20', borderColor: colors.primary }]}
                  onPress={() => togglePanel('color')}
                >
                  <View style={[styles.colorDot, { backgroundColor: currentColor, borderColor: currentColor === '#ffffff' ? '#aaa' : currentColor }]} />
                  <ChevronUp size={10} color={openPanel === 'color' ? colors.primary : colors.textSecondary} style={{ transform: [{ rotate: openPanel === 'color' ? '0deg' : '180deg' }] }} />
                </TouchableOpacity>

                <View style={[styles.divider, { backgroundColor: colors.border }]} />

                <TouchableOpacity
                  style={[styles.toolPill, isPanMode && { backgroundColor: '#0ea5e920', borderColor: '#0ea5e9' }]}
                  onPress={() => { setIsPanMode(!isPanMode); isPanModeRef.current = !isPanMode; }}
                >
                  <Hand size={16} color={isPanMode ? '#0ea5e9' : colors.text} />
                  <Text style={[styles.pillLabel, { color: isPanMode ? '#0ea5e9' : colors.textSecondary }]}>Pan</Text>
                </TouchableOpacity>

                <View style={styles.zoomControls}>
                  <TouchableOpacity
                    style={[styles.zoomBtn, { borderColor: colors.border }]}
                    onPress={() => handleZoom(zoom - ZOOM_STEP)}
                    disabled={zoom <= MIN_ZOOM}
                  >
                    <ZoomOut size={14} color={zoom <= MIN_ZOOM ? colors.textSecondary : colors.text} />
                  </TouchableOpacity>
                  <Text style={[styles.zoomLabel, { color: colors.textSecondary }]}>{Math.round(zoom * 100)}%</Text>
                  <TouchableOpacity
                    style={[styles.zoomBtn, { borderColor: colors.border }]}
                    onPress={() => handleZoom(zoom + ZOOM_STEP)}
                    disabled={zoom >= MAX_ZOOM}
                  >
                    <ZoomIn size={14} color={zoom >= MAX_ZOOM ? colors.textSecondary : colors.text} />
                  </TouchableOpacity>
                  {zoom > 1 && (
                    <TouchableOpacity
                      style={[styles.zoomBtn, { borderColor: colors.border }]}
                      onPress={() => { handleZoom(1); setPanOffset({ x: 0, y: 0 }); panOffsetRef.current = { x: 0, y: 0 }; }}
                    >
                      <Maximize size={14} color={colors.text} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>

            <View style={[styles.footer, { borderTopColor: colors.border }]}>
              <TouchableOpacity style={[styles.btn, styles.cancelBtn, { borderColor: colors.border }]} onPress={onClose} disabled={saving}>
                <Text style={[styles.cancelBtnText, { color: colors.text }]}>Discard</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.saveBtn, { overflow: 'hidden' }]} onPress={handleSave} disabled={saving}>
                <LinearGradient
                  colors={['#1B4D6E', '#245d82']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                {saving ? <ActivityIndicator color="#fff" /> : (
                  <><Check size={18} color="#fff" /><Text style={styles.saveBtnText}>Done</Text></>
                )}
              </TouchableOpacity>
            </View>

          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  kavContainer: { justifyContent: 'flex-end' },
  modal: { borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  title: { fontSize: 17, fontWeight: '700' },
  headerActions: { flexDirection: 'row', gap: 2 },
  headerBtn: { padding: 8 },
  canvas: { width: '100%', position: 'relative', overflow: 'hidden' },
  canvasTextCursor: { cursor: 'crosshair' } as any,
  canvasPanCursor: { cursor: 'grab' } as any,
  zoomContainer: { width: '100%', height: '100%' },
  photo: { width: '100%', height: '100%' },
  textDragHandle: { position: 'absolute', width: 22, height: 22, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', zIndex: 10, cursor: 'move' } as any,
  tapHint: { position: 'absolute', bottom: 10, left: 0, right: 0, alignItems: 'center', pointerEvents: 'none' },
  tapHintText: { color: '#fff', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, fontSize: 12, fontWeight: '600' },
  textInputRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, gap: 8, borderTopWidth: 1 },
  textInput: { flex: 1, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7, fontSize: 15 },
  textConfirmBtn: { width: 36, height: 36, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  textCancelBtn: { width: 36, height: 36, borderRadius: 9, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  toolbarWrap: { borderTopWidth: 1 },
  panel: { borderBottomWidth: 1, paddingHorizontal: 14, paddingVertical: 10 },
  panelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  panelBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: 'transparent' },
  panelBtnLabel: { fontSize: 13, fontWeight: '600' },
  colorSwatch: { width: 28, height: 28, borderRadius: 14, borderWidth: 2 },
  colorSwatchActive: { borderWidth: 3, transform: [{ scale: 1.18 }] },
  sizeCircle: { borderRadius: 50 },
  toolbar: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', paddingHorizontal: 12, paddingVertical: 9, gap: 6 },
  toolPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: 'transparent' },
  pillLabel: { fontSize: 12, fontWeight: '600' },
  divider: { width: 1, height: 28, borderRadius: 1, marginHorizontal: 2 },
  colorDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 1.5 },
  footer: { flexDirection: 'row', gap: 12, padding: 16, borderTopWidth: 1 },
  btn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 12 },
  cancelBtn: { borderWidth: 1 },
  cancelBtnText: { fontSize: 15, fontWeight: '600' },
  saveBtn: {},
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  zoomControls: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  zoomBtn: { width: 30, height: 30, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  zoomLabel: { fontSize: 11, fontWeight: '700', minWidth: 36, textAlign: 'center' },
  zoomBadge: { position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  zoomBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});
