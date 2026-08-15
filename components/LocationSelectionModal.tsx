import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import {
  X,
  Search,
  MapPin,
  Check,
  ChevronDown,
  ChevronRight,
  Plus,
  Navigation,
  Loader,
  Building2,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { supabase } from '@/lib/supabase';
import { geocodeAddress } from '@/lib/addressService';
import { RouteLocation } from '@/lib/routeOptimizationService';

interface LocationSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectLocations: (locations: RouteLocation[]) => void;
}

interface AddressOption {
  id: string;
  clientId: string;
  clientName: string;
  label: string;
  address: string;
  latitude: number;
  longitude: number;
  isPrimary: boolean;
  source: 'client_addresses' | 'clients';
  clientType?: 'residential' | 'commercial' | 'contractor';
}

interface ClientGroup {
  clientId: string;
  clientName: string;
  addresses: AddressOption[];
  expanded: boolean;
  clientType?: 'residential' | 'commercial' | 'contractor';
}

interface ManualLocation {
  label: string;
  address: string;
  latitude: string;
  longitude: string;
}

export default function LocationSelectionModal({
  visible,
  onClose,
  onSelectLocations,
}: LocationSelectionModalProps) {
  const { colors } = useTheme();
  const { currentOrganization } = useOrganization();
  const [searchQuery, setSearchQuery] = useState('');
  const [clientGroups, setClientGroups] = useState<ClientGroup[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualLocation, setManualLocation] = useState<ManualLocation>({
    label: '',
    address: '',
    latitude: '',
    longitude: '',
  });
  const [manualError, setManualError] = useState('');
  const [geocoding, setGeocoding] = useState(false);
  const geocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible && currentOrganization) {
      loadAddresses();
    }
    if (!visible) {
      setSelectedIds(new Set());
      setSearchQuery('');
      setExpandedClients(new Set());
      setShowManualEntry(false);
      setManualLocation({ label: '', address: '', latitude: '', longitude: '' });
      setManualError('');
    }
  }, [visible, currentOrganization]);

  const loadAddresses = async () => {
    if (!currentOrganization) return;

    try {
      setLoading(true);

      const [addressesRes, clientsRes] = await Promise.all([
        supabase
          .from('client_addresses')
          .select('id, label, address, latitude, longitude, client_id, is_primary, clients(id, name, client_type)')
          .eq('organization_id', currentOrganization.id)
          .not('latitude', 'is', null)
          .not('longitude', 'is', null),
        supabase
          .from('clients')
          .select('id, name, address, latitude, longitude, client_type')
          .eq('organization_id', currentOrganization.id)
          .not('latitude', 'is', null)
          .not('longitude', 'is', null),
      ]);

      const clientsWithAddressIds = new Set(
        (addressesRes.data || []).map((a: any) => a.client_id)
      );

      const allAddresses: AddressOption[] = [];

      (addressesRes.data || []).forEach((item: any) => {
        allAddresses.push({
          id: `ca_${item.id}`,
          clientId: item.client_id,
          clientName: item.clients?.name || 'Unknown Client',
          label: item.label || (item.is_primary ? 'Primary' : 'Address'),
          address: item.address,
          latitude: parseFloat(item.latitude),
          longitude: parseFloat(item.longitude),
          isPrimary: item.is_primary ?? false,
          source: 'client_addresses',
          clientType: item.clients?.client_type,
        });
      });

      (clientsRes.data || []).forEach((client: any) => {
        if (!clientsWithAddressIds.has(client.id) && client.latitude && client.longitude) {
          allAddresses.push({
            id: `cl_${client.id}`,
            clientId: client.id,
            clientName: client.name,
            label: 'Primary',
            address: client.address || '',
            latitude: parseFloat(client.latitude),
            longitude: parseFloat(client.longitude),
            isPrimary: true,
            source: 'clients',
            clientType: client.client_type,
          });
        }
      });

      const groupMap = new Map<string, ClientGroup>();
      allAddresses.forEach((addr) => {
        if (!groupMap.has(addr.clientId)) {
          groupMap.set(addr.clientId, {
            clientId: addr.clientId,
            clientName: addr.clientName,
            addresses: [],
            expanded: false,
            clientType: addr.clientType,
          });
        }
        groupMap.get(addr.clientId)!.addresses.push(addr);
      });

      groupMap.forEach((group) => {
        group.addresses.sort((a, b) => {
          if (a.isPrimary && !b.isPrimary) return -1;
          if (!a.isPrimary && b.isPrimary) return 1;
          return a.label.localeCompare(b.label);
        });
      });

      const groups = Array.from(groupMap.values()).sort((a, b) =>
        a.clientName.localeCompare(b.clientName)
      );
      setClientGroups(groups);

      const singleAddressExpanded = new Set<string>();
      groups.forEach((g) => {
        if (g.addresses.length === 1) singleAddressExpanded.add(g.clientId);
      });
      setExpandedClients(singleAddressExpanded);
    } catch (error) {
      console.error('Error loading addresses:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredGroups: ClientGroup[] = useMemo(() => {
    if (!searchQuery.trim()) return clientGroups;
    const q = searchQuery.toLowerCase();
    const result: ClientGroup[] = [];
    for (const group of clientGroups) {
      const nameMatch = group.clientName.toLowerCase().includes(q);
      const matchingAddresses = group.addresses.filter(
        (a) =>
          a.address.toLowerCase().includes(q) ||
          a.label.toLowerCase().includes(q) ||
          nameMatch
      );
      if (matchingAddresses.length > 0) {
        result.push({ ...group, addresses: matchingAddresses });
      }
    }
    return result;
  }, [clientGroups, searchQuery]);

  const toggleClientExpanded = (clientId: string) => {
    setExpandedClients((prev) => {
      const next = new Set<string>(prev);
      if (next.has(clientId)) {
        next.delete(clientId);
      } else {
        next.add(clientId);
      }
      return next;
    });
  };

  const toggleSelectAddress = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const isClientFullySelected = (group: ClientGroup) =>
    group.addresses.some((a) => selectedIds.has(a.id));

  const handleSelectAllClients = () => {
    const visibleIds = new Set<string>();
    filteredGroups.forEach((g) => {
      const primary = g.addresses.find((a) => a.isPrimary) || g.addresses[0];
      if (primary) visibleIds.add(primary.id);
    });
    const allSelected = [...visibleIds].every((id) => selectedIds.has(id));
    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        visibleIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredGroups.forEach((g) => {
          g.addresses.forEach((a) => next.delete(a.id));
          const primary = g.addresses.find((a) => a.isPrimary) || g.addresses[0];
          if (primary) next.add(primary.id);
        });
        return next;
      });
    }
  };

  const handleConfirm = () => {
    const allAddresses: AddressOption[] = [];
    clientGroups.forEach((g) => allAddresses.push(...g.addresses));
    const selected = allAddresses.filter((a) => selectedIds.has(a.id));

    const locations: RouteLocation[] = selected.map((addr) => ({
      id: addr.id,
      label: `${addr.clientName}${addr.clientId && addr.source === 'client_addresses' ? ` — ${addr.label}` : ''}`,
      address: addr.address,
      latitude: addr.latitude,
      longitude: addr.longitude,
      clientId: addr.clientId,
      clientAddressId: addr.source === 'client_addresses' ? addr.id.replace('ca_', '') : undefined,
      durationAtStop: 30,
      clientType: addr.clientType,
    }));

    onSelectLocations(locations);
  };

  const handleManualAddressChange = (text: string) => {
    setManualLocation((p) => ({ ...p, address: text, latitude: '', longitude: '' }));
    if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
    if (!text.trim() || text.trim().length < 5) return;
    geocodeTimer.current = setTimeout(async () => {
      setGeocoding(true);
      try {
        const result = await geocodeAddress(text.trim());
        if (result && result.latitude && result.longitude) {
          setManualLocation((p) => ({
            ...p,
            latitude: String(result.latitude),
            longitude: String(result.longitude),
          }));
          setManualError('');
        }
      } finally {
        setGeocoding(false);
      }
    }, 900);
  };

  const handleAddManualLocation = () => {
    setManualError('');
    if (!manualLocation.label.trim()) {
      setManualError('Please enter a label for this location.');
      return;
    }
    if (!manualLocation.address.trim()) {
      setManualError('Please enter an address.');
      return;
    }
    const lat = parseFloat(manualLocation.latitude);
    const lng = parseFloat(manualLocation.longitude);
    if (isNaN(lat) || isNaN(lng)) {
      setManualError('Please enter valid latitude and longitude coordinates.');
      return;
    }

    const id = `manual_${Date.now()}`;
    const location: RouteLocation = {
      id,
      label: manualLocation.label.trim(),
      address: manualLocation.address.trim(),
      latitude: lat,
      longitude: lng,
      durationAtStop: 30,
    };

    onSelectLocations([location]);
    setManualLocation({ label: '', address: '', latitude: '', longitude: '' });
    setShowManualEntry(false);
  };

  const selectedCount = selectedIds.size;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <View style={styles.headerLeft}>
            <MapPin size={22} color={colors.primary} />
            <Text style={[styles.headerTitle, { color: colors.text }]}>Select Locations</Text>
          </View>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <X size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Search size={18} color={colors.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search clients or addresses..."
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>

        <View style={styles.actionsBar}>
          <TouchableOpacity
            style={[styles.actionBarBtn, { backgroundColor: colors.primaryLight }]}
            onPress={handleSelectAllClients}
          >
            <Text style={[styles.actionBarBtnText, { color: colors.primary }]}>
              Select All
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBarBtn, { backgroundColor: colors.primaryLight }]}
            onPress={() => setShowManualEntry(!showManualEntry)}
          >
            <Plus size={14} color={colors.primary} />
            <Text style={[styles.actionBarBtnText, { color: colors.primary }]}>
              Manual Entry
            </Text>
          </TouchableOpacity>
          <Text style={[styles.selectedCount, { color: colors.textSecondary }]}>
            {selectedCount} selected
          </Text>
        </View>

        {showManualEntry && (
          <View style={[styles.manualEntry, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.manualHeader}>
              <Navigation size={16} color={colors.primary} />
              <Text style={[styles.manualTitle, { color: colors.text }]}>Add Manual Location</Text>
            </View>
            {manualError ? (
              <Text style={styles.manualError}>{manualError}</Text>
            ) : null}
            <TextInput
              style={[styles.manualInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
              placeholder="Location label (e.g. Office)"
              placeholderTextColor={colors.textSecondary}
              value={manualLocation.label}
              onChangeText={(t) => setManualLocation((p) => ({ ...p, label: t }))}
            />
            <View style={styles.manualAddressRow}>
              <TextInput
                style={[styles.manualInput, styles.manualAddressInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                placeholder="Full address (auto-geocodes)"
                placeholderTextColor={colors.textSecondary}
                value={manualLocation.address}
                onChangeText={handleManualAddressChange}
              />
              {geocoding && (
                <ActivityIndicator size="small" color={colors.primary} style={styles.geocodeSpinner} />
              )}
            </View>
            <View style={styles.manualRow}>
              <TextInput
                style={[styles.manualInput, styles.manualHalf, { color: colors.text, borderColor: manualLocation.latitude ? colors.primary : colors.border, backgroundColor: colors.background }]}
                placeholder="Latitude (auto)"
                placeholderTextColor={colors.textSecondary}
                value={manualLocation.latitude}
                onChangeText={(t) => setManualLocation((p) => ({ ...p, latitude: t }))}
                keyboardType="numeric"
              />
              <TextInput
                style={[styles.manualInput, styles.manualHalf, { color: colors.text, borderColor: manualLocation.longitude ? colors.primary : colors.border, backgroundColor: colors.background }]}
                placeholder="Longitude (auto)"
                placeholderTextColor={colors.textSecondary}
                value={manualLocation.longitude}
                onChangeText={(t) => setManualLocation((p) => ({ ...p, longitude: t }))}
                keyboardType="numeric"
              />
            </View>
            {manualLocation.latitude && manualLocation.longitude && (
              <View style={[styles.geocodeSuccess, { backgroundColor: colors.primaryLight }]}>
                <Check size={12} color={colors.primary} />
                <Text style={[styles.geocodeSuccessText, { color: colors.primary }]}>
                  Coordinates found — ready to add
                </Text>
              </View>
            )}
            <TouchableOpacity
              style={[styles.manualAddBtn, { overflow: 'hidden' }]}
              onPress={handleAddManualLocation}
            >
              <LinearGradient
                colors={['#1B4D6E', '#245d82']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.manualAddBtnGradient}
              >
                <Text style={styles.manualAddBtnText}>Add to Route</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {filteredGroups.length === 0 ? (
              <View style={styles.emptyState}>
                <MapPin size={48} color={colors.textSecondary} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  {searchQuery ? 'No matching locations found' : 'No client addresses available'}
                </Text>
                <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
                  {searchQuery
                    ? 'Try a different search term'
                    : 'Add addresses to your clients to get started, or use Manual Entry above'}
                </Text>
              </View>
            ) : (
              filteredGroups.map((group) => {
                const isExpanded = expandedClients.has(group.clientId) || !!searchQuery;
                const hasMultiple = group.addresses.length > 1;
                const clientSelected = isClientFullySelected(group);

                const showAddresses = hasMultiple && (isExpanded || !!searchQuery);

                return (
                  <View
                    key={group.clientId}
                    style={[styles.clientCard, { backgroundColor: colors.card, borderColor: clientSelected ? colors.primary : colors.border }]}
                  >
                    <TouchableOpacity
                      style={styles.clientHeader}
                      onPress={() => {
                        if (hasMultiple) {
                          toggleClientExpanded(group.clientId);
                        } else {
                          toggleSelectAddress(group.addresses[0].id);
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.clientHeaderLeft}>
                        <View
                          style={[
                            styles.clientDot,
                            { backgroundColor: clientSelected ? colors.primary : colors.primaryLight },
                          ]}
                        >
                          {clientSelected ? (
                            <Check size={12} color="#fff" />
                          ) : (
                            <MapPin size={12} color={colors.primary} />
                          )}
                        </View>
                        <View style={styles.clientInfo}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={[styles.clientName, { color: colors.text }]}>
                              {group.clientName}
                            </Text>
                            {group.clientType === 'commercial' && (
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(27,77,110,0.1)', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6 }}>
                                <Building2 size={10} color="#1B4D6E" />
                                <Text style={{ fontSize: 9, fontWeight: '700', color: '#1B4D6E' }}>COMM</Text>
                              </View>
                            )}
                          </View>
                          {!hasMultiple && (
                            <Text style={[styles.clientAddress, { color: colors.textSecondary }]} numberOfLines={1}>
                              {group.addresses[0].address}
                            </Text>
                          )}
                          {hasMultiple && (
                            <Text style={[styles.clientAddressCount, { color: colors.primary }]}>
                              {group.addresses.length} addresses — tap to {isExpanded ? 'collapse' : 'expand'}
                            </Text>
                          )}
                        </View>
                      </View>
                      {hasMultiple && (
                        showAddresses
                          ? <ChevronDown size={18} color={colors.textSecondary} />
                          : <ChevronRight size={18} color={colors.textSecondary} />
                      )}
                    </TouchableOpacity>

                    {showAddresses && (
                      <View style={[styles.addressList, { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
                        {group.addresses.map((addr) => (
                          <TouchableOpacity
                            key={addr.id}
                            style={[
                              styles.addressRow,
                              { borderBottomColor: colors.border },
                              selectedIds.has(addr.id) && { backgroundColor: colors.primaryLight },
                            ]}
                            onPress={() => toggleSelectAddress(addr.id)}
                            activeOpacity={0.7}
                          >
                            <View style={styles.addressRowLeft}>
                              <MapPin
                                size={14}
                                color={selectedIds.has(addr.id) ? colors.primary : colors.textSecondary}
                              />
                              <View style={styles.addressRowInfo}>
                                <View style={styles.addressLabelRow}>
                                  <Text style={[styles.addressLabel, { color: selectedIds.has(addr.id) ? colors.primary : colors.text }]}>
                                    {addr.label}
                                  </Text>
                                  {addr.isPrimary && (
                                    <View style={[styles.primaryBadge, { backgroundColor: colors.primaryLight }]}>
                                      <Text style={[styles.primaryBadgeText, { color: colors.primary }]}>Primary</Text>
                                    </View>
                                  )}
                                </View>
                                <Text style={[styles.addressText, { color: colors.textSecondary }]} numberOfLines={1}>
                                  {addr.address}
                                </Text>
                              </View>
                            </View>
                            <View style={[
                              styles.checkIcon,
                              { backgroundColor: selectedIds.has(addr.id) ? colors.primary : colors.border },
                            ]}>
                              {selectedIds.has(addr.id) && <Check size={12} color="#fff" />}
                            </View>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </ScrollView>
        )}

        <View style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={[
              styles.confirmButton,
              { overflow: 'hidden' },
              selectedCount === 0 && styles.confirmButtonDisabled,
            ]}
            onPress={handleConfirm}
            disabled={selectedCount === 0}
          >
            <LinearGradient
              colors={['#1B4D6E', '#245d82']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.confirmButtonGradient}
            >
              <Text style={styles.confirmButtonText}>
                Add {selectedCount} Location{selectedCount !== 1 ? 's' : ''}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
  },
  searchContainer: {
    padding: 16,
    paddingBottom: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    backgroundColor: 'transparent',
    paddingVertical: 0,
    outlineStyle: 'none',
  },
  actionsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  actionBarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  actionBarBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  selectedCount: {
    fontSize: 13,
    fontWeight: '500',
    marginLeft: 'auto',
  },
  manualEntry: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  manualHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  manualTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  manualError: {
    color: '#ef4444',
    fontSize: 13,
  },
  manualInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    outlineStyle: 'none',
  },
  manualAddressRow: {
    position: 'relative',
  },
  manualAddressInput: {
    paddingRight: 36,
  },
  geocodeSpinner: {
    position: 'absolute',
    right: 10,
    top: 12,
  },
  geocodeSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  geocodeSuccessText: {
    fontSize: 12,
    fontWeight: '600',
  },
  manualRow: {
    flexDirection: 'row',
    gap: 8,
  },
  manualHalf: {
    flex: 1,
  },
  manualAddBtn: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  manualAddBtnGradient: {
    padding: 12,
    alignItems: 'center',
  },
  manualAddBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    gap: 8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    maxWidth: 280,
  },
  clientCard: {
    borderRadius: 12,
    borderWidth: 1.5,
  },
  clientHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
  },
  clientHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  clientDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clientInfo: {
    flex: 1,
    gap: 2,
  },
  clientName: {
    fontSize: 15,
    fontWeight: '700',
  },
  clientAddress: {
    fontSize: 13,
  },
  clientAddressCount: {
    fontSize: 12,
    fontWeight: '600',
  },
  addressList: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  addressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    paddingLeft: 58,
  },
  addressRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  addressRowInfo: {
    flex: 1,
    gap: 2,
  },
  addressLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  addressLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  primaryBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  primaryBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  addressText: {
    fontSize: 13,
  },
  checkIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
  },
  confirmButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  confirmButtonGradient: {
    padding: 16,
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    opacity: 0.5,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
