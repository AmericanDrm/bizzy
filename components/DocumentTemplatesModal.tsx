import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { X, Plus, Copy, Star, Trash2, Pencil } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useToast } from '@/contexts/ToastContext';
import type { DocumentTemplate } from '@/lib/documentTemplateTypes';
import {
  fetchAllTemplates,
  createTemplate,
  duplicateTemplate,
  setDefaultTemplate,
  deleteTemplate,
} from '@/lib/documentTemplateService';
import { buildDefaultTemplate } from '@/lib/documentTemplateTypes';
import DocumentTemplateDesigner from './DocumentTemplateDesigner';

interface DocumentTemplatesModalProps {
  visible: boolean;
  onClose: () => void;
}

type DocType = 'invoice' | 'estimate';

function TemplateCard({
  template,
  onEdit,
  onDuplicate,
  onSetDefault,
  onDelete,
  colors,
}: {
  template: DocumentTemplate;
  onEdit: () => void;
  onDuplicate: () => void;
  onSetDefault: () => void;
  onDelete: () => void;
  colors: any;
}) {
  return (
    <View style={[cardStyles.card, { backgroundColor: colors.card, borderColor: template.is_default ? template.accent_color : colors.border }]}>
      <View style={[cardStyles.colorBar, { backgroundColor: template.accent_color }]} />
      <View style={cardStyles.info}>
        <View style={cardStyles.nameRow}>
          <Text style={[cardStyles.name, { color: colors.text }]} numberOfLines={1}>{template.name}</Text>
          {template.is_default && (
            <View style={[cardStyles.badge, { backgroundColor: template.accent_color + '22' }]}>
              <Text style={[cardStyles.badgeText, { color: template.accent_color }]}>Active</Text>
            </View>
          )}
        </View>
      </View>
      <View style={cardStyles.actions}>
        <TouchableOpacity onPress={onEdit} style={cardStyles.actionBtn}>
          <Pencil size={15} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onDuplicate} style={cardStyles.actionBtn}>
          <Copy size={15} color={colors.textSecondary} />
        </TouchableOpacity>
        {!template.is_default && (
          <>
            <TouchableOpacity onPress={onSetDefault} style={cardStyles.actionBtn}>
              <Star size={15} color={colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={onDelete} style={cardStyles.actionBtn}>
              <Trash2 size={15} color={colors.error || '#ef4444'} />
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1.5, marginBottom: 10, overflow: 'hidden' },
  colorBar: { width: 6, alignSelf: 'stretch' },
  info: { flex: 1, padding: 14 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 15, fontWeight: '600', flex: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  actions: { flexDirection: 'row', paddingRight: 8, gap: 2 },
  actionBtn: { padding: 8 },
});

export default function DocumentTemplatesModal({ visible, onClose }: DocumentTemplatesModalProps) {
  const { colors } = useTheme();
  const { currentOrganization } = useOrganization();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<DocType>('invoice');
  const [invoiceTemplates, setInvoiceTemplates] = useState<DocumentTemplate[]>([]);
  const [estimateTemplates, setEstimateTemplates] = useState<DocumentTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [designerTemplate, setDesignerTemplate] = useState<DocumentTemplate | null>(null);

  const templates = activeTab === 'invoice' ? invoiceTemplates : estimateTemplates;
  const setTemplates = activeTab === 'invoice' ? setInvoiceTemplates : setEstimateTemplates;

  useEffect(() => {
    if (visible && currentOrganization?.id) {
      loadTemplates();
    }
  }, [visible, currentOrganization?.id]);

  const loadTemplates = async () => {
    if (!currentOrganization?.id) return;
    setLoading(true);
    const [inv, est] = await Promise.all([
      fetchAllTemplates(currentOrganization.id, 'invoice'),
      fetchAllTemplates(currentOrganization.id, 'estimate'),
    ]);
    setInvoiceTemplates(inv);
    setEstimateTemplates(est);
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!currentOrganization?.id) return;
    const def = buildDefaultTemplate(currentOrganization.id, activeTab);
    const created = await createTemplate(currentOrganization.id, { ...def, name: `New ${activeTab === 'invoice' ? 'Invoice' : 'Estimate'} Template`, is_default: templates.length === 0 });
    if (created) {
      setDesignerTemplate(created);
      await loadTemplates();
    } else {
      showToast({ message: 'Failed to create template', type: 'error' });
    }
  };

  const handleDuplicate = async (template: DocumentTemplate) => {
    const dup = await duplicateTemplate(template, `${template.name} (Copy)`);
    if (dup) {
      await loadTemplates();
      showToast({ message: 'Template duplicated', type: 'success' });
    }
  };

  const handleSetDefault = async (template: DocumentTemplate) => {
    if (!currentOrganization?.id) return;
    await setDefaultTemplate(template.id, currentOrganization.id, template.type);
    await loadTemplates();
    showToast({ message: 'Active template updated', type: 'success' });
  };

  const handleDelete = (template: DocumentTemplate) => {
    Alert.alert('Delete Template', `Delete "${template.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          if (!currentOrganization?.id) return;
          await deleteTemplate(template.id, currentOrganization.id, template.type);
          await loadTemplates();
          showToast({ message: 'Template deleted', type: 'success' });
        },
      },
    ]);
  };

  const dynamicStyles = getDynamicStyles(colors);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={dynamicStyles.overlay}>
        <View style={dynamicStyles.sheet}>
          <View style={dynamicStyles.header}>
            <Text style={dynamicStyles.headerTitle}>Document Templates</Text>
            <TouchableOpacity onPress={onClose} style={dynamicStyles.closeBtn}>
              <X size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={dynamicStyles.tabs}>
            {(['invoice', 'estimate'] as DocType[]).map(tab => (
              <TouchableOpacity
                key={tab}
                style={[dynamicStyles.tab, activeTab === tab && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[dynamicStyles.tabText, { color: activeTab === tab ? colors.primary : colors.textSecondary }]}>
                  {tab === 'invoice' ? 'Invoices' : 'Estimates'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
            {loading ? (
              <ActivityIndicator style={{ marginTop: 40 }} />
            ) : templates.length === 0 ? (
              <View style={dynamicStyles.emptyState}>
                <Text style={[dynamicStyles.emptyText, { color: colors.textSecondary }]}>No templates yet. Create your first one!</Text>
              </View>
            ) : (
              templates.map(t => (
                <TemplateCard
                  key={t.id}
                  template={t}
                  onEdit={() => setDesignerTemplate(t)}
                  onDuplicate={() => handleDuplicate(t)}
                  onSetDefault={() => handleSetDefault(t)}
                  onDelete={() => handleDelete(t)}
                  colors={colors}
                />
              ))
            )}

            <TouchableOpacity style={[dynamicStyles.createBtn, { borderColor: colors.primary }]} onPress={handleCreate}>
              <Plus size={18} color={colors.primary} />
              <Text style={[dynamicStyles.createBtnText, { color: colors.primary }]}>Create New Template</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>

      {designerTemplate && (
        <DocumentTemplateDesigner
          visible={!!designerTemplate}
          template={designerTemplate}
          onClose={() => setDesignerTemplate(null)}
          onSaved={async (updated) => {
            setDesignerTemplate(null);
            await loadTemplates();
          }}
        />
      )}
    </Modal>
  );
}

const getDynamicStyles = (colors: any) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  closeBtn: { padding: 4 },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabText: { fontSize: 15, fontWeight: '600' },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 14 },
  createBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 12, paddingVertical: 14, marginTop: 8 },
  createBtnText: { fontSize: 15, fontWeight: '600' },
});
