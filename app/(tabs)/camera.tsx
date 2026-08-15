import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  Platform,
  Dimensions,
  Modal,
  FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Image as ImageIcon, CircleCheck as CheckCircle, Trash2, Images, Pen, X, ChevronRight } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { supabase } from '@/lib/supabase';
import ClientPhotoSelectorModal from '@/components/ClientPhotoSelectorModal';
import PhotoAnnotationModal from '@/components/PhotoAnnotationModal';
import AnnotatedPhoto from '@/components/AnnotatedPhoto';

const { width } = Dimensions.get('window');
const photoSize = (width - 48) / 3;

interface Photo {
  id: string;
  photo_url: string;
  annotated_url?: string;
  thumbnail_url?: string;
  caption: string;
  client_id: string;
  client_name?: string;
  captured_at: string;
  latitude?: number;
  longitude?: number;
  auto_associated: boolean;
  annotation_data?: string;
}

interface Client {
  id: string;
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
}

interface BulkItem {
  uri: string;
  selected: boolean;
  annotationData?: string;
  annotating?: boolean;
}

export default function CameraScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { currentOrganization } = useOrganization();
  const [locationPermission, setLocationPermission] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  const [showClientSelector, setShowClientSelector] = useState(false);
  const [pendingPhoto, setPendingPhoto] = useState<{ uri: string; location: any; annotationData?: string } | null>(null);
  const [suggestedClient, setSuggestedClient] = useState<Client | null>(null);

  const [showAnnotation, setShowAnnotation] = useState(false);
  const [annotatingUri, setAnnotatingUri] = useState<string | null>(null);
  const [annotatingPhotoId, setAnnotatingPhotoId] = useState<string | null>(null);
  const [annotatingContext, setAnnotatingContext] = useState<'single' | 'bulk' | 'existing'>('single');

  const [bulkItems, setBulkItems] = useState<BulkItem[]>([]);
  const [showBulkReview, setShowBulkReview] = useState(false);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkAnnotatingIndex, setBulkAnnotatingIndex] = useState<number | null>(null);

  const [viewingPhoto, setViewingPhoto] = useState<Photo | null>(null);

  useEffect(() => {
    requestLocationPermission();
    fetchPhotos();
  }, []);

  const requestLocationPermission = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    setLocationPermission(status === 'granted');
    if (status === 'granted') getCurrentLocation();
  };

  const getCurrentLocation = async () => {
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCurrentLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
    } catch {}
  };

  const fetchPhotos = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('client_photos')
        .select('*, clients(name)')
        .eq('user_id', user.id)
        .is('is_deleted', null)
        .order('captured_at', { ascending: false })
        .limit(60);

      if (error) throw error;
      setPhotos((data || []).map((p: any) => ({ ...p, client_name: p.clients?.name })));
    } catch (error: any) {
      showToast({ message: error.message || 'Failed to load photos', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const getLocation = async () => {
    if (!locationPermission) return null;
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      return { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
    } catch {
      return currentLocation;
    }
  };

  const findNearestClient = async (latitude: number, longitude: number): Promise<Client | null> => {
    if (!currentOrganization) return null;
    try {
      const { data } = await supabase
        .from('clients')
        .select('id, name, address, latitude, longitude')
        .eq('organization_id', currentOrganization.id)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);

      if (!data || data.length === 0) return null;
      let nearest: Client | null = null;
      let minDist = Infinity;
      for (const c of data) {
        const d = haversine(latitude, longitude, c.latitude, c.longitude);
        if (d < minDist && d < 200) { minDist = d; nearest = c; }
      }
      return nearest;
    } catch { return null; }
  };

  const haversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371000;
    const φ1 = (lat1 * Math.PI) / 180, φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180, Δλ = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        showToast({ message: 'Camera permission is required', type: 'error' });
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ quality: 1, exif: false });
      if (!result.canceled && result.assets[0]) {
        await processSingleImage(result.assets[0].uri);
      }
    } catch (error: any) {
      showToast({ message: error.message || 'Failed to open camera', type: 'error' });
    }
  };

  const pickSingleFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showToast({ message: 'Photo library permission is required', type: 'error' });
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 1, exif: false });
      if (!result.canceled && result.assets[0]) {
        await processSingleImage(result.assets[0].uri);
      }
    } catch (error: any) {
      showToast({ message: error.message || 'Failed to open photo library', type: 'error' });
    }
  };

  const pickBulkFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showToast({ message: 'Photo library permission is required', type: 'error' });
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        quality: 1,
        exif: false,
        allowsMultipleSelection: true,
        selectionLimit: 20,
      });
      if (!result.canceled && result.assets.length > 0) {
        const items: BulkItem[] = result.assets.map((a) => ({ uri: a.uri, selected: true }));
        setBulkItems(items);
        setShowBulkReview(true);
      }
    } catch (error: any) {
      showToast({ message: error.message || 'Failed to open photo library', type: 'error' });
    }
  };

  const processSingleImage = async (uri: string) => {
    const location = await getLocation();
    if (location) {
      const nearest = await findNearestClient(location.latitude, location.longitude);
      setSuggestedClient(nearest);
    }
    setPendingPhoto({ uri, location });
    setShowClientSelector(true);
  };

  const handleAnnotateSingle = (uri: string) => {
    setAnnotatingUri(uri);
    setAnnotatingPhotoId(null);
    setAnnotatingContext('single');
    setShowAnnotation(true);
  };

  const handleAnnotateBulkItem = (index: number) => {
    setBulkAnnotatingIndex(index);
    setAnnotatingUri(bulkItems[index].uri);
    setAnnotatingPhotoId(null);
    setAnnotatingContext('bulk');
    setShowAnnotation(true);
  };

  const handleAnnotateExistingPhoto = (photo: Photo) => {
    setAnnotatingUri(photo.photo_url);
    setAnnotatingPhotoId(photo.id);
    setAnnotatingContext('existing');
    setViewingPhoto(null);
    setShowAnnotation(true);
  };

  const handleAnnotationSave = async (annotationData: string) => {
    if (annotatingContext === 'single' && pendingPhoto) {
      setPendingPhoto({ ...pendingPhoto, annotationData });
      setShowAnnotation(false);
      setAnnotatingUri(null);
      setShowClientSelector(true);
    } else if (annotatingContext === 'bulk' && bulkAnnotatingIndex !== null) {
      setBulkItems((prev) =>
        prev.map((item, i) => (i === bulkAnnotatingIndex ? { ...item, annotationData } : item))
      );
      setBulkAnnotatingIndex(null);
      setShowAnnotation(false);
      setAnnotatingUri(null);
      setShowBulkReview(true);
    } else if (annotatingContext === 'existing' && annotatingPhotoId) {
      setShowAnnotation(false);
      setAnnotatingUri(null);
      try {
        const { error } = await supabase
          .from('client_photos')
          .update({ annotation_data: annotationData })
          .eq('id', annotatingPhotoId);
        if (error) throw error;
        setPhotos((prev) =>
          prev.map((p) => p.id === annotatingPhotoId ? { ...p, annotation_data: annotationData } : p)
        );
        showToast({ message: 'Annotation saved', type: 'success' });
      } catch {
        showToast({ message: 'Failed to save annotation', type: 'error' });
      }
      setAnnotatingPhotoId(null);
    }
  };

  const handleAnnotationClose = () => {
    setShowAnnotation(false);
    setAnnotatingUri(null);
    if (annotatingContext === 'single') {
      setShowClientSelector(true);
    } else if (annotatingContext === 'bulk') {
      setShowBulkReview(true);
    }
    setAnnotatingPhotoId(null);
  };

  const handleBulkProceed = async () => {
    const selected = bulkItems.filter((b) => b.selected);
    if (selected.length === 0) {
      showToast({ message: 'Select at least one photo', type: 'error' });
      return;
    }
    const location = await getLocation();
    if (location) {
      const nearest = await findNearestClient(location.latitude, location.longitude);
      setSuggestedClient(nearest);
    }
    setShowBulkReview(false);
    setPendingPhoto({ uri: selected[0].uri, location: currentLocation, annotationData: selected[0].annotationData });
    setShowClientSelector(true);
  };

  const handlePhotoSaved = () => {
    fetchPhotos();
    setPendingPhoto(null);
    setSuggestedClient(null);
    setBulkItems([]);
  };

  const handleDeletePhoto = async (photoId: string) => {
    Alert.alert('Delete Photo', 'Are you sure you want to delete this photo?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            const { error } = await supabase
              .from('client_photos')
              .update({ is_deleted: true, deleted_at: new Date().toISOString(), deleted_by: user?.id })
              .eq('id', photoId);
            if (error) throw error;
            showToast({ message: 'Photo deleted', type: 'success' });
            setViewingPhoto(null);
            fetchPhotos();
          } catch (error: any) {
            showToast({ message: error.message || 'Failed to delete photo', type: 'error' });
          }
        },
      },
    ]);
  };

  const selectedBulkCount = bulkItems.filter((b) => b.selected).length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Text style={styles.headerTitle}>Camera</Text>
        <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
          Full-quality photos linked to clients
        </Text>
      </View>

      <>
        <View style={[styles.actionButtons, { borderBottomColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.actionButton, { overflow: 'hidden', padding: 0 }]}
              onPress={handleTakePhoto}
              activeOpacity={0.8}
            >
              <LinearGradient colors={['#1B4D6E', '#245d82']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.actionButtonGradient}>
                <Camera size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Take Photo</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, { overflow: 'hidden', padding: 0 }]}
              onPress={pickSingleFromGallery}
              activeOpacity={0.8}
            >
              <LinearGradient colors={['#1B4D6E', '#245d82']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.actionButtonGradient}>
                <ImageIcon size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Library</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, { overflow: 'hidden', padding: 0 }]}
              onPress={pickBulkFromGallery}
              activeOpacity={0.8}
            >
              <LinearGradient colors={['#1B4D6E', '#245d82']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.actionButtonGradient}>
                <Images size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Bulk Upload</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : photos.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Camera size={64} color={colors.textSecondary} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No Photos Yet</Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Take a photo or choose from your library to document your work and link it to a client
              </Text>
            </View>
          ) : (
            <ScrollView style={styles.photosContainer} showsVerticalScrollIndicator={false}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Photos ({photos.length})</Text>
              <View style={styles.photosGrid}>
                {photos.map((photo) => (
                  <TouchableOpacity
                    key={photo.id}
                    style={styles.photoCard}
                    onPress={() => setViewingPhoto(photo)}
                    activeOpacity={0.85}
                  >
                    <AnnotatedPhoto
                      photoUri={photo.thumbnail_url || photo.photo_url}
                      annotationData={photo.annotation_data}
                      style={styles.photoImage}
                      resizeMode="cover"
                    />
                    <View style={[styles.photoOverlay]}>
                      {photo.auto_associated && (
                        <View style={styles.autoBadge}>
                          <CheckCircle size={12} color="#4CAF50" />
                        </View>
                      )}
                      {photo.annotation_data && (
                        <View style={[styles.autoBadge, { backgroundColor: 'rgba(59,130,246,0.9)' }]}>
                          <Pen size={10} color="#fff" />
                        </View>
                      )}
                    </View>
                    {photo.client_name && (
                      <View style={[styles.photoInfo, { backgroundColor: colors.card }]}>
                        <Text style={[styles.photoClientName, { color: colors.text }]} numberOfLines={1}>
                          {photo.client_name}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          )}
      </>

      {pendingPhoto && (
        <ClientPhotoSelectorModal
          visible={showClientSelector}
          photoUri={pendingPhoto.uri}
          location={pendingPhoto.location}
          suggestedClient={suggestedClient}
          annotationData={pendingPhoto.annotationData}
          bulkItems={bulkItems.filter((b) => b.selected)}
          onAnnotate={() => {
            setShowClientSelector(false);
            handleAnnotateSingle(pendingPhoto.uri);
          }}
          onClose={() => {
            setShowClientSelector(false);
            setPendingPhoto(null);
            setSuggestedClient(null);
            setBulkItems([]);
          }}
          onSave={handlePhotoSaved}
        />
      )}

      {annotatingUri && (
        <PhotoAnnotationModal
          visible={showAnnotation}
          photoUri={annotatingUri}
          onClose={handleAnnotationClose}
          onSave={handleAnnotationSave}
        />
      )}

      <Modal visible={showBulkReview} animationType="slide" transparent onRequestClose={() => setShowBulkReview(false)}>
        <View style={styles.bulkOverlay}>
          <View style={[styles.bulkModal, { backgroundColor: colors.card }]}>
            <View style={[styles.bulkHeader, { borderBottomColor: colors.border }]}>
              <View>
                <Text style={[styles.bulkTitle, { color: colors.text }]}>Review Photos</Text>
                <Text style={[styles.bulkSubtitle, { color: colors.textSecondary }]}>
                  {selectedBulkCount} of {bulkItems.length} selected
                </Text>
              </View>
              <TouchableOpacity onPress={() => { setShowBulkReview(false); setBulkItems([]); }}>
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={bulkItems}
              numColumns={3}
              keyExtractor={(_, i) => String(i)}
              contentContainerStyle={styles.bulkGrid}
              renderItem={({ item, index }) => (
                <View style={styles.bulkItemWrapper}>
                  <TouchableOpacity
                    style={[
                      styles.bulkThumb,
                      !item.selected && styles.bulkThumbDeselected,
                    ]}
                    onPress={() =>
                      setBulkItems((prev) =>
                        prev.map((b, i) => (i === index ? { ...b, selected: !b.selected } : b))
                      )
                    }
                    activeOpacity={0.8}
                  >
                    <Image source={{ uri: item.uri }} style={styles.bulkThumbImage} resizeMode="cover" />
                    {item.selected && (
                      <View style={styles.bulkCheckOverlay}>
                        <CheckCircle size={22} color="#fff" />
                      </View>
                    )}
                    {item.annotationData && (
                      <View style={styles.bulkAnnotatedBadge}>
                        <Pen size={10} color="#fff" />
                      </View>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.bulkAnnotateBtn, { backgroundColor: colors.primaryLight }]}
                    onPress={() => {
                      setShowBulkReview(false);
                      handleAnnotateBulkItem(index);
                    }}
                  >
                    <Pen size={12} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              )}
            />

            <View style={[styles.bulkFooter, { borderTopColor: colors.border }]}>
              <TouchableOpacity
                style={[styles.bulkBtn, styles.bulkBtnOutline, { borderColor: colors.border }]}
                onPress={() => {
                  setBulkItems((prev) => prev.map((b) => ({ ...b, selected: !b.selected })));
                }}
              >
                <Text style={[styles.bulkBtnText, { color: colors.text }]}>Toggle All</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.bulkBtn, { overflow: 'hidden', padding: 0, opacity: (selectedBulkCount === 0 || bulkProcessing) ? 0.5 : 1 }]}
                onPress={handleBulkProceed}
                disabled={selectedBulkCount === 0 || bulkProcessing}
              >
                <LinearGradient colors={['#1B4D6E', '#245d82']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14 }}>
                  {bulkProcessing ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <ChevronRight size={18} color="#fff" />
                      <Text style={[styles.bulkBtnText, { color: '#fff' }]}>
                        Upload {selectedBulkCount} Photo{selectedBulkCount !== 1 ? 's' : ''}
                      </Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!viewingPhoto} animationType="fade" transparent onRequestClose={() => setViewingPhoto(null)}>
        {viewingPhoto && (
          <View style={styles.viewerOverlay}>
            <View style={[styles.viewerModal, { backgroundColor: colors.card }]}>
              <View style={[styles.viewerHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.viewerTitle, { color: colors.text }]} numberOfLines={1}>
                  {viewingPhoto.client_name || 'Photo'}
                </Text>
                <TouchableOpacity onPress={() => setViewingPhoto(null)}>
                  <X size={24} color={colors.text} />
                </TouchableOpacity>
              </View>
              <AnnotatedPhoto
                photoUri={viewingPhoto.photo_url}
                annotationData={viewingPhoto.annotation_data}
                style={styles.viewerImage}
                resizeMode="contain"
              />
              <View style={[styles.viewerActions, { borderTopColor: colors.border }]}>
                <TouchableOpacity
                  style={[styles.viewerBtn, { backgroundColor: colors.primaryLight }]}
                  onPress={() => handleAnnotateExistingPhoto(viewingPhoto)}
                >
                  <Pen size={18} color={colors.primary} />
                  <Text style={[styles.viewerBtnText, { color: colors.primary }]}>Annotate</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.viewerBtn, { backgroundColor: '#fef2f2' }]}
                  onPress={() => handleDeletePhoto(viewingPhoto.id)}
                >
                  <Trash2 size={18} color="#ef4444" />
                  <Text style={[styles.viewerBtnText, { color: '#ef4444' }]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 16,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#1B4D6E', textAlign: 'center' },
  headerSubtitle: { fontSize: 13, marginTop: 2 },
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    borderBottomWidth: 1,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  actionButtonGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  actionButtonText: { color: '#fff', fontSize: 14, fontWeight: '600', flexShrink: 0 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 12,
  },
  emptyTitle: { fontSize: 20, fontWeight: 'bold' },
  emptyText: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
  photosContainer: { flex: 1, padding: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  photosGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoCard: {
    width: photoSize,
    height: photoSize,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  photoImage: { width: '100%', height: '100%' },
  photoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 5,
    gap: 4,
  },
  autoBadge: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 10,
    padding: 3,
  },
  photoInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 6,
  },
  photoClientName: { fontSize: 11, fontWeight: '600' },
  bulkOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  bulkModal: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  bulkHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  bulkTitle: { fontSize: 18, fontWeight: '700' },
  bulkSubtitle: { fontSize: 13, marginTop: 2 },
  bulkGrid: { padding: 12, gap: 8 },
  bulkItemWrapper: {
    flex: 1,
    margin: 4,
    maxWidth: (width - 48) / 3,
    alignItems: 'center',
  },
  bulkThumb: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  bulkThumbDeselected: { opacity: 0.4 },
  bulkThumbImage: { width: '100%', height: '100%' },
  bulkCheckOverlay: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(34,197,94,0.85)',
    borderRadius: 12,
    padding: 1,
  },
  bulkAnnotatedBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(59,130,246,0.9)',
    borderRadius: 8,
    padding: 3,
  },
  bulkAnnotateBtn: {
    marginTop: 4,
    borderRadius: 6,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
  },
  bulkFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
  },
  bulkBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 12,
  },
  bulkBtnOutline: { borderWidth: 1 },
  bulkBtnText: { fontSize: 15, fontWeight: '600' },
  viewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  viewerModal: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  viewerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  viewerTitle: { fontSize: 16, fontWeight: '700', flex: 1, marginRight: 12 },
  viewerImage: { width: '100%', height: 320 },
  viewerActions: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
  },
  viewerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
  },
  viewerBtnText: { fontSize: 15, fontWeight: '600' },
});
