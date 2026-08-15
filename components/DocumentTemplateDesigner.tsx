import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { X, ArrowUp, ArrowDown, Eye, EyeOff, Trash2, Plus, ChevronRight } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import type { DocumentTemplate, TemplateBlock, BlockType } from '@/lib/documentTemplateTypes';
import { saveTemplate } from '@/lib/documentTemplateService';
import { buildTemplatePreviewHtml } from '@/lib/pdfGenerator';
import AccentColorPicker from './AccentColorPicker';
import RichTextEditor from './RichTextEditor';

interface DocumentTemplateDesignerProps {
  visible: boolean;
  template: DocumentTemplate;
  onClose: () => void;
  onSaved: (updated: DocumentTemplate) => void;
}

const ADDABLE_BLOCKS: { type: BlockType; label: string }[] = [
  { type: 'divider', label: 'Divider Line' },
  { type: 'spacer', label: 'Spacer' },
  { type: 'custom_text', label: 'Custom Text Block' },
];

function BlockRow({
  block,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onToggleVisible,
  onDelete,
  onEdit,
  colors,
}: {
  block: TemplateBlock;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onToggleVisible: () => void;
  onDelete: () => void;
  onEdit: () => void;
  colors: any;
}) {
  return (
    <View style={[bStyles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={bStyles.arrows}>
        <TouchableOpacity onPress={onMoveUp} disabled={isFirst} style={[bStyles.arrowBtn, isFirst && bStyles.arrowDisabled]}>
          <ArrowUp size={14} color={isFirst ? colors.textSecondary : colors.text} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onMoveDown} disabled={isLast} style={[bStyles.arrowBtn, isLast && bStyles.arrowDisabled]}>
          <ArrowDown size={14} color={isLast ? colors.textSecondary : colors.text} />
        </TouchableOpacity>
      </View>
      <View style={bStyles.info}>
        <Text style={[bStyles.label, { color: block.visible ? colors.text : colors.textSecondary }]}>{block.label}</Text>
        <Text style={[bStyles.type, { color: colors.textSecondary }]}>{block.type}</Text>
      </View>
      <View style={bStyles.actions}>
        {block.type === 'custom_text' && (
          <TouchableOpacity onPress={onEdit} style={bStyles.actionBtn}>
            <ChevronRight size={16} color={colors.primary} />
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={onToggleVisible} style={bStyles.actionBtn}>
          {block.visible ? <Eye size={16} color={colors.primary} /> : <EyeOff size={16} color={colors.textSecondary} />}
        </TouchableOpacity>
        {!block.required && (
          <TouchableOpacity onPress={onDelete} style={bStyles.actionBtn}>
            <Trash2 size={16} color={colors.error || '#ef4444'} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const bStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, borderWidth: 1, marginBottom: 8, padding: 10, gap: 8 },
  arrows: { gap: 2 },
  arrowBtn: { padding: 4 },
  arrowDisabled: { opacity: 0.3 },
  info: { flex: 1 },
  label: { fontSize: 13, fontWeight: '600' },
  type: { fontSize: 11, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 4 },
  actionBtn: { padding: 6 },
});

export default function DocumentTemplateDesigner({ visible, template, onClose, onSaved }: DocumentTemplateDesignerProps) {
  const { colors } = useTheme();
  const { showToast } = useToast();
  const [name, setName] = useState(template.name);
  const [accentColor, setAccentColor] = useState(template.accent_color);
  const [accentLightColor, setAccentLightColor] = useState(template.accent_light_color);
  const [blocks, setBlocks] = useState<TemplateBlock[]>([...template.blocks].sort((a, b) => a.order - b.order));
  const [saving, setSaving] = useState(false);
  const [showAddBlock, setShowAddBlock] = useState(false);
  const [editingBlock, setEditingBlock] = useState<TemplateBlock | null>(null);
  const [previewHtml, setPreviewHtml] = useState('');
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setName(template.name);
    setAccentColor(template.accent_color);
    setAccentLightColor(template.accent_light_color);
    setBlocks([...template.blocks].sort((a, b) => a.order - b.order));
  }, [template]);

  useEffect(() => {
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    previewTimerRef.current = setTimeout(() => {
      const html = buildTemplatePreviewHtml(blocks, accentColor, accentLightColor, template.type);
      setPreviewHtml(html);
    }, 300);
    return () => { if (previewTimerRef.current) clearTimeout(previewTimerRef.current); };
  }, [blocks, accentColor, accentLightColor, template.type]);

  const reorder = (fromIdx: number, toIdx: number) => {
    const updated = [...blocks];
    const [moved] = updated.splice(fromIdx, 1);
    updated.splice(toIdx, 0, moved);
    setBlocks(updated.map((b, i) => ({ ...b, order: i })));
  };

  const toggleVisible = (idx: number) => {
    const updated = [...blocks];
    updated[idx] = { ...updated[idx], visible: !updated[idx].visible };
    setBlocks(updated);
  };

  const deleteBlock = (idx: number) => {
    setBlocks(blocks.filter((_, i) => i !== idx));
  };

  const addBlock = (type: BlockType) => {
    const label = ADDABLE_BLOCKS.find(b => b.type === type)?.label || type;
    const newBlock: TemplateBlock = {
      id: `${type}_${Date.now()}`,
      type,
      label,
      required: false,
      visible: true,
      order: blocks.length,
      content: type === 'custom_text' ? '' : undefined,
    };
    setBlocks([...blocks, newBlock]);
    setShowAddBlock(false);
  };

  const updateBlockContent = (id: string, content: string) => {
    setBlocks(blocks.map(b => b.id === id ? { ...b, content } : b));
  };

  const handleSave = async () => {
    setSaving(true);
    const result = await saveTemplate({ ...template, name, accent_color: accentColor, accent_light_color: accentLightColor, blocks });
    setSaving(false);
    if (result) {
      showToast({ message: 'Template saved', type: 'success' });
      onSaved(result);
    } else {
      showToast({ message: 'Failed to save template', type: 'error' });
    }
  };

  const dynamicStyles = getDynamicStyles(colors);

  if (editingBlock) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={() => setEditingBlock(null)}>
        <View style={dynamicStyles.container}>
          <View style={dynamicStyles.header}>
            <TouchableOpacity onPress={() => setEditingBlock(null)}>
              <X size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={dynamicStyles.headerTitle}>Edit Custom Block</Text>
            <View style={{ width: 24 }} />
          </View>
          <ScrollView style={{ flex: 1, padding: 16 }}>
            <RichTextEditor
              value={editingBlock.content || ''}
              onChange={(html) => {
                updateBlockContent(editingBlock.id, html);
                setEditingBlock({ ...editingBlock, content: html });
              }}
              placeholder="Enter your custom text here..."
              minHeight={200}
            />
          </ScrollView>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={dynamicStyles.container}>
        <View style={dynamicStyles.header}>
          <TouchableOpacity onPress={onClose}>
            <X size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={dynamicStyles.headerTitle}>Design Template</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator size="small" color={colors.primary} /> : <Text style={[dynamicStyles.saveBtn, { color: colors.primary }]}>Save</Text>}
          </TouchableOpacity>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
          <Text style={dynamicStyles.sectionLabel}>Template Name</Text>
          <TextInput
            style={dynamicStyles.nameInput}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Classic Navy"
            placeholderTextColor={colors.textSecondary}
          />

          <View style={dynamicStyles.sectionCard}>
            <AccentColorPicker
              value={accentColor}
              onChange={(accent, accentLight) => { setAccentColor(accent); setAccentLightColor(accentLight); }}
            />
          </View>

          <Text style={dynamicStyles.sectionLabel}>Layout Blocks</Text>
          {blocks.map((block, idx) => (
            <BlockRow
              key={block.id}
              block={block}
              isFirst={idx === 0}
              isLast={idx === blocks.length - 1}
              onMoveUp={() => reorder(idx, idx - 1)}
              onMoveDown={() => reorder(idx, idx + 1)}
              onToggleVisible={() => toggleVisible(idx)}
              onDelete={() => deleteBlock(idx)}
              onEdit={() => setEditingBlock(block)}
              colors={colors}
            />
          ))}

          <TouchableOpacity style={[dynamicStyles.addBlockBtn, { borderColor: colors.border }]} onPress={() => setShowAddBlock(!showAddBlock)}>
            <Plus size={16} color={colors.primary} />
            <Text style={[dynamicStyles.addBlockText, { color: colors.primary }]}>Add Block</Text>
          </TouchableOpacity>

          {showAddBlock && (
            <View style={[dynamicStyles.addBlockList, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {ADDABLE_BLOCKS.map(b => (
                <TouchableOpacity key={b.type} style={[dynamicStyles.addBlockItem, { borderBottomColor: colors.border }]} onPress={() => addBlock(b.type)}>
                  <Text style={[dynamicStyles.addBlockItemText, { color: colors.text }]}>{b.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Text style={[dynamicStyles.sectionLabel, { marginTop: 24 }]}>Preview</Text>
          <View style={dynamicStyles.previewContainer}>
            {previewHtml ? (
              Platform.OS === 'web' ? (
                <iframe
                  srcDoc={previewHtml}
                  style={{ width: '100%', height: 500, border: 'none', borderRadius: 8 }}
                  title="Template Preview"
                />
              ) : (
                <WebView
                  source={{ html: previewHtml }}
                  style={dynamicStyles.webview}
                  scrollEnabled
                />
              )
            ) : (
              <ActivityIndicator style={{ margin: 40 }} />
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const getDynamicStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  saveBtn: { fontSize: 16, fontWeight: '600' },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10, marginTop: 16 },
  sectionCard: { backgroundColor: colors.card, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border, marginBottom: 16 },
  nameInput: { backgroundColor: colors.inputBackground, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 14, height: 44, fontSize: 15, color: colors.text, marginBottom: 4 },
  addBlockBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderStyle: 'dashed', borderRadius: 10, paddingVertical: 12, marginTop: 8 },
  addBlockText: { fontSize: 14, fontWeight: '600' },
  addBlockList: { borderRadius: 10, borderWidth: 1, marginTop: 8, overflow: 'hidden' },
  addBlockItem: { padding: 14, borderBottomWidth: 1 },
  addBlockItemText: { fontSize: 14 },
  previewContainer: { borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, minHeight: 400 },
  webview: { height: 500 },
});
