import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import { MapPin, Navigation, Map, WifiOff, Clock, Search, Building2, X } from 'lucide-react-native';
import * as Location from 'expo-location';
import { useTheme } from '@/contexts/ThemeContext';
import {
  AddressData,
  MapboxSuggestion,
  BusinessResult,
  PreviousAddress,
  searchMapbox,
  searchBusinesses,
  reverseGeocode,
  fetchPreviousAddresses,
  filterPreviousAddresses,
  hasMapboxToken,
  buildFullAddress,
  emptyAddressData,
} from '@/lib/addressService';
import { addressCacheService } from '@/lib/addressCacheService';

interface AddressAutocompleteProps {
  value: AddressData;
  onChange: (data: AddressData) => void;
  organizationId: string;
  label?: string;
  required?: boolean;
  showMapButton?: boolean;
  onOpenMap?: () => void;
}

export default function AddressAutocomplete({
  value,
  onChange,
  organizationId,
  label = 'Address',
  required = false,
  showMapButton = true,
  onOpenMap,
}: AddressAutocompleteProps) {
  const { colors } = useTheme();
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [mapboxResults, setMapboxResults] = useState<MapboxSuggestion[]>([]);
  const [previousAddresses, setPreviousAddresses] = useState<PreviousAddress[]>([]);
  const [cachedAddresses, setCachedAddresses] = useState<any[]>([]);
  const [filteredPrevious, setFilteredPrevious] = useState<PreviousAddress[]>([]);
  const [loadingMapbox, setLoadingMapbox] = useState(false);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [businessMode, setBusinessMode] = useState(false);
  const [businessQuery, setBusinessQuery] = useState('');
  const [businessResults, setBusinessResults] = useState<BusinessResult[]>([]);
  const [loadingBusiness, setLoadingBusiness] = useState(false);
  const businessDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasToken = hasMapboxToken();

  useEffect(() => {
    if (organizationId) {
      fetchPreviousAddresses(organizationId).then(setPreviousAddresses);
      addressCacheService.getRecentAddresses(organizationId, 10).then(setCachedAddresses);
    }
  }, [organizationId]);

  useEffect(() => {
    setFilteredPrevious(filterPreviousAddresses(previousAddresses, value.street));
  }, [value.street, previousAddresses]);

  const handleStreetChange = useCallback(
    (text: string) => {
      onChange({ ...value, street: text, normalized: false });
      setShowSuggestions(true);

      if (debounceRef.current) clearTimeout(debounceRef.current);

      if (hasToken && text.trim().length >= 3) {
        debounceRef.current = setTimeout(async () => {
          setLoadingMapbox(true);
          const results = await searchMapbox(text);
          setMapboxResults(results);
          setLoadingMapbox(false);
          setIsOffline(results.length === 0 && text.trim().length >= 5);
        }, 350);
      } else {
        setMapboxResults([]);
      }
    },
    [value, onChange, hasToken]
  );

  const selectSuggestion = useCallback(
    (addr: { street: string; city: string; state: string; postalCode: string; country: string; latitude: number | null; longitude: number | null; fullAddress: string }) => {
      onChange({
        street: addr.street,
        city: addr.city,
        state: addr.state,
        postalCode: addr.postalCode,
        country: addr.country || 'United States',
        latitude: addr.latitude,
        longitude: addr.longitude,
        fullAddress: addr.fullAddress,
        normalized: !!(addr.latitude && addr.longitude),
      });
      setShowSuggestions(false);
      setMapboxResults([]);

      if (organizationId) {
        addressCacheService.cacheAddress(organizationId, {
          full_address: addr.fullAddress,
          street: addr.street,
          city: addr.city,
          state: addr.state,
          postal_code: addr.postalCode,
          country: addr.country || 'United States',
          latitude: addr.latitude,
          longitude: addr.longitude,
          normalized: !!(addr.latitude && addr.longitude),
        });
      }
    },
    [onChange, organizationId]
  );

  const handleBusinessQueryChange = useCallback((text: string) => {
    setBusinessQuery(text);
    if (businessDebounceRef.current) clearTimeout(businessDebounceRef.current);
    if (text.trim().length >= 2) {
      businessDebounceRef.current = setTimeout(async () => {
        setLoadingBusiness(true);
        const results = await searchBusinesses(text);
        setBusinessResults(results);
        setLoadingBusiness(false);
      }, 400);
    } else {
      setBusinessResults([]);
    }
  }, []);

  const selectBusiness = useCallback(
    (biz: BusinessResult) => {
      onChange({
        street: biz.street,
        city: biz.city,
        state: biz.state,
        postalCode: biz.postalCode,
        country: biz.country || 'United States',
        latitude: biz.latitude,
        longitude: biz.longitude,
        fullAddress: biz.fullAddress,
        normalized: !!(biz.latitude && biz.longitude),
      });
      setBusinessResults([]);
      setBusinessQuery('');
      setBusinessMode(false);

      if (organizationId) {
        addressCacheService.cacheAddress(organizationId, {
          full_address: biz.fullAddress,
          street: biz.street,
          city: biz.city,
          state: biz.state,
          postal_code: biz.postalCode,
          country: biz.country || 'United States',
          latitude: biz.latitude,
          longitude: biz.longitude,
          normalized: true,
        });
      }
    },
    [onChange, organizationId]
  );

  const handleUseCurrentLocation = useCallback(async () => {
    setLoadingLocation(true);
    try {
      let lat: number;
      let lng: number;

      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.geolocation) {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
          })
        );
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } else {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLoadingLocation(false);
          return;
        }
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        lat = loc.coords.latitude;
        lng = loc.coords.longitude;
      }

      const result = await reverseGeocode(lat, lng);

      if (result) {
        onChange(result);
      } else {
        onChange({
          ...value,
          latitude: lat,
          longitude: lng,
          normalized: false,
        });
      }
    } catch {
      // Location unavailable
    } finally {
      setLoadingLocation(false);
    }
  }, [value, onChange]);

  const handleFieldChange = useCallback(
    (field: keyof AddressData, text: string) => {
      onChange({ ...value, [field]: text, normalized: false });
    },
    [value, onChange]
  );

  const hasSuggestions = filteredPrevious.length > 0 || mapboxResults.length > 0;

  return (
    <View style={styles.container}>
      {label ? (
        <Text style={[styles.label, { color: colors.text }]}>
          {label}
          {required && <Text style={{ color: colors.error }}> *</Text>}
        </Text>
      ) : null}

      {isOffline && !hasToken ? null : isOffline ? (
        <View style={[styles.offlineBanner, { backgroundColor: colors.warning + '15' }]}>
          <WifiOff size={14} color={colors.warning} />
          <Text style={[styles.offlineText, { color: colors.warning }]}>
            Offline -- address suggestions limited
          </Text>
        </View>
      ) : null}

      <TouchableOpacity
        style={[styles.businessToggle, { borderColor: businessMode ? colors.primary : colors.border, backgroundColor: businessMode ? colors.primaryLight : 'transparent' }]}
        onPress={() => {
          setBusinessMode((v) => !v);
          setBusinessQuery('');
          setBusinessResults([]);
        }}
      >
        <Building2 size={14} color={businessMode ? colors.primary : colors.textSecondary} />
        <Text style={[styles.businessToggleText, { color: businessMode ? colors.primary : colors.textSecondary }]}>
          Search by business name
        </Text>
      </TouchableOpacity>

      {businessMode && (
        <View>
          <View style={styles.businessInputWrap}>
            <Search size={15} color={colors.textSecondary} style={styles.businessInputIcon} />
            <TextInput
              style={[styles.input, styles.businessInput, { backgroundColor: colors.inputBackground, borderColor: colors.primary, color: colors.text, paddingLeft: 36 }]}
              value={businessQuery}
              onChangeText={handleBusinessQueryChange}
              placeholder="Type a business name..."
              placeholderTextColor={colors.textSecondary}
              autoFocus
              returnKeyType="search"
            />
            {loadingBusiness && (
              <ActivityIndicator size="small" color={colors.primary} style={styles.businessSpinner} />
            )}
            {businessQuery.length > 0 && !loadingBusiness && (
              <TouchableOpacity style={styles.businessClear} onPress={() => { setBusinessQuery(''); setBusinessResults([]); }}>
                <X size={14} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          {businessResults.length > 0 && (
            <View style={[styles.suggestionsContainer, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: 4 }]}>
              <ScrollView style={styles.suggestionsList} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                <View style={styles.sectionHeader}>
                  <Building2 size={12} color={colors.textSecondary} />
                  <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Business results</Text>
                </View>
                {businessResults.map((biz) => (
                  <TouchableOpacity
                    key={biz.id}
                    style={[styles.suggestionItem, { borderBottomColor: colors.border }]}
                    onPress={() => selectBusiness(biz)}
                  >
                    <Building2 size={14} color={colors.primary} />
                    <View style={styles.suggestionTextWrap}>
                      <Text style={[styles.suggestionMain, { color: colors.text }]} numberOfLines={1}>
                        {biz.name || biz.street}
                      </Text>
                      <Text style={[styles.suggestionSub, { color: colors.textSecondary }]} numberOfLines={1}>
                        {biz.street ? `${biz.street}, ` : ''}{[biz.city, biz.state, biz.postalCode].filter(Boolean).join(', ')}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {businessQuery.length >= 2 && !loadingBusiness && businessResults.length === 0 && (
            <Text style={[styles.noResults, { color: colors.textSecondary }]}>No businesses found. Try a different name or enter the address manually.</Text>
          )}
        </View>
      )}

      <View style={styles.streetRow}>
        <View style={styles.streetInputWrap}>
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
            value={value.street}
            onChangeText={handleStreetChange}
            placeholder="Street Address *"
            placeholderTextColor={colors.textSecondary}
            textContentType="fullStreetAddress"
            autoComplete="street-address"
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          />
          {loadingMapbox && (
            <ActivityIndicator size="small" color={colors.primary} style={styles.inputSpinner} />
          )}
        </View>
      </View>

      {showSuggestions && hasSuggestions && (
        <View style={[styles.suggestionsContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ScrollView
            style={styles.suggestionsList}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
          >
            {filteredPrevious.length > 0 && (
              <>
                <View style={styles.sectionHeader}>
                  <Clock size={12} color={colors.textSecondary} />
                  <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
                    Previously used
                  </Text>
                </View>
                {filteredPrevious.map((addr) => (
                  <TouchableOpacity
                    key={addr.id}
                    style={[styles.suggestionItem, { borderBottomColor: colors.border }]}
                    onPress={() => selectSuggestion(addr)}
                  >
                    <MapPin size={14} color={colors.primary} />
                    <View style={styles.suggestionTextWrap}>
                      <Text style={[styles.suggestionMain, { color: colors.text }]} numberOfLines={1}>
                        {addr.street}
                      </Text>
                      <Text style={[styles.suggestionSub, { color: colors.textSecondary }]} numberOfLines={1}>
                        {[addr.city, addr.state, addr.postalCode].filter(Boolean).join(', ')}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </>
            )}

            {mapboxResults.length > 0 && (
              <>
                <View style={styles.sectionHeader}>
                  <Search size={12} color={colors.textSecondary} />
                  <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
                    Mapbox suggestions
                  </Text>
                </View>
                {mapboxResults.map((addr) => (
                  <TouchableOpacity
                    key={addr.id}
                    style={[styles.suggestionItem, { borderBottomColor: colors.border }]}
                    onPress={() => selectSuggestion(addr)}
                  >
                    <MapPin size={14} color={colors.success || '#188038'} />
                    <View style={styles.suggestionTextWrap}>
                      <Text style={[styles.suggestionMain, { color: colors.text }]} numberOfLines={1}>
                        {addr.street}
                      </Text>
                      <Text style={[styles.suggestionSub, { color: colors.textSecondary }]} numberOfLines={1}>
                        {[addr.city, addr.state, addr.postalCode].filter(Boolean).join(', ')}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </>
            )}
          </ScrollView>
        </View>
      )}

      <View style={styles.fieldRow}>
        <TextInput
          style={[styles.input, styles.cityInput, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
          value={value.city}
          onChangeText={(t) => handleFieldChange('city', t)}
          placeholder="City *"
          placeholderTextColor={colors.textSecondary}
          textContentType="addressCity"
          autoComplete="address-level2"
        />
        <TextInput
          style={[styles.input, styles.stateInput, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
          value={value.state}
          onChangeText={(t) => handleFieldChange('state', t)}
          placeholder="State *"
          placeholderTextColor={colors.textSecondary}
          textContentType="addressState"
          autoComplete="address-level1"
        />
        <TextInput
          style={[styles.input, styles.zipInput, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
          value={value.postalCode}
          onChangeText={(t) => handleFieldChange('postalCode', t)}
          placeholder="ZIP *"
          placeholderTextColor={colors.textSecondary}
          textContentType="postalCode"
          autoComplete="postal-code"
          keyboardType="number-pad"
        />
      </View>

      <TextInput
        style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
        value={value.country}
        onChangeText={(t) => handleFieldChange('country', t)}
        placeholder="Country"
        placeholderTextColor={colors.textSecondary}
        textContentType="countryName"
        autoComplete="country-name"
      />

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.actionButton, { borderColor: colors.border }]}
          onPress={handleUseCurrentLocation}
          disabled={loadingLocation}
        >
          {loadingLocation ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Navigation size={16} color={colors.primary} />
          )}
          <Text style={[styles.actionText, { color: colors.primary }]}>
            {loadingLocation ? 'Locating...' : 'Current Location'}
          </Text>
        </TouchableOpacity>

        {showMapButton && onOpenMap && (
          <TouchableOpacity
            style={[styles.actionButton, { borderColor: colors.border }]}
            onPress={onOpenMap}
          >
            <Map size={16} color={colors.primary} />
            <Text style={[styles.actionText, { color: colors.primary }]}>Choose on Map</Text>
          </TouchableOpacity>
        )}
      </View>

      {value.latitude && value.longitude ? (
        <View style={[styles.coordsBadge, { backgroundColor: colors.primaryLight }]}>
          <MapPin size={12} color={colors.primary} />
          <Text style={[styles.coordsText, { color: colors.primary }]}>
            {value.latitude.toFixed(5)}, {value.longitude.toFixed(5)}
          </Text>
          {value.normalized && (
            <Text style={[styles.normalizedBadge, { color: colors.success }]}>Verified</Text>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  offlineText: {
    fontSize: 12,
    fontWeight: '500',
  },
  streetRow: {
    position: 'relative',
  },
  streetInputWrap: {
    position: 'relative',
  },
  input: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'web' ? 10 : 12,
    fontSize: 15,
    borderWidth: 1,
  },
  inputSpinner: {
    position: 'absolute',
    right: 12,
    top: '50%',
    marginTop: -8,
  },
  suggestionsContainer: {
    borderWidth: 1,
    borderRadius: 8,
    maxHeight: 220,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
      },
      default: {
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
      },
    }),
  },
  suggestionsList: {
    maxHeight: 220,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    opacity: 0.7,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  suggestionTextWrap: {
    flex: 1,
  },
  suggestionMain: {
    fontSize: 14,
    fontWeight: '500',
  },
  suggestionSub: {
    fontSize: 12,
    marginTop: 1,
  },
  fieldRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  cityInput: {
    flex: 1,
    minWidth: 120,
  },
  stateInput: {
    flex: 1,
    minWidth: 80,
  },
  zipInput: {
    flex: 1,
    minWidth: 80,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  actionButton: {
    flex: 1,
    minWidth: 140,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  coordsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  coordsText: {
    fontSize: 12,
    fontWeight: '500',
  },
  normalizedBadge: {
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 4,
  },
  businessToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 7,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  businessToggleText: {
    fontSize: 13,
    fontWeight: '500',
  },
  businessInputWrap: {
    position: 'relative',
  },
  businessInput: {
    paddingLeft: 36,
  },
  businessInputIcon: {
    position: 'absolute',
    left: 11,
    top: '50%',
    marginTop: -7,
    zIndex: 1,
  },
  businessSpinner: {
    position: 'absolute',
    right: 12,
    top: '50%',
    marginTop: -8,
  },
  businessClear: {
    position: 'absolute',
    right: 12,
    top: '50%',
    marginTop: -7,
    padding: 2,
  },
  noResults: {
    fontSize: 12,
    paddingHorizontal: 4,
    paddingTop: 4,
  },
});
