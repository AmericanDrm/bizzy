import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Pressable,
  Platform,
  Animated,
} from 'react-native';
import { X, Plus, Trash2, ShoppingCart, Save, ChevronLeft, MoveVertical as MoreVertical, DollarSign, Check, CreditCard as Edit3, Package, Search, CircleCheck, Circle } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import { useOrganization } from '../contexts/OrganizationContext';
import { useUserRole } from '../hooks/useUserRole';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { LinearGradient } from 'expo-linear-gradient';

interface CatalogItem {
  id: string;
  name: string;
  default_unit?: string;
  last_price?: number;
  usage_count: number;
}

interface ShoppingListItem {
  id?: string;
  catalog_id?: string;
  name: string;
  quantity?: number;
  unit?: string;
  price?: number;
  notes?: string;
  is_purchased: boolean;
  purchased_at?: string;
  display_order: number;
}

interface ShoppingList {
  id: string;
  title: string;
  notes?: string;
  schedule_event_id?: string;
  is_completed: boolean;
  created_by: string;
  created_at: string;
  items: ShoppingListItem[];
}

type ViewMode = 'list' | 'create' | 'edit';

interface SuppliesNeededModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function SuppliesNeededModal({ visible, onClose }: SuppliesNeededModalProps) {
  const { colors } = useTheme();
  const { currentOrganization } = useOrganization();
  const { role } = useUserRole();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedList, setSelectedList] = useState<ShoppingList | null>(null);
  const [showActionMenu, setShowActionMenu] = useState<string | null>(null);

  const [listName, setListName] = useState('');
  const [listNotes, setListNotes] = useState('');
  const [listItems, setListItems] = useState<ShoppingListItem[]>([]);

  const [newItemName, setNewItemName] = useState('');
  const [newItemQuantity, setNewItemQuantity] = useState('');
  const [newItemUnit, setNewItemUnit] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemNotes, setNewItemNotes] = useState('');

  const [catalogSuggestions, setCatalogSuggestions] = useState<CatalogItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [catalogSearching, setCatalogSearching] = useState(false);

  const canEdit = role === 'owner' || role === 'manager' || role === 'admin';
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadLists = useCallback(async () => {
    if (!currentOrganization) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('shopping_lists')
        .select(`
          id,
          title,
          notes,
          schedule_event_id,
          is_completed,
          created_by,
          created_at,
          shopping_list_items (
            id,
            catalog_id,
            name,
            quantity,
            unit,
            price,
            notes,
            is_purchased,
            purchased_at,
            display_order
          )
        `)
        .eq('organization_id', currentOrganization.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formatted: ShoppingList[] = (data || []).map((list: any) => ({
        id: list.id,
        title: list.title,
        notes: list.notes,
        schedule_event_id: list.schedule_event_id,
        is_completed: list.is_completed,
        created_by: list.created_by,
        created_at: list.created_at,
        items: (list.shopping_list_items || [])
          .sort((a: any, b: any) => a.display_order - b.display_order)
          .map((item: any) => ({
            id: item.id,
            catalog_id: item.catalog_id,
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
            price: item.price,
            notes: item.notes,
            is_purchased: item.is_purchased,
            purchased_at: item.purchased_at,
            display_order: item.display_order,
          })),
      }));

      setLists(formatted);
    } catch (error: any) {
      showToast({ message: error.message || 'Failed to load shopping lists', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [currentOrganization, showToast]);

  useEffect(() => {
    if (visible) {
      loadLists();
      setViewMode('list');
      setSelectedList(null);
      setShowActionMenu(null);
    }
  }, [visible, loadLists]);

  const searchCatalog = useCallback(async (query: string) => {
    if (!currentOrganization || query.length < 2) {
      setCatalogSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setCatalogSearching(true);
    try {
      const { data, error } = await supabase
        .from('supply_catalog')
        .select('id, name, default_unit, last_price, usage_count')
        .eq('organization_id', currentOrganization.id)
        .ilike('name', `%${query}%`)
        .order('usage_count', { ascending: false })
        .limit(8);

      if (error) throw error;
      setCatalogSuggestions(data || []);
      setShowSuggestions((data || []).length > 0);
    } catch {
      setCatalogSuggestions([]);
    } finally {
      setCatalogSearching(false);
    }
  }, [currentOrganization]);

  const handleItemNameChange = (text: string) => {
    setNewItemName(text);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => searchCatalog(text), 300);
  };

  const handleSelectSuggestion = (item: CatalogItem) => {
    setNewItemName(item.name);
    if (item.default_unit) setNewItemUnit(item.default_unit);
    if (item.last_price) setNewItemPrice(item.last_price.toFixed(2));
    setShowSuggestions(false);
    setCatalogSuggestions([]);
  };

  const upsertCatalogEntry = async (name: string, unit?: string, price?: number) => {
    if (!currentOrganization) return null;
    try {
      const { data: existing } = await supabase
        .from('supply_catalog')
        .select('id, usage_count')
        .eq('organization_id', currentOrganization.id)
        .ilike('name', name.trim())
        .maybeSingle();

      if (existing) {
        await supabase
          .from('supply_catalog')
          .update({
            default_unit: unit || existing.default_unit || '',
            last_price: price ?? existing.last_price,
            usage_count: existing.usage_count + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
        return existing.id;
      } else {
        const { data: newEntry } = await supabase
          .from('supply_catalog')
          .insert({
            organization_id: currentOrganization.id,
            name: name.trim(),
            default_unit: unit || '',
            last_price: price ?? null,
            usage_count: 1,
          })
          .select('id')
          .single();
        return newEntry?.id || null;
      }
    } catch {
      return null;
    }
  };

  const resetForm = () => {
    setListName('');
    setListNotes('');
    setListItems([]);
    setNewItemName('');
    setNewItemQuantity('');
    setNewItemUnit('');
    setNewItemPrice('');
    setNewItemNotes('');
    setSelectedList(null);
    setCatalogSuggestions([]);
    setShowSuggestions(false);
  };

  const handleAddItem = () => {
    if (!newItemName.trim()) return;
    const price = newItemPrice ? parseFloat(newItemPrice) : undefined;
    setListItems([
      ...listItems,
      {
        name: newItemName.trim(),
        quantity: newItemQuantity ? parseFloat(newItemQuantity) : undefined,
        unit: newItemUnit.trim() || undefined,
        price,
        notes: newItemNotes.trim() || undefined,
        is_purchased: false,
        display_order: listItems.length,
      },
    ]);
    setNewItemName('');
    setNewItemQuantity('');
    setNewItemUnit('');
    setNewItemPrice('');
    setNewItemNotes('');
    setShowSuggestions(false);
  };

  const handleRemoveItem = (index: number) => {
    const updated = listItems.filter((_, i) => i !== index);
    setListItems(updated.map((item, idx) => ({ ...item, display_order: idx })));
  };

  const handleToggleItemInForm = (index: number) => {
    const updated = [...listItems];
    updated[index] = { ...updated[index], is_purchased: !updated[index].is_purchased };
    setListItems(updated);
  };

  const handleSaveList = async () => {
    if (!currentOrganization || !user || !listName.trim()) {
      showToast({ message: 'Please enter a list name', type: 'error' });
      return;
    }

    setSaving(true);
    try {
      let listId: string;

      if (viewMode === 'edit' && selectedList) {
        const { error: updateError } = await supabase
          .from('shopping_lists')
          .update({
            title: listName.trim(),
            notes: listNotes.trim() || '',
            updated_at: new Date().toISOString(),
          })
          .eq('id', selectedList.id);

        if (updateError) throw updateError;
        listId = selectedList.id;

        const existingIds = listItems.filter(i => i.id).map(i => i.id!);
        const originalIds = selectedList.items.filter(i => i.id).map(i => i.id!);
        const deletedIds = originalIds.filter(id => !existingIds.includes(id));
        if (deletedIds.length > 0) {
          await supabase.from('shopping_list_items').delete().in('id', deletedIds);
        }
      } else {
        const { data: newList, error: listError } = await supabase
          .from('shopping_lists')
          .insert({
            organization_id: currentOrganization.id,
            created_by: user.id,
            title: listName.trim(),
            notes: listNotes.trim() || '',
            is_completed: false,
          })
          .select()
          .single();

        if (listError) throw listError;
        listId = newList.id;
      }

      for (const item of listItems) {
        const catalogId = await upsertCatalogEntry(item.name, item.unit, item.price);

        if (item.id) {
          await supabase
            .from('shopping_list_items')
            .update({
              catalog_id: catalogId,
              name: item.name,
              quantity: item.quantity ?? null,
              unit: item.unit ?? '',
              price: item.price ?? null,
              notes: item.notes ?? '',
              is_purchased: item.is_purchased,
              purchased_at: item.is_purchased && !item.purchased_at ? new Date().toISOString() : item.purchased_at ?? null,
              display_order: item.display_order,
              updated_at: new Date().toISOString(),
            })
            .eq('id', item.id);
        } else {
          await supabase.from('shopping_list_items').insert({
            shopping_list_id: listId,
            organization_id: currentOrganization.id,
            catalog_id: catalogId,
            name: item.name,
            quantity: item.quantity ?? null,
            unit: item.unit ?? '',
            price: item.price ?? null,
            notes: item.notes ?? '',
            is_purchased: item.is_purchased,
            purchased_at: item.is_purchased ? new Date().toISOString() : null,
            display_order: item.display_order,
          });
        }
      }

      showToast({
        message: viewMode === 'edit' ? 'Shopping list updated' : 'Shopping list saved',
        type: 'success',
      });
      resetForm();
      await loadLists();
      setViewMode('list');
    } catch (error: any) {
      showToast({ message: error.message || 'Failed to save shopping list', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePurchased = async (list: ShoppingList, itemIndex: number) => {
    if (!currentOrganization) return;
    const item = list.items[itemIndex];
    if (!item.id) return;

    const newValue = !item.is_purchased;
    const updatedItems = [...list.items];
    updatedItems[itemIndex] = {
      ...item,
      is_purchased: newValue,
      purchased_at: newValue ? new Date().toISOString() : undefined,
    };

    setLists(prev =>
      prev.map(l => (l.id === list.id ? { ...l, items: updatedItems } : l))
    );

    try {
      const { error } = await supabase
        .from('shopping_list_items')
        .update({
          is_purchased: newValue,
          purchased_at: newValue ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.id);

      if (error) throw error;

      const allPurchased = updatedItems.length > 0 && updatedItems.every(i => i.is_purchased);
      if (allPurchased !== list.is_completed) {
        await supabase
          .from('shopping_lists')
          .update({ is_completed: allPurchased, updated_at: new Date().toISOString() })
          .eq('id', list.id);
        setLists(prev =>
          prev.map(l => (l.id === list.id ? { ...l, is_completed: allPurchased, items: updatedItems } : l))
        );
      }
    } catch (error: any) {
      showToast({ message: 'Failed to update item', type: 'error' });
      setLists(prev =>
        prev.map(l => (l.id === list.id ? { ...l, items: list.items } : l))
      );
    }
  };

  const handleDeleteList = async (list: ShoppingList) => {
    if (!canEdit) {
      showToast({ message: 'Only owners, admins, and managers can delete lists', type: 'error' });
      return;
    }

    Alert.alert('Delete Shopping List', `Delete "${list.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const { error } = await supabase.from('shopping_lists').delete().eq('id', list.id);
            if (error) throw error;
            showToast({ message: 'Shopping list deleted', type: 'success' });
            await loadLists();
          } catch (error: any) {
            showToast({ message: error.message || 'Failed to delete', type: 'error' });
          }
        },
      },
    ]);
    setShowActionMenu(null);
  };

  const handleEditList = (list: ShoppingList) => {
    setSelectedList(list);
    setListName(list.title);
    setListNotes(list.notes || '');
    setListItems(list.items);
    setViewMode('edit');
    setShowActionMenu(null);
  };

  const getListTotal = (items: ShoppingListItem[]) => {
    return items.reduce((sum, item) => {
      if (!item.price) return sum;
      return sum + item.price * (item.quantity || 1);
    }, 0);
  };

  const getPurchasedTotal = (items: ShoppingListItem[]) => {
    return items.reduce((sum, item) => {
      if (!item.price || !item.is_purchased) return sum;
      return sum + item.price * (item.quantity || 1);
    }, 0);
  };

  const styles = makeStyles(colors);

  const renderListView = () => (
    <>
      <TouchableOpacity
        style={styles.createButton}
        onPress={() => {
          resetForm();
          setViewMode('create');
        }}
      >
        <LinearGradient
          colors={['#1B4D6E', '#245d82']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientFill}
        >
          <Plus size={20} color="#fff" />
          <Text style={styles.createButtonText}>New Shopping List</Text>
        </LinearGradient>
      </TouchableOpacity>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading lists...</Text>
        </View>
      ) : lists.length === 0 ? (
        <View style={styles.emptyState}>
          <ShoppingCart size={64} color={colors.textSecondary} strokeWidth={1.5} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No shopping lists yet</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Track supplies you need to buy with running totals and checkboxes
          </Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => {
              resetForm();
              setViewMode('create');
            }}
          >
            <LinearGradient
              colors={['#1B4D6E', '#245d82']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.gradientFill}
            >
              <Plus size={20} color="#fff" />
              <Text style={styles.emptyButtonText}>Create Your First List</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={styles.listContainer} showsVerticalScrollIndicator={false}>
          {lists.map((list) => {
            const total = getListTotal(list.items);
            const purchasedTotal = getPurchasedTotal(list.items);
            const purchasedCount = list.items.filter(i => i.is_purchased).length;
            const progress = list.items.length > 0 ? purchasedCount / list.items.length : 0;

            return (
              <View
                key={list.id}
                style={[
                  styles.listCard,
                  {
                    backgroundColor: colors.cardBackground,
                    borderColor: list.is_completed ? colors.success + '40' : colors.border,
                  },
                ]}
              >
                <View style={styles.listCardHeader}>
                  <View style={styles.listCardTitleRow}>
                    <View style={styles.listCardTitleWrap}>
                      {list.is_completed && (
                        <CircleCheck size={18} color={colors.success} style={{ marginRight: 6 }} />
                      )}
                      <Text
                        style={[
                          styles.listCardTitle,
                          { color: colors.text },
                          list.is_completed && { textDecorationLine: 'line-through', color: colors.textSecondary },
                        ]}
                        numberOfLines={1}
                      >
                        {list.title}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.menuButton, { backgroundColor: colors.inputBackground }]}
                      onPress={(e) => {
                        e.stopPropagation();
                        setShowActionMenu(showActionMenu === list.id ? null : list.id);
                      }}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <MoreVertical size={18} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>

                  {list.notes ? (
                    <Text style={[styles.listCardNotes, { color: colors.textSecondary }]} numberOfLines={1}>
                      {list.notes}
                    </Text>
                  ) : null}

                  <View style={styles.listCardMeta}>
                    <View style={[styles.metaBadge, { backgroundColor: colors.primary + '15' }]}>
                      <Package size={13} color={colors.primary} />
                      <Text style={[styles.metaBadgeText, { color: colors.primary }]}>
                        {purchasedCount}/{list.items.length}
                      </Text>
                    </View>
                    {total > 0 && (
                      <View style={[styles.metaBadge, { backgroundColor: colors.success + '15' }]}>
                        <DollarSign size={13} color={colors.success} />
                        <Text style={[styles.metaBadgeText, { color: colors.success }]}>
                          {purchasedTotal > 0
                            ? `$${purchasedTotal.toFixed(2)} / $${total.toFixed(2)}`
                            : `$${total.toFixed(2)}`}
                        </Text>
                      </View>
                    )}
                  </View>

                  {list.items.length > 0 && (
                    <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            backgroundColor: progress === 1 ? colors.success : colors.primary,
                            width: `${progress * 100}%` as any,
                          },
                        ]}
                      />
                    </View>
                  )}
                </View>

                {list.items.length > 0 && (
                  <View style={[styles.itemsPreview, { borderTopColor: colors.border }]}>
                    {list.items.slice(0, 5).map((item, idx) => (
                      <TouchableOpacity
                        key={item.id || idx}
                        style={styles.previewItem}
                        onPress={() => handleTogglePurchased(list, idx)}
                        activeOpacity={0.7}
                      >
                        {item.is_purchased ? (
                          <CircleCheck size={20} color={colors.success} />
                        ) : (
                          <Circle size={20} color={colors.textSecondary} />
                        )}
                        <View style={styles.previewItemContent}>
                          <Text
                            style={[
                              styles.previewItemName,
                              { color: item.is_purchased ? colors.textSecondary : colors.text },
                              item.is_purchased && styles.strikethrough,
                            ]}
                            numberOfLines={1}
                          >
                            {item.quantity ? `${item.quantity}${item.unit ? ` ${item.unit}` : ''} ` : ''}
                            {item.name}
                          </Text>
                        </View>
                        {item.price != null && (
                          <Text style={[styles.previewItemPrice, { color: colors.textSecondary }]}>
                            ${(item.price * (item.quantity || 1)).toFixed(2)}
                          </Text>
                        )}
                      </TouchableOpacity>
                    ))}
                    {list.items.length > 5 && (
                      <TouchableOpacity
                        style={styles.showMoreButton}
                        onPress={() => handleEditList(list)}
                      >
                        <Text style={[styles.showMoreText, { color: colors.primary }]}>
                          +{list.items.length - 5} more items — tap to view all
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {showActionMenu === list.id && (
                  <View style={[styles.actionMenu, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <TouchableOpacity style={styles.actionMenuItem} onPress={() => handleEditList(list)}>
                      <Edit3 size={18} color={colors.text} />
                      <Text style={[styles.actionMenuText, { color: colors.text }]}>Edit List</Text>
                    </TouchableOpacity>
                    <View style={[styles.actionMenuDivider, { backgroundColor: colors.border }]} />
                    <TouchableOpacity style={styles.actionMenuItem} onPress={() => handleDeleteList(list)}>
                      <Trash2 size={18} color={colors.error} />
                      <Text style={[styles.actionMenuText, { color: colors.error }]}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
    </>
  );

  const renderFormView = () => {
    const formTotal = getListTotal(listItems);
    const purchasedFormTotal = getPurchasedTotal(listItems);

    return (
      <ScrollView style={styles.formContainer} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.formSection}>
          <Text style={[styles.formLabel, { color: colors.text }]}>List Name *</Text>
          <TextInput
            style={[styles.formInput, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
            placeholder="e.g., Hardware Store Run"
            placeholderTextColor={colors.textSecondary}
            value={listName}
            onChangeText={setListName}
          />
        </View>

        <View style={styles.formSection}>
          <Text style={[styles.formLabel, { color: colors.text }]}>Notes (optional)</Text>
          <TextInput
            style={[styles.formInput, styles.formInputMultiline, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
            placeholder="Add notes for this shopping trip"
            placeholderTextColor={colors.textSecondary}
            value={listNotes}
            onChangeText={setListNotes}
            multiline
          />
        </View>

        <View style={styles.formSection}>
          <View style={styles.itemsHeaderRow}>
            <Text style={[styles.formLabel, { color: colors.text }]}>
              Items ({listItems.length})
            </Text>
            {formTotal > 0 && (
              <View style={[styles.totalBadge, { backgroundColor: colors.success + '15' }]}>
                <DollarSign size={13} color={colors.success} />
                <Text style={[styles.totalBadgeText, { color: colors.success }]}>
                  {purchasedFormTotal > 0
                    ? `$${purchasedFormTotal.toFixed(2)} / $${formTotal.toFixed(2)}`
                    : `Total: $${formTotal.toFixed(2)}`}
                </Text>
              </View>
            )}
          </View>

          {listItems.length > 0 && (
            <View style={[styles.itemsList, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
              {listItems.map((item, index) => (
                <View
                  key={index}
                  style={[
                    styles.itemRow,
                    index > 0 && { borderTopWidth: 1, borderTopColor: colors.border },
                  ]}
                >
                  <TouchableOpacity
                    onPress={() => handleToggleItemInForm(index)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    {item.is_purchased ? (
                      <CircleCheck size={22} color={colors.success} />
                    ) : (
                      <Circle size={22} color={colors.textSecondary} />
                    )}
                  </TouchableOpacity>
                  <View style={styles.itemRowContent}>
                    <Text
                      style={[
                        styles.itemRowLabel,
                        { color: item.is_purchased ? colors.textSecondary : colors.text },
                        item.is_purchased && styles.strikethrough,
                      ]}
                    >
                      {item.name}
                    </Text>
                    <View style={styles.itemRowMeta}>
                      {(item.quantity || item.unit) && (
                        <Text style={[styles.itemMetaText, { color: colors.textSecondary }]}>
                          {item.quantity}{item.unit ? ` ${item.unit}` : ''}
                        </Text>
                      )}
                      {item.price != null && (
                        <Text style={[styles.itemMetaPrice, { color: colors.primary }]}>
                          ${(item.price * (item.quantity || 1)).toFixed(2)}
                        </Text>
                      )}
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.itemRowDelete}
                    onPress={() => handleRemoveItem(index)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Trash2 size={16} color={colors.error} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          <View style={styles.addItemSection}>
            <View style={styles.addItemNameRow}>
              <View style={[styles.addItemInputWrap, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
                <Search size={16} color={colors.textSecondary} />
                <TextInput
                  style={[styles.addItemNameInput, { color: colors.text }]}
                  placeholder="Item name (type to search catalog)"
                  placeholderTextColor={colors.textSecondary}
                  value={newItemName}
                  onChangeText={handleItemNameChange}
                  onFocus={() => newItemName.length >= 2 && setShowSuggestions(catalogSuggestions.length > 0)}
                />
                {catalogSearching && <ActivityIndicator size="small" color={colors.textSecondary} />}
              </View>
            </View>

            {showSuggestions && catalogSuggestions.length > 0 && (
              <View style={[styles.suggestions, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {catalogSuggestions.map((suggestion) => (
                  <TouchableOpacity
                    key={suggestion.id}
                    style={[styles.suggestionItem, { borderBottomColor: colors.border }]}
                    onPress={() => handleSelectSuggestion(suggestion)}
                  >
                    <View style={styles.suggestionContent}>
                      <Text style={[styles.suggestionName, { color: colors.text }]}>{suggestion.name}</Text>
                      <View style={styles.suggestionMeta}>
                        {suggestion.default_unit && (
                          <Text style={[styles.suggestionUnit, { color: colors.textSecondary }]}>
                            {suggestion.default_unit}
                          </Text>
                        )}
                        {suggestion.last_price != null && (
                          <Text style={[styles.suggestionPrice, { color: colors.primary }]}>
                            ${suggestion.last_price.toFixed(2)}
                          </Text>
                        )}
                      </View>
                    </View>
                    <Text style={[styles.suggestionUsage, { color: colors.textSecondary }]}>
                      used {suggestion.usage_count}x
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View style={styles.addItemDetailsRow}>
              <TextInput
                style={[styles.addItemSmall, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
                placeholder="Qty"
                placeholderTextColor={colors.textSecondary}
                value={newItemQuantity}
                onChangeText={setNewItemQuantity}
                keyboardType="decimal-pad"
              />
              <TextInput
                style={[styles.addItemMedium, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
                placeholder="Unit"
                placeholderTextColor={colors.textSecondary}
                value={newItemUnit}
                onChangeText={setNewItemUnit}
              />
              <View style={[styles.addItemPriceContainer, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
                <DollarSign size={15} color={colors.textSecondary} />
                <TextInput
                  style={[styles.addItemPriceInput, { color: colors.text }]}
                  placeholder="Price"
                  placeholderTextColor={colors.textSecondary}
                  value={newItemPrice}
                  onChangeText={setNewItemPrice}
                  keyboardType="decimal-pad"
                />
              </View>
              <TouchableOpacity
                style={[styles.addItemButton, { backgroundColor: newItemName.trim() ? undefined : colors.border }]}
                onPress={handleAddItem}
                disabled={!newItemName.trim()}
              >
                {newItemName.trim() ? (
                  <LinearGradient
                    colors={['#1B4D6E', '#245d82']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.gradientFillCenter}
                  >
                    <Plus size={20} color="#fff" />
                  </LinearGradient>
                ) : (
                  <Plus size={20} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.saveButton,
            (!listName.trim()) && styles.saveButtonDisabled,
          ]}
          onPress={handleSaveList}
          disabled={saving || !listName.trim()}
        >
          <LinearGradient
            colors={['#1B4D6E', '#245d82']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientFill}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Save size={20} color="#fff" />
                <Text style={styles.saveButtonText}>
                  {viewMode === 'edit' ? 'Update List' : 'Save List'}
                </Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    );
  };

  const getHeaderTitle = () => {
    switch (viewMode) {
      case 'create': return 'New Shopping List';
      case 'edit': return 'Edit Shopping List';
      default: return 'Supplies Needed';
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={styles.modalOverlay}
        onPress={() => showActionMenu && setShowActionMenu(null)}
      >
        <Pressable
          style={[styles.modalContent, { backgroundColor: colors.surface }]}
          onPress={() => setShowActionMenu(null)}
        >
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            {viewMode !== 'list' ? (
              <TouchableOpacity
                style={[styles.iconButton, { backgroundColor: colors.inputBackground }]}
                onPress={() => { setViewMode('list'); resetForm(); }}
              >
                <ChevronLeft size={20} color={colors.text} />
              </TouchableOpacity>
            ) : (
              <View style={styles.headerSpacer} />
            )}
            <Text style={[styles.headerTitle, { color: colors.text }]}>{getHeaderTitle()}</Text>
            <TouchableOpacity
              style={[styles.iconButton, { backgroundColor: colors.inputBackground }]}
              onPress={onClose}
            >
              <X size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.contentContainer}>
            {viewMode === 'list' && renderListView()}
            {(viewMode === 'create' || viewMode === 'edit') && renderFormView()}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      borderRadius: 20,
      width: '95%',
      maxWidth: 600,
      maxHeight: '90%',
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
      flex: 1,
      textAlign: 'center',
    },
    headerSpacer: { width: 36 },
    iconButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    contentContainer: {
      flex: 1,
      padding: 16,
    },
    createButton: {
      borderRadius: 12,
      marginBottom: 16,
      overflow: 'hidden',
    },
    createButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 40,
    },
    loadingText: {
      marginTop: 12,
      fontSize: 14,
    },
    emptyState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 40,
      paddingHorizontal: 20,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: '700',
      marginTop: 20,
      marginBottom: 8,
    },
    emptySubtitle: {
      fontSize: 15,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: 24,
    },
    emptyButton: {
      borderRadius: 12,
      overflow: 'hidden',
    },
    emptyButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
    listContainer: { flex: 1 },
    listCard: {
      borderRadius: 14,
      borderWidth: 1,
      marginBottom: 12,
      overflow: 'visible',
    },
    listCardHeader: { padding: 16 },
    listCardTitleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    },
    listCardTitleWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      marginRight: 8,
    },
    listCardTitle: {
      fontSize: 16,
      fontWeight: '600',
      flex: 1,
    },
    listCardNotes: {
      fontSize: 13,
      marginBottom: 10,
    },
    listCardMeta: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 10,
      flexWrap: 'wrap',
    },
    metaBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 8,
    },
    metaBadgeText: {
      fontSize: 13,
      fontWeight: '600',
    },
    progressBar: {
      height: 4,
      borderRadius: 2,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: 2,
    },
    menuButton: {
      width: 32,
      height: 32,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    itemsPreview: {
      borderTopWidth: 1,
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    previewItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      gap: 10,
    },
    previewItemContent: { flex: 1 },
    previewItemName: {
      fontSize: 14,
    },
    previewItemPrice: {
      fontSize: 13,
      fontWeight: '500',
    },
    strikethrough: {
      textDecorationLine: 'line-through',
    },
    showMoreButton: {
      paddingVertical: 8,
      alignItems: 'center',
    },
    showMoreText: {
      fontSize: 13,
      fontWeight: '500',
    },
    actionMenu: {
      position: 'absolute',
      top: 48,
      right: 12,
      borderRadius: 12,
      borderWidth: 1,
      paddingVertical: 8,
      minWidth: 150,
      zIndex: 100,
      ...Platform.select({
        web: { boxShadow: '0 4px 12px rgba(0,0,0,0.15)' },
        default: {
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 12,
        },
      }),
    },
    actionMenuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 16,
    },
    actionMenuText: {
      fontSize: 15,
      fontWeight: '500',
    },
    actionMenuDivider: {
      height: 1,
      marginVertical: 4,
    },
    formContainer: { flex: 1 },
    formSection: { marginBottom: 20 },
    formLabel: {
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 8,
    },
    formInput: {
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
    },
    formInputMultiline: {
      minHeight: 72,
      textAlignVertical: 'top',
    },
    itemsHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    totalBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 8,
    },
    totalBadgeText: {
      fontSize: 13,
      fontWeight: '600',
    },
    itemsList: {
      borderWidth: 1,
      borderRadius: 10,
      marginBottom: 12,
      overflow: 'hidden',
    },
    itemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 12,
      gap: 10,
    },
    itemRowContent: { flex: 1 },
    itemRowLabel: {
      fontSize: 15,
    },
    itemRowMeta: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 2,
    },
    itemMetaText: {
      fontSize: 13,
    },
    itemMetaPrice: {
      fontSize: 13,
      fontWeight: '600',
    },
    itemRowDelete: { padding: 4 },
    addItemSection: { gap: 8 },
    addItemNameRow: {},
    addItemInputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: 12,
      gap: 8,
    },
    addItemNameInput: {
      flex: 1,
      paddingVertical: 12,
      fontSize: 15,
      ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
    } as any,
    suggestions: {
      borderWidth: 1,
      borderRadius: 10,
      overflow: 'hidden',
      ...Platform.select({
        web: { boxShadow: '0 2px 8px rgba(0,0,0,0.1)' },
        default: {
          elevation: 4,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
        },
      }),
    },
    suggestionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderBottomWidth: 1,
    },
    suggestionContent: { flex: 1 },
    suggestionName: {
      fontSize: 15,
      fontWeight: '500',
    },
    suggestionMeta: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 2,
    },
    suggestionUnit: { fontSize: 13 },
    suggestionPrice: {
      fontSize: 13,
      fontWeight: '600',
    },
    suggestionUsage: {
      fontSize: 12,
      marginLeft: 8,
    },
    addItemDetailsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    addItemSmall: {
      width: 56,
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 12,
      fontSize: 15,
      textAlign: 'center',
    },
    addItemMedium: {
      flex: 1,
      minWidth: 60,
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 12,
      fontSize: 15,
    },
    addItemPriceContainer: {
      flex: 1,
      minWidth: 80,
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: 10,
      gap: 4,
    },
    addItemPriceInput: {
      flex: 1,
      paddingVertical: 12,
      fontSize: 15,
      ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
    } as any,
    addItemButton: {
      width: 44,
      height: 44,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    saveButton: {
      borderRadius: 12,
      marginTop: 8,
      marginBottom: 20,
      overflow: 'hidden',
    },
    saveButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
    saveButtonDisabled: { opacity: 0.5 },
    gradientFill: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      paddingHorizontal: 20,
      width: '100%',
    },
    gradientFillCenter: {
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      height: '100%',
    },
  });
}
