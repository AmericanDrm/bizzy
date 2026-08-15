import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  X,
  Car,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Save,
  Gauge,
  Droplets,
  Pencil,
  Check,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { supabase } from '@/lib/supabase';
import CollapsibleField from './CollapsibleField';
import { useCollapsibleForm } from '@/hooks/useCollapsibleForm';
import { useRegisterModal } from '@/contexts/ModalStackContext';

interface MileageTrackerModalProps {
  visible: boolean;
  onClose: () => void;
}

interface Vehicle {
  id: string;
  name: string;
  make: string | null;
  model: string | null;
  year: number | null;
}

interface MileageReading {
  id: string;
  vehicle_id: string;
  year: number;
  start_reading: number | null;
  end_reading: number | null;
  personal_miles: number;
}

interface OilChange {
  id: string;
  vehicle_id: string;
  date: string;
  cost: number;
  odometer: number;
  notes: string | null;
}

export default function MileageTrackerModal({ visible, onClose }: MileageTrackerModalProps) {
  useRegisterModal('mileage-tracker-modal', visible, onClose);
  const { colors } = useTheme();
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const [loading, setLoading] = useState(true);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [readings, setReadings] = useState<MileageReading[]>([]);
  const [expandedVehicle, setExpandedVehicle] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [newVehicleName, setNewVehicleName] = useState('');
  const [saving, setSaving] = useState<string | null>(null);
  const [addingVehicle, setAddingVehicle] = useState(false);

  const [editValues, setEditValues] = useState<Record<string, {
    start_reading: string;
    end_reading: string;
    personal_miles: string;
  }>>({});

  const [oilChanges, setOilChanges] = useState<OilChange[]>([]);
  const [oilExpanded, setOilExpanded] = useState<string | null>(null);
  const [showAddOil, setShowAddOil] = useState<string | null>(null);
  const [oilDate, setOilDate] = useState(new Date().toISOString().split('T')[0]);
  const [oilCost, setOilCost] = useState('');
  const [oilOdometer, setOilOdometer] = useState('');
  const [oilNotes, setOilNotes] = useState('');
  const [savingOil, setSavingOil] = useState(false);
  const [editingOilId, setEditingOilId] = useState<string | null>(null);
  const [editOilDate, setEditOilDate] = useState('');
  const [editOilCost, setEditOilCost] = useState('');
  const [editOilOdometer, setEditOilOdometer] = useState('');
  const [editOilNotes, setEditOilNotes] = useState('');

  const { activeFieldId, toggleField } = useCollapsibleForm();

  useEffect(() => {
    if (visible && user) {
      fetchData();
    }
  }, [visible, user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [vehiclesRes, readingsRes, oilRes] = await Promise.all([
        supabase.from('vehicles').select('id, name, make, model, year').order('created_at'),
        supabase.from('mileage_readings').select('*').eq('year', selectedYear),
        supabase.from('oil_changes').select('*').order('date', { ascending: false }),
      ]);

      if (vehiclesRes.error) throw vehiclesRes.error;
      if (readingsRes.error) throw readingsRes.error;

      setVehicles(vehiclesRes.data || []);
      setReadings(readingsRes.data || []);
      setOilChanges(oilRes.data || []);

      const values: typeof editValues = {};
      (readingsRes.data || []).forEach((r: MileageReading) => {
        values[r.vehicle_id] = {
          start_reading: r.start_reading?.toString() || '',
          end_reading: r.end_reading?.toString() || '',
          personal_miles: r.personal_miles?.toString() || '0',
        };
      });
      setEditValues(values);
    } catch (error) {
      console.error('Error fetching mileage data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible && user && !loading) {
      fetchReadingsForYear();
    }
  }, [selectedYear]);

  const fetchReadingsForYear = async () => {
    try {
      const { data, error } = await supabase
        .from('mileage_readings')
        .select('*')
        .eq('year', selectedYear);

      if (error) throw error;

      setReadings(data || []);
      const values: typeof editValues = {};
      (data || []).forEach((r: MileageReading) => {
        values[r.vehicle_id] = {
          start_reading: r.start_reading?.toString() || '',
          end_reading: r.end_reading?.toString() || '',
          personal_miles: r.personal_miles?.toString() || '0',
        };
      });
      setEditValues(values);
    } catch (error) {
      console.error('Error fetching readings:', error);
    }
  };

  const handleAddVehicle = async () => {
    if (!user || !newVehicleName.trim() || !currentOrganization?.id) return;
    setAddingVehicle(true);
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .insert({ user_id: user.id, name: newVehicleName.trim(), organization_id: currentOrganization.id })
        .select()
        .single();

      if (error) throw error;

      setVehicles((prev) => [...prev, data]);
      setNewVehicleName('');
      setShowAddVehicle(false);
      setExpandedVehicle(data.id);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to add vehicle');
    } finally {
      setAddingVehicle(false);
    }
  };

  const handleDeleteVehicle = (vehicle: Vehicle) => {
    const doDelete = async () => {
      try {
        const { error } = await supabase
          .from('vehicles')
          .delete()
          .eq('id', vehicle.id);

        if (error) throw error;

        setVehicles((prev) => prev.filter((v) => v.id !== vehicle.id));
        setReadings((prev) => prev.filter((r) => r.vehicle_id !== vehicle.id));
        if (expandedVehicle === vehicle.id) setExpandedVehicle(null);
      } catch (error: any) {
        Alert.alert('Error', error.message || 'Failed to delete vehicle');
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Delete "${vehicle.name}" and all its mileage data?`)) {
        doDelete();
      }
    } else {
      Alert.alert(
        'Delete Vehicle',
        `Delete "${vehicle.name}" and all its mileage data?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: doDelete },
        ]
      );
    }
  };

  const handleSaveReading = async (vehicleId: string) => {
    if (!user) return;
    const vals = editValues[vehicleId];
    if (!vals) return;

    setSaving(vehicleId);
    try {
      const startReading = vals.start_reading ? parseFloat(vals.start_reading) : null;
      const endReading = vals.end_reading ? parseFloat(vals.end_reading) : null;
      const personalMiles = vals.personal_miles ? parseFloat(vals.personal_miles) : 0;

      if (startReading !== null && isNaN(startReading)) {
        Alert.alert('Invalid Input', 'Start reading must be a number');
        setSaving(null);
        return;
      }
      if (endReading !== null && isNaN(endReading)) {
        Alert.alert('Invalid Input', 'End reading must be a number');
        setSaving(null);
        return;
      }
      if (isNaN(personalMiles) || personalMiles < 0) {
        Alert.alert('Invalid Input', 'Personal miles must be a positive number');
        setSaving(null);
        return;
      }

      const existing = readings.find(
        (r) => r.vehicle_id === vehicleId && r.year === selectedYear
      );

      if (existing) {
        const { error } = await supabase
          .from('mileage_readings')
          .update({
            start_reading: startReading,
            end_reading: endReading,
            personal_miles: personalMiles,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);

        if (error) throw error;

        setReadings((prev) =>
          prev.map((r) =>
            r.id === existing.id
              ? { ...r, start_reading: startReading, end_reading: endReading, personal_miles: personalMiles }
              : r
          )
        );
      } else {
        const { data, error } = await supabase
          .from('mileage_readings')
          .insert({
            user_id: user.id,
            vehicle_id: vehicleId,
            year: selectedYear,
            start_reading: startReading,
            end_reading: endReading,
            personal_miles: personalMiles,
          })
          .select()
          .single();

        if (error) throw error;
        setReadings((prev) => [...prev, data]);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save reading');
    } finally {
      setSaving(null);
    }
  };

  const handleAddOilChange = async (vehicleId: string) => {
    if (!user || !oilDate) return;
    setSavingOil(true);
    try {
      const cost = parseFloat(oilCost) || 0;
      const odometer = parseFloat(oilOdometer) || 0;

      const { data, error } = await supabase
        .from('oil_changes')
        .insert({
          user_id: user.id,
          vehicle_id: vehicleId,
          date: oilDate,
          cost,
          odometer,
          notes: oilNotes.trim() || null,
        })
        .select()
        .single();

      if (error) throw error;

      setOilChanges(prev => [data, ...prev]);
      resetOilForm();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to add oil change');
    } finally {
      setSavingOil(false);
    }
  };

  const handleUpdateOilChange = async (oilChange: OilChange) => {
    setSavingOil(true);
    try {
      const cost = parseFloat(editOilCost) || 0;
      const odometer = parseFloat(editOilOdometer) || 0;

      const { error } = await supabase
        .from('oil_changes')
        .update({
          date: editOilDate,
          cost,
          odometer,
          notes: editOilNotes.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', oilChange.id);

      if (error) throw error;

      setOilChanges(prev => prev.map(oc =>
        oc.id === oilChange.id
          ? { ...oc, date: editOilDate, cost, odometer, notes: editOilNotes.trim() || null }
          : oc
      ));
      setEditingOilId(null);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update oil change');
    } finally {
      setSavingOil(false);
    }
  };

  const handleDeleteOilChange = (oilChange: OilChange) => {
    const doDelete = async () => {
      try {
        const { error } = await supabase.from('oil_changes').delete().eq('id', oilChange.id);
        if (error) throw error;
        setOilChanges(prev => prev.filter(oc => oc.id !== oilChange.id));
      } catch (error: any) {
        Alert.alert('Error', error.message || 'Failed to delete oil change');
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Delete this oil change record?')) doDelete();
    } else {
      Alert.alert('Delete Oil Change', 'Delete this oil change record?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  const resetOilForm = () => {
    setShowAddOil(null);
    setOilDate(new Date().toISOString().split('T')[0]);
    setOilCost('');
    setOilOdometer('');
    setOilNotes('');
  };

  const startEditOil = (oc: OilChange) => {
    setEditingOilId(oc.id);
    setEditOilDate(oc.date);
    setEditOilCost(oc.cost > 0 ? oc.cost.toString() : '');
    setEditOilOdometer(oc.odometer > 0 ? oc.odometer.toString() : '');
    setEditOilNotes(oc.notes || '');
  };

  const getVehicleOilChanges = (vehicleId: string) => {
    return oilChanges.filter(oc => oc.vehicle_id === vehicleId);
  };

  const getMilesBetweenOilChanges = (vehicleOils: OilChange[], index: number): number | null => {
    if (index >= vehicleOils.length - 1) return null;
    const current = vehicleOils[index].odometer;
    const previous = vehicleOils[index + 1].odometer;
    if (!current || !previous) return null;
    return current - previous;
  };

  const getEditValue = (vehicleId: string) => {
    return editValues[vehicleId] || { start_reading: '', end_reading: '', personal_miles: '0' };
  };

  const updateEditValue = (vehicleId: string, field: string, value: string) => {
    setEditValues((prev) => ({
      ...prev,
      [vehicleId]: {
        ...getEditValue(vehicleId),
        [field]: value,
      },
    }));
  };

  const calculateMiles = useCallback((vehicleId: string) => {
    const vals = getEditValue(vehicleId);
    const start = parseFloat(vals.start_reading);
    const end = parseFloat(vals.end_reading);
    const personal = parseFloat(vals.personal_miles) || 0;

    if (isNaN(start) || isNaN(end)) return null;

    const total = end - start;
    const business = total - personal;
    return { total: Math.max(0, total), business: Math.max(0, business), personal };
  }, [editValues]);

  const yearOptions = [];
  const currentYear = new Date().getFullYear();
  for (let y = currentYear; y >= currentYear - 5; y--) {
    yearOptions.push(y);
  }

  const totalBusinessMiles = vehicles.reduce((sum, v) => {
    const calc = calculateMiles(v.id);
    return sum + (calc?.business || 0);
  }, 0);

  const totalAllMiles = vehicles.reduce((sum, v) => {
    const calc = calculateMiles(v.id);
    return sum + (calc?.total || 0);
  }, 0);

  const ds = getDynamicStyles(colors);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={ds.overlay}>
        <View style={ds.modal}>
          <View style={ds.header}>
            <View style={ds.headerLeft}>
              <Gauge size={22} color={colors.primary} />
              <Text style={ds.title}>Mileage Tracker</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <X size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={ds.content} showsVerticalScrollIndicator={false}>
            <View style={ds.yearSelector}>
              <Text style={ds.yearLabel}>Tax Year</Text>
              <View style={ds.yearRow}>
                {yearOptions.map((y) => (
                  <TouchableOpacity
                    key={y}
                    style={[ds.yearChip, selectedYear === y && ds.yearChipActive]}
                    onPress={() => setSelectedYear(y)}
                  >
                    <Text style={[ds.yearChipText, selectedYear === y && ds.yearChipTextActive]}>
                      {y}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {totalAllMiles > 0 && (
              <View style={ds.summaryCard}>
                <View style={ds.summaryRow}>
                  <View style={ds.summaryItem}>
                    <Text style={ds.summaryLabel}>Total Miles</Text>
                    <Text style={ds.summaryValue}>{totalAllMiles.toLocaleString()}</Text>
                  </View>
                  <View style={ds.summaryDivider} />
                  <View style={ds.summaryItem}>
                    <Text style={ds.summaryLabel}>Business Miles</Text>
                    <Text style={[ds.summaryValue, { color: colors.success }]}>
                      {totalBusinessMiles.toLocaleString()}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            <Text style={ds.sectionTitle}>Vehicles</Text>

            {loading ? (
              <View style={ds.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : (
              <>
                {vehicles.length === 0 && (
                  <View style={ds.emptyState}>
                    <Car size={40} color={colors.textSecondary} />
                    <Text style={ds.emptyTitle}>No vehicles added</Text>
                    <Text style={ds.emptySubtext}>
                      Add a vehicle to start tracking mileage
                    </Text>
                  </View>
                )}

                {vehicles.map((vehicle) => {
                  const isExpanded = expandedVehicle === vehicle.id;
                  const vals = getEditValue(vehicle.id);
                  const calc = calculateMiles(vehicle.id);

                  return (
                    <View key={vehicle.id} style={ds.vehicleCard}>
                      <TouchableOpacity
                        style={ds.vehicleHeader}
                        onPress={() => setExpandedVehicle(isExpanded ? null : vehicle.id)}
                      >
                        <View style={ds.vehicleIconContainer}>
                          <Car size={20} color={colors.primary} />
                        </View>
                        <View style={ds.vehicleInfo}>
                          <Text style={ds.vehicleName}>{vehicle.name}</Text>
                          {calc && (
                            <Text style={ds.vehicleMilesSummary}>
                              {calc.business.toLocaleString()} business mi
                            </Text>
                          )}
                        </View>
                        <ChevronRight
                          size={20}
                          color={colors.textSecondary}
                          style={{ transform: [{ rotate: isExpanded ? '90deg' : '0deg' }] }}
                        />
                      </TouchableOpacity>

                      {isExpanded && (
                        <View style={ds.vehicleContent}>
                          <View style={ds.readingRow}>
                            <View style={ds.readingField}>
                              <CollapsibleField
                                label="Jan 1 Odometer"
                                fieldId={`${vehicle.id}-start-reading`}
                                activeFieldId={activeFieldId}
                                onToggle={toggleField}
                                displayValue={vals.start_reading || undefined}
                              >
                                <TextInput
                                  style={ds.fieldInput}
                                  value={vals.start_reading}
                                  onChangeText={(v) => updateEditValue(vehicle.id, 'start_reading', v)}
                                  placeholder="e.g. 45000"
                                  placeholderTextColor={colors.textSecondary}
                                  keyboardType="numeric"
                                />
                              </CollapsibleField>
                            </View>
                            <View style={ds.readingField}>
                              <CollapsibleField
                                label="Dec 31 Odometer"
                                fieldId={`${vehicle.id}-end-reading`}
                                activeFieldId={activeFieldId}
                                onToggle={toggleField}
                                displayValue={vals.end_reading || undefined}
                              >
                                <TextInput
                                  style={ds.fieldInput}
                                  value={vals.end_reading}
                                  onChangeText={(v) => updateEditValue(vehicle.id, 'end_reading', v)}
                                  placeholder="e.g. 60000"
                                  placeholderTextColor={colors.textSecondary}
                                  keyboardType="numeric"
                                />
                              </CollapsibleField>
                            </View>
                          </View>

                          <View style={ds.personalMilesRow}>
                            <CollapsibleField
                              label="Personal Miles"
                              fieldId={`${vehicle.id}-personal-miles`}
                              activeFieldId={activeFieldId}
                              onToggle={toggleField}
                              displayValue={vals.personal_miles || undefined}
                            >
                              <TextInput
                                style={[ds.fieldInput, { flex: 1 }]}
                                value={vals.personal_miles}
                                onChangeText={(v) => updateEditValue(vehicle.id, 'personal_miles', v)}
                                placeholder="0"
                                placeholderTextColor={colors.textSecondary}
                                keyboardType="numeric"
                              />
                            </CollapsibleField>
                          </View>

                          {calc && (
                            <View style={ds.calcCard}>
                              <View style={ds.calcRow}>
                                <Text style={ds.calcLabel}>Total Miles Driven</Text>
                                <Text style={ds.calcValue}>{calc.total.toLocaleString()}</Text>
                              </View>
                              <View style={ds.calcDivider} />
                              <View style={ds.calcRow}>
                                <Text style={ds.calcLabel}>Personal Miles</Text>
                                <Text style={[ds.calcValue, { color: colors.textSecondary }]}>
                                  -{calc.personal.toLocaleString()}
                                </Text>
                              </View>
                              <View style={ds.calcDivider} />
                              <View style={ds.calcRow}>
                                <Text style={[ds.calcLabel, { fontWeight: '700' }]}>
                                  Business Miles
                                </Text>
                                <Text style={[ds.calcValue, { color: colors.success, fontWeight: '700' }]}>
                                  {calc.business.toLocaleString()}
                                </Text>
                              </View>
                            </View>
                          )}

                          <View style={ds.actionRow}>
                            <TouchableOpacity
                              style={ds.saveReadingButton}
                              onPress={() => handleSaveReading(vehicle.id)}
                              disabled={saving === vehicle.id}
                            >
                              <LinearGradient
                                colors={['#1B4D6E', '#245d82']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={ds.saveReadingGradient}
                              >
                                {saving === vehicle.id ? (
                                  <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                  <>
                                    <Save size={16} color="#fff" />
                                    <Text style={ds.saveReadingText}>Save</Text>
                                  </>
                                )}
                              </LinearGradient>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={ds.deleteVehicleButton}
                              onPress={() => handleDeleteVehicle(vehicle)}
                            >
                              <Trash2 size={16} color={colors.error} />
                            </TouchableOpacity>
                          </View>

                          <OilChangesSection
                            vehicleId={vehicle.id}
                            oilChanges={getVehicleOilChanges(vehicle.id)}
                            getMilesBetween={getMilesBetweenOilChanges}
                            isExpanded={oilExpanded === vehicle.id}
                            onToggleExpand={() => setOilExpanded(prev => prev === vehicle.id ? null : vehicle.id)}
                            showAddForm={showAddOil === vehicle.id}
                            onShowAddForm={() => setShowAddOil(vehicle.id)}
                            onCancelAdd={resetOilForm}
                            oilDate={oilDate}
                            setOilDate={setOilDate}
                            oilCost={oilCost}
                            setOilCost={setOilCost}
                            oilOdometer={oilOdometer}
                            setOilOdometer={setOilOdometer}
                            oilNotes={oilNotes}
                            setOilNotes={setOilNotes}
                            onAdd={() => handleAddOilChange(vehicle.id)}
                            savingOil={savingOil}
                            editingOilId={editingOilId}
                            editOilDate={editOilDate}
                            setEditOilDate={setEditOilDate}
                            editOilCost={editOilCost}
                            setEditOilCost={setEditOilCost}
                            editOilOdometer={editOilOdometer}
                            setEditOilOdometer={setEditOilOdometer}
                            editOilNotes={editOilNotes}
                            setEditOilNotes={setEditOilNotes}
                            onStartEdit={startEditOil}
                            onSaveEdit={handleUpdateOilChange}
                            onCancelEdit={() => setEditingOilId(null)}
                            onDelete={handleDeleteOilChange}
                            colors={colors}
                            ds={ds}
                          />
                        </View>
                      )}
                    </View>
                  );
                })}
              </>
            )}

            {showAddVehicle ? (
              <View style={ds.addVehicleForm}>
                <CollapsibleField
                  label="Vehicle Name"
                  fieldId="new-vehicle-name"
                  activeFieldId={activeFieldId}
                  onToggle={toggleField}
                  displayValue={newVehicleName || undefined}
                >
                  <TextInput
                    style={ds.addVehicleInput}
                    value={newVehicleName}
                    onChangeText={setNewVehicleName}
                    placeholder="Vehicle name (e.g. 2020 Ford F-150)"
                    placeholderTextColor={colors.textSecondary}
                    autoFocus
                  />
                </CollapsibleField>
                <View style={ds.addVehicleActions}>
                  <TouchableOpacity
                    style={ds.addVehicleSave}
                    onPress={handleAddVehicle}
                    disabled={addingVehicle || !newVehicleName.trim()}
                  >
                    <LinearGradient
                      colors={['#1B4D6E', '#245d82']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={ds.addVehicleSaveGradient}
                    >
                      {addingVehicle ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={ds.addVehicleSaveText}>Add Vehicle</Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={ds.addVehicleCancel}
                    onPress={() => { setShowAddVehicle(false); setNewVehicleName(''); }}
                  >
                    <Text style={ds.addVehicleCancelText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={ds.addButton}
                onPress={() => setShowAddVehicle(true)}
              >
                <Plus size={20} color={colors.primary} />
                <Text style={ds.addButtonText}>Add Vehicle</Text>
              </TouchableOpacity>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function OilChangesSection({
  vehicleId, oilChanges, getMilesBetween, isExpanded, onToggleExpand,
  showAddForm, onShowAddForm, onCancelAdd,
  oilDate, setOilDate, oilCost, setOilCost, oilOdometer, setOilOdometer, oilNotes, setOilNotes,
  onAdd, savingOil,
  editingOilId, editOilDate, setEditOilDate, editOilCost, setEditOilCost,
  editOilOdometer, setEditOilOdometer, editOilNotes, setEditOilNotes,
  onStartEdit, onSaveEdit, onCancelEdit, onDelete,
  colors, ds,
}: any) {
  const formatCost = (n: number) => n > 0 ? `$${n.toFixed(2)}` : '$0.00';
  const formatOdo = (n: number) => n > 0 ? n.toLocaleString() + ' mi' : '-';
  const formatDateShort = (d: string) => {
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <View style={ds.oilSection}>
      <TouchableOpacity style={ds.oilHeader} onPress={onToggleExpand} activeOpacity={0.7}>
        <View style={ds.oilHeaderLeft}>
          <Droplets size={16} color="#d97706" />
          <Text style={ds.oilHeaderTitle}>Oil Changes</Text>
          {oilChanges.length > 0 && (
            <View style={ds.oilBadge}>
              <Text style={ds.oilBadgeText}>{oilChanges.length}</Text>
            </View>
          )}
        </View>
        {isExpanded ? <ChevronUp size={16} color={colors.textSecondary} /> : <ChevronDown size={16} color={colors.textSecondary} />}
      </TouchableOpacity>

      {isExpanded && (
        <View style={ds.oilBody}>
          {oilChanges.length === 0 && (
            <Text style={ds.oilEmptyText}>No oil changes recorded yet</Text>
          )}

          {oilChanges.map((oc: OilChange, index: number) => {
            const milesBetween = getMilesBetween(oilChanges, index);
            const isEditing = editingOilId === oc.id;

            if (isEditing) {
              return (
                <View key={oc.id} style={ds.oilEditForm}>
                  <View style={ds.oilFormRow}>
                    <View style={ds.oilFormCol}>
                      <Text style={ds.oilFormLabel}>Date</Text>
                      <TextInput
                        style={ds.oilFormInput}
                        value={editOilDate}
                        onChangeText={setEditOilDate}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor={colors.textSecondary + '80'}
                      />
                    </View>
                    <View style={ds.oilFormCol}>
                      <Text style={ds.oilFormLabel}>Odometer</Text>
                      <TextInput
                        style={ds.oilFormInput}
                        value={editOilOdometer}
                        onChangeText={setEditOilOdometer}
                        placeholder="Miles"
                        placeholderTextColor={colors.textSecondary + '80'}
                        keyboardType="numeric"
                      />
                    </View>
                  </View>
                  <View style={ds.oilFormRow}>
                    <View style={ds.oilFormCol}>
                      <Text style={ds.oilFormLabel}>Cost</Text>
                      <TextInput
                        style={ds.oilFormInput}
                        value={editOilCost}
                        onChangeText={setEditOilCost}
                        placeholder="$0.00"
                        placeholderTextColor={colors.textSecondary + '80'}
                        keyboardType="decimal-pad"
                      />
                    </View>
                    <View style={ds.oilFormCol}>
                      <Text style={ds.oilFormLabel}>Notes</Text>
                      <TextInput
                        style={ds.oilFormInput}
                        value={editOilNotes}
                        onChangeText={setEditOilNotes}
                        placeholder="Optional"
                        placeholderTextColor={colors.textSecondary + '80'}
                      />
                    </View>
                  </View>
                  <View style={ds.oilEditActions}>
                    <TouchableOpacity style={ds.oilEditSaveBtn} onPress={() => onSaveEdit(oc)} disabled={savingOil}>
                      {savingOil ? <ActivityIndicator size="small" color="#fff" /> : <Text style={ds.oilEditSaveBtnText}>Save</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity style={ds.oilEditCancelBtn} onPress={onCancelEdit}>
                      <Text style={ds.oilEditCancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }

            return (
              <View key={oc.id} style={ds.oilRow}>
                <View style={ds.oilRowLeft}>
                  <Text style={ds.oilRowDate}>{formatDateShort(oc.date)}</Text>
                  <Text style={ds.oilRowOdometer}>{formatOdo(oc.odometer)}</Text>
                  {milesBetween !== null && milesBetween > 0 && (
                    <Text style={ds.oilRowMilesBetween}>{milesBetween.toLocaleString()} mi since last</Text>
                  )}
                  {oc.notes ? <Text style={ds.oilRowNotes} numberOfLines={1}>{oc.notes}</Text> : null}
                </View>
                <View style={ds.oilRowRight}>
                  <Text style={ds.oilRowCost}>{formatCost(oc.cost)}</Text>
                  <View style={ds.oilRowActions}>
                    <TouchableOpacity onPress={() => onStartEdit(oc)} style={ds.oilIconBtn}>
                      <Pencil size={13} color={colors.textSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => onDelete(oc)} style={ds.oilIconBtn}>
                      <Trash2 size={13} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })}

          {showAddForm ? (
            <View style={ds.oilAddForm}>
              <View style={ds.oilFormRow}>
                <View style={ds.oilFormCol}>
                  <Text style={ds.oilFormLabel}>Date</Text>
                  <TextInput
                    style={ds.oilFormInput}
                    value={oilDate}
                    onChangeText={setOilDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.textSecondary + '80'}
                  />
                </View>
                <View style={ds.oilFormCol}>
                  <Text style={ds.oilFormLabel}>Odometer</Text>
                  <TextInput
                    style={ds.oilFormInput}
                    value={oilOdometer}
                    onChangeText={setOilOdometer}
                    placeholder="Current miles"
                    placeholderTextColor={colors.textSecondary + '80'}
                    keyboardType="numeric"
                  />
                </View>
              </View>
              <View style={ds.oilFormRow}>
                <View style={ds.oilFormCol}>
                  <Text style={ds.oilFormLabel}>Cost</Text>
                  <TextInput
                    style={ds.oilFormInput}
                    value={oilCost}
                    onChangeText={setOilCost}
                    placeholder="$0.00"
                    placeholderTextColor={colors.textSecondary + '80'}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={ds.oilFormCol}>
                  <Text style={ds.oilFormLabel}>Notes</Text>
                  <TextInput
                    style={ds.oilFormInput}
                    value={oilNotes}
                    onChangeText={setOilNotes}
                    placeholder="Oil type, shop, etc."
                    placeholderTextColor={colors.textSecondary + '80'}
                  />
                </View>
              </View>
              <View style={ds.oilEditActions}>
                <TouchableOpacity style={ds.oilEditSaveBtn} onPress={onAdd} disabled={savingOil}>
                  {savingOil ? <ActivityIndicator size="small" color="#fff" /> : <Text style={ds.oilEditSaveBtnText}>Add Oil Change</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={ds.oilEditCancelBtn} onPress={onCancelAdd}>
                  <Text style={ds.oilEditCancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={ds.oilAddBtn} onPress={onShowAddForm} activeOpacity={0.7}>
              <Plus size={13} color="#d97706" />
              <Text style={ds.oilAddBtnText}>Add Oil Change</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const getDynamicStyles = (colors: any) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    modal: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '92%',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    title: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text,
    },
    content: {
      padding: 20,
    },
    yearSelector: {
      marginBottom: 20,
    },
    yearLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 10,
    },
    yearRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    yearChip: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
    },
    yearChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    yearChipText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    yearChipTextActive: {
      color: '#fff',
    },
    summaryCard: {
      backgroundColor: colors.cardBackground,
      borderRadius: 14,
      padding: 20,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },
    summaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    summaryItem: {
      flex: 1,
      alignItems: 'center',
    },
    summaryDivider: {
      width: 1,
      height: 40,
      backgroundColor: colors.border,
    },
    summaryLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 6,
    },
    summaryValue: {
      fontSize: 22,
      fontWeight: 'bold',
      color: colors.text,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 12,
    },
    loadingContainer: {
      padding: 40,
      alignItems: 'center',
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: 32,
      gap: 8,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginTop: 8,
    },
    emptySubtext: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    vehicleCard: {
      backgroundColor: colors.cardBackground,
      borderRadius: 12,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    vehicleHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      gap: 12,
    },
    vehicleIconContainer: {
      width: 40,
      height: 40,
      borderRadius: 10,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    vehicleInfo: {
      flex: 1,
    },
    vehicleName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    vehicleMilesSummary: {
      fontSize: 13,
      color: colors.success,
      marginTop: 2,
      fontWeight: '500',
    },
    vehicleContent: {
      padding: 16,
      paddingTop: 0,
    },
    readingRow: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 12,
    },
    readingField: {
      flex: 1,
    },
    fieldLabel: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.textSecondary,
      marginBottom: 6,
    },
    fieldInput: {
      backgroundColor: colors.inputBackground,
      borderRadius: 8,
      paddingVertical: 10,
      paddingHorizontal: 12,
      fontSize: 15,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
    },
    personalMilesRow: {
      marginBottom: 12,
    },
    calcCard: {
      backgroundColor: colors.inputBackground,
      borderRadius: 10,
      padding: 14,
      marginBottom: 12,
    },
    calcRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 6,
    },
    calcDivider: {
      height: 1,
      backgroundColor: colors.border,
    },
    calcLabel: {
      fontSize: 14,
      color: colors.text,
    },
    calcValue: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    actionRow: {
      flexDirection: 'row',
      gap: 10,
      alignItems: 'center',
    },
    saveReadingButton: {
      flex: 1,
      borderRadius: 8,
      overflow: 'hidden',
    },
    saveReadingGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 12,
    },
    saveReadingText: {
      fontSize: 14,
      fontWeight: '600',
      color: '#fff',
    },
    deleteVehicleButton: {
      width: 44,
      height: 44,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.error,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.primary,
      borderStyle: 'dashed',
      marginTop: 4,
    },
    addButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.primary,
    },
    addVehicleForm: {
      backgroundColor: colors.cardBackground,
      borderRadius: 12,
      padding: 16,
      marginTop: 4,
      borderWidth: 1,
      borderColor: colors.border,
    },
    addVehicleInput: {
      backgroundColor: colors.inputBackground,
      borderRadius: 8,
      paddingVertical: 12,
      paddingHorizontal: 14,
      fontSize: 15,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 12,
    },
    addVehicleActions: {
      flexDirection: 'row',
      gap: 10,
    },
    addVehicleSave: {
      flex: 1,
      borderRadius: 8,
      overflow: 'hidden',
    },
    addVehicleSaveGradient: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
    },
    addVehicleSaveText: {
      fontSize: 14,
      fontWeight: '600',
      color: '#fff',
    },
    addVehicleCancel: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      borderRadius: 8,
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
    },
    addVehicleCancelText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    oilSection: {
      marginTop: 14,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.inputBackground,
      overflow: 'hidden',
    },
    oilHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    oilHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
    },
    oilHeaderTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    oilBadge: {
      backgroundColor: '#d9770620',
      borderRadius: 8,
      paddingHorizontal: 6,
      paddingVertical: 1,
    },
    oilBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: '#d97706',
    },
    oilBody: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    oilEmptyText: {
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: 'center',
      paddingVertical: 16,
    },
    oilRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border + '50',
    },
    oilRowLeft: {
      flex: 1,
      marginRight: 10,
    },
    oilRowDate: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    oilRowOdometer: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 1,
    },
    oilRowMilesBetween: {
      fontSize: 11,
      color: '#d97706',
      fontWeight: '500',
      marginTop: 2,
    },
    oilRowNotes: {
      fontSize: 11,
      color: colors.textSecondary + 'BB',
      marginTop: 2,
      fontStyle: 'italic',
    },
    oilRowRight: {
      alignItems: 'flex-end',
      gap: 4,
    },
    oilRowCost: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
    },
    oilRowActions: {
      flexDirection: 'row',
      gap: 6,
    },
    oilIconBtn: {
      padding: 4,
    },
    oilAddBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      paddingVertical: 10,
    },
    oilAddBtnText: {
      fontSize: 12,
      fontWeight: '600',
      color: '#d97706',
    },
    oilAddForm: {
      padding: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border + '50',
    },
    oilEditForm: {
      padding: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border + '50',
      backgroundColor: colors.surface,
    },
    oilFormRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 8,
    },
    oilFormCol: {
      flex: 1,
    },
    oilFormLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 3,
    },
    oilFormInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: Platform.OS === 'web' ? 6 : 4,
      fontSize: 13,
      color: colors.text,
      backgroundColor: colors.surface,
    },
    oilEditActions: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 4,
    },
    oilEditSaveBtn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      borderRadius: 6,
      backgroundColor: '#d97706',
    },
    oilEditSaveBtnText: {
      fontSize: 13,
      fontWeight: '600',
      color: '#fff',
    },
    oilEditCancelBtn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      borderRadius: 6,
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
    },
    oilEditCancelBtnText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
    },
  });
