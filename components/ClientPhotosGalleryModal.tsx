import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  TextInput,
  Dimensions,
  Platform,
} from 'react-native';
import { X, Pen, Link, Plus, Trash2, SquareCheck as CheckSquare, Square, ChevronDown, ChevronUp, Check, ListChecks, Camera, Images, Send, Mail, MessageSquare, FolderOpen, FolderPlus, FolderInput } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase, invokeFunction } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import PhotoAnnotationModal from '@/components/PhotoAnnotationModal';
import AnnotatedPhoto from '@/components/AnnotatedPhoto';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PHOTO_SIZE = Math.floor((Math.min(SCREEN_WIDTH, 480) - 48 - 16) / 3);

interface ClientPhoto {
  id: string;
  photo_url: string;
  annotated_url?: string | null;
  annotation_data?: string | null;
  caption?: string | null;
  captured_at?: string | null;
  folder_name?: string | null;
}

const SUGGESTED_FOLDERS = ['Before', 'After', 'Damage', 'Completion', 'Progress'];

interface Job {
  id: string;
  title: string;
  job_date?: string | null;
}

interface ChecklistItem {
  id: string;
  description: string;
  display_order: number;
}

interface Checklist {
  id: string;
  title: string;
  items: ChecklistItem[];
}

interface ClientPhotosGalleryModalProps {
  visible: boolean;
  clientId: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  onClose: () => void;
}

export default function ClientPhotosGalleryModal({
  visible,
  clientId,
  clientName,
  clientEmail,
  clientPhone,
  onClose,
}: ClientPhotosGalleryModalProps) {
  const [photos, setPhotos] = useState<ClientPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);

  const [annotatingPhoto, setAnnotatingPhoto] = useState<ClientPhoto | null>(null);
  const [savingAnnotation, setSavingAnnotation] = useState(false);

  const [jobs, setJobs] = useState<Job[]>([]);
  const [checklists, setChecklists] = useState<{ [jobId: string]: Checklist[] }>({});
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [selectedChecklistItem, setSelectedChecklistItem] = useState<string | null>(null);
  const [showAttachPanel, setShowAttachPanel] = useState(false);
  const [attaching, setAttaching] = useState(false);

  const [showNewChecklist, setShowNewChecklist] = useState<string | null>(null);
  const [newChecklistTitle, setNewChecklistTitle] = useState('');
  const [newChecklistItems, setNewChecklistItems] = useState<string[]>(['']);
  const [savingChecklist, setSavingChecklist] = useState(false);

  const [showSendModal, setShowSendModal] = useState(false);
  const [sendCaption, setSendCaption] = useState('');
  const [sending, setSending] = useState(false);

  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [newFolderInput, setNewFolderInput] = useState('');
  const [movingToFolder, setMovingToFolder] = useState(false);

  const { user } = useAuth();
  const { showToast } = useToast();
  const { colors } = useTheme();
  const { currentOrganization } = useOrganization();

  useEffect(() => {
    if (visible && clientId) {
      fetchPhotos();
      fetchJobs();
    }
    if (!visible) {
      setSelectedPhotos(new Set());
      setSelectMode(false);
      setShowAttachPanel(false);
      setExpandedJob(null);
      setSelectedChecklistItem(null);
      setAnnotatingPhoto(null);
      setShowSendModal(false);
      setSendCaption('');
      setActiveFolder(null);
      setShowFolderPicker(false);
      setNewFolderInput('');
    }
  }, [visible, clientId]);

  const fetchPhotos = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('client_photos')
      .select('id, photo_url, annotated_url, annotation_data, caption, captured_at, folder_name')
      .eq('client_id', clientId)
      .order('captured_at', { ascending: false });
    if (!error && data) setPhotos(data);
    setLoading(false);
  };

  const fetchJobs = async () => {
    if (!currentOrganization?.id) return;
    const { data } = await supabase
      .from('schedule_events')
      .select('id, title, job_date')
      .eq('organization_id', currentOrganization.id)
      .eq('client_id', clientId)
      .order('job_date', { ascending: false })
      .limit(20);
    setJobs(data || []);
  };

  const fetchChecklistsForJob = async (jobId: string) => {
    if (checklists[jobId]) return;
    const { data: checklistData } = await supabase
      .from('job_checklists')
      .select('id, title')
      .eq('job_id', jobId)
      .order('created_at', { ascending: true });

    if (!checklistData) return;

    const withItems = await Promise.all(
      checklistData.map(async (cl) => {
        const { data: items } = await supabase
          .from('job_checklist_items')
          .select('id, description, display_order')
          .eq('checklist_id', cl.id)
          .order('display_order', { ascending: true });
        return { ...cl, items: items || [] };
      })
    );

    setChecklists((prev) => ({ ...prev, [jobId]: withItems }));
  };

  const folders = useMemo(() => {
    const names = new Set(photos.map(p => p.folder_name).filter(Boolean) as string[]);
    return Array.from(names).sort();
  }, [photos]);

  const displayedPhotos = useMemo(() => {
    if (!activeFolder) return photos;
    return photos.filter(p => p.folder_name === activeFolder);
  }, [photos, activeFolder]);

  const togglePhoto = (id: string) => {
    setSelectedPhotos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleMoveToFolder = async (folderName: string | null) => {
    const photoIds = Array.from(selectedPhotos);
    if (photoIds.length === 0) return;
    setMovingToFolder(true);
    try {
      const { error } = await supabase
        .from('client_photos')
        .update({ folder_name: folderName })
        .in('id', photoIds);
      if (error) throw error;
      setPhotos(prev => prev.map(p => selectedPhotos.has(p.id) ? { ...p, folder_name: folderName } : p));
      showToast({ message: folderName ? `Moved to "${folderName}"` : 'Removed from folder', type: 'success' });
      setSelectedPhotos(new Set());
      setSelectMode(false);
      setShowFolderPicker(false);
      setNewFolderInput('');
    } catch {
      showToast({ message: 'Failed to move photos', type: 'error' });
    } finally {
      setMovingToFolder(false);
    }
  };

  const renderAnnotationToBlob = async (photoUrl: string, annotationData: string): Promise<Blob | null> => {
    if (Platform.OS !== 'web') return null;
    try {
      const parsed = JSON.parse(annotationData);
      if (!parsed?.strokes || parsed.strokes.length === 0) return null;
      const { canvasWidth, canvasHeight, strokes } = parsed;
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new window.Image();
        i.crossOrigin = 'anonymous';
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = photoUrl;
      });
      const canvas = document.createElement('canvas');
      canvas.width = canvasWidth || img.naturalWidth;
      canvas.height = canvasHeight || img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      for (const stroke of strokes) {
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = stroke.tool === 'eraser' ? 'white' : stroke.color;
        ctx.lineWidth = stroke.tool === 'eraser' ? stroke.strokeWidth * 3 : stroke.strokeWidth;
        if (stroke.tool === 'pen' || stroke.tool === 'eraser') {
          if (!stroke.points || stroke.points.length < 2) { ctx.restore(); continue; }
          ctx.beginPath();
          stroke.points.forEach((p: { x: number; y: number }, i: number) => {
            if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
          });
          ctx.stroke();
        } else if (stroke.tool === 'line') {
          ctx.beginPath();
          ctx.moveTo(stroke.x1 || 0, stroke.y1 || 0);
          ctx.lineTo(stroke.x2 || 0, stroke.y2 || 0);
          ctx.stroke();
        } else if (stroke.tool === 'rect') {
          const x = Math.min(stroke.x1!, stroke.x2!);
          const y = Math.min(stroke.y1!, stroke.y2!);
          const w = Math.abs(stroke.x2! - stroke.x1!);
          const h = Math.abs(stroke.y2! - stroke.y1!);
          ctx.strokeRect(x, y, w, h);
        } else if (stroke.tool === 'circle') {
          const cx = (stroke.x1! + stroke.x2!) / 2;
          const cy = (stroke.y1! + stroke.y2!) / 2;
          const r = Math.max(Math.abs(stroke.x2! - stroke.x1!), Math.abs(stroke.y2! - stroke.y1!)) / 2;
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.stroke();
        } else if (stroke.tool === 'text' && stroke.text) {
          ctx.fillStyle = stroke.color;
          ctx.font = `700 ${stroke.fontSize || 18}px sans-serif`;
          ctx.strokeStyle = 'rgba(0,0,0,0.4)';
          ctx.lineWidth = 1;
          ctx.strokeText(stroke.text, stroke.x1 || 0, stroke.y1 || 0);
          ctx.fillText(stroke.text, stroke.x1 || 0, stroke.y1 || 0);
        }
        ctx.restore();
      }
      return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    } catch {
      return null;
    }
  };

  const handleAnnotationSave = async (annotationData: string) => {
    if (!annotatingPhoto) return;
    setSavingAnnotation(true);
    try {
      let annotatedUrl: string | null = annotatingPhoto.annotated_url || null;

      const blob = await renderAnnotationToBlob(annotatingPhoto.photo_url, annotationData);
      if (blob) {
        const fileName = `annotated_${annotatingPhoto.id}_${Date.now()}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from('client-photos')
          .upload(fileName, blob, { contentType: 'image/jpeg', upsert: true });
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('client-photos').getPublicUrl(fileName);
          annotatedUrl = urlData?.publicUrl || null;
        }
      }

      const updatePayload: any = { annotation_data: annotationData };
      if (annotatedUrl) updatePayload.annotated_url = annotatedUrl;

      const { error } = await supabase
        .from('client_photos')
        .update(updatePayload)
        .eq('id', annotatingPhoto.id);
      if (error) throw error;
      setPhotos((prev) =>
        prev.map((p) =>
          p.id === annotatingPhoto.id ? { ...p, annotation_data: annotationData, annotated_url: annotatedUrl || p.annotated_url } : p
        )
      );
      showToast({ message: 'Annotation saved', type: 'success' });
    } catch {
      showToast({ message: 'Failed to save annotation', type: 'error' });
    } finally {
      setSavingAnnotation(false);
      setAnnotatingPhoto(null);
    }
  };

  const handleAttachToItem = async () => {
    if (!selectedChecklistItem || selectedPhotos.size === 0) return;
    setAttaching(true);
    try {
      const photoIds = Array.from(selectedPhotos);
      const existing = await supabase
        .from('checklist_item_photos')
        .select('photo_id')
        .eq('checklist_item_id', selectedChecklistItem);
      const existingIds = new Set((existing.data || []).map((r: any) => r.photo_id));

      const toInsert = photoIds
        .filter((pid) => !existingIds.has(pid))
        .map((pid) => ({ checklist_item_id: selectedChecklistItem, photo_id: pid }));

      if (toInsert.length > 0) {
        const { error } = await supabase.from('checklist_item_photos').insert(toInsert);
        if (error) throw error;
      }

      showToast({
        message: `${toInsert.length} photo${toInsert.length !== 1 ? 's' : ''} attached`,
        type: 'success',
      });
      setSelectedPhotos(new Set());
      setSelectMode(false);
      setShowAttachPanel(false);
      setSelectedChecklistItem(null);
      setExpandedJob(null);
    } catch {
      showToast({ message: 'Failed to attach photos', type: 'error' });
    } finally {
      setAttaching(false);
    }
  };

  const handleCreateChecklist = async (jobId: string) => {
    if (!newChecklistTitle.trim() || !user) return;
    setSavingChecklist(true);
    try {
      const { data: cl, error: clErr } = await supabase
        .from('job_checklists')
        .insert({ job_id: jobId, title: newChecklistTitle.trim(), created_by: user.id })
        .select('id, title')
        .single();
      if (clErr) throw clErr;

      const validItems = newChecklistItems
        .map((desc, idx) => ({ description: desc.trim(), display_order: idx }))
        .filter((i) => i.description.length > 0);

      if (validItems.length > 0) {
        const { error: itemErr } = await supabase.from('job_checklist_items').insert(
          validItems.map((item) => ({
            checklist_id: cl.id,
            description: item.description,
            display_order: item.display_order,
            created_by: user.id,
          }))
        );
        if (itemErr) throw itemErr;
      }

      showToast({ message: 'Checklist created', type: 'success' });
      setNewChecklistTitle('');
      setNewChecklistItems(['']);
      setShowNewChecklist(null);
      setChecklists((prev) => {
        const { [jobId]: _, ...rest } = prev;
        return rest;
      });
      await fetchChecklistsForJob(jobId);
    } catch {
      showToast({ message: 'Failed to create checklist', type: 'error' });
    } finally {
      setSavingChecklist(false);
    }
  };

  const handleSendPhotosEmail = async () => {
    if (!clientEmail || selectedPhotos.size === 0 || !currentOrganization?.id) return;
    setSending(true);
    try {
      const selectedPhotoList = photos.filter((p) => selectedPhotos.has(p.id));
      const photoUrls = selectedPhotoList.map((p) => p.annotated_url || p.photo_url);
      const photoListHtml = photoUrls
        .map((url, i) => `<p><img src="${url}" style="max-width:100%;border-radius:8px;margin-bottom:12px;" alt="Photo ${i + 1}" /></p>`)
        .join('');
      const captionHtml = sendCaption ? `<p style="margin-bottom:16px;">${sendCaption}</p>` : '';
      const html = `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
          <h2 style="margin-bottom:8px;">Photos from ${currentOrganization.name || 'Your Service Provider'}</h2>
          ${captionHtml}
          ${photoListHtml}
        </div>`;
      const { error } = await invokeFunction('send-tenant-email', {
        organizationId: currentOrganization.id,
        to: clientEmail,
        subject: `Photos from ${currentOrganization.name || 'Your Service Provider'}`,
        html,
      });
      if (error) throw new Error(error.message);
      showToast({ message: `${selectedPhotos.size} photo${selectedPhotos.size !== 1 ? 's' : ''} sent to ${clientEmail}`, type: 'success' });
      setShowSendModal(false);
      setSelectedPhotos(new Set());
      setSelectMode(false);
      setSendCaption('');
    } catch (e: any) {
      showToast({ message: e?.message || 'Failed to send photos', type: 'error' });
    } finally {
      setSending(false);
    }
  };

  const handleSendPhotosSms = async () => {
    if (!clientPhone || selectedPhotos.size === 0 || !currentOrganization?.id) return;
    setSending(true);
    try {
      const selectedPhotoList = photos.filter((p) => selectedPhotos.has(p.id));
      const photoUrls = selectedPhotoList.map((p) => p.annotated_url || p.photo_url);
      const body = (sendCaption ? `${sendCaption}\n\n` : '') +
        `Photos from ${currentOrganization.name || 'Your Service Provider'}:\n` +
        photoUrls.join('\n');
      const { error } = await invokeFunction('send-sms', {
        organization_id: currentOrganization.id,
        to: clientPhone,
        body,
        client_id: clientId,
      });
      if (error) throw new Error(error.message);
      showToast({ message: `${selectedPhotos.size} photo${selectedPhotos.size !== 1 ? 's' : ''} sent via SMS`, type: 'success' });
      setShowSendModal(false);
      setSelectedPhotos(new Set());
      setSelectMode(false);
      setSendCaption('');
    } catch (e: any) {
      showToast({ message: e?.message || 'Failed to send photos', type: 'error' });
    } finally {
      setSending(false);
    }
  };

  const toggleJobExpand = async (jobId: string) => {
    if (expandedJob === jobId) {
      setExpandedJob(null);
    } else {
      setExpandedJob(jobId);
      await fetchChecklistsForJob(jobId);
    }
  };

  const addChecklistItemField = () => {
    setNewChecklistItems((prev) => [...prev, '']);
  };

  const updateChecklistItemField = (index: number, value: string) => {
    setNewChecklistItems((prev) => prev.map((v, i) => (i === index ? value : v)));
  };

  const removeChecklistItemField = (index: number) => {
    setNewChecklistItems((prev) => prev.filter((_, i) => i !== index));
  };

  const displayUrl = (photo: ClientPhoto) => photo.annotated_url || photo.photo_url;

  return (
    <>
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={styles.headerLeft}>
              <Text style={[styles.headerTitle, { color: colors.text }]}>{clientName} — Photos</Text>
              {photos.length > 0 && (
                <Text style={[styles.headerCount, { color: colors.textSecondary }]}>
                  {photos.length} photo{photos.length !== 1 ? 's' : ''}
                </Text>
              )}
            </View>
            <View style={styles.headerActions}>
              {photos.length > 0 && (
                <TouchableOpacity
                  style={[styles.selectBtn, selectMode && { backgroundColor: colors.primary }]}
                  onPress={() => {
                    setSelectMode(!selectMode);
                    if (selectMode) {
                      setSelectedPhotos(new Set());
                      setShowAttachPanel(false);
                    }
                  }}
                >
                  <Text style={[styles.selectBtnText, selectMode && { color: '#fff' }]}>
                    {selectMode ? 'Cancel' : 'Select'}
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <X size={22} color={colors.text} />
              </TouchableOpacity>
            </View>
          </View>

          {selectMode && selectedPhotos.size > 0 && (
            <View style={[styles.actionBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
              <TouchableOpacity
                style={[styles.actionBarBtn, { overflow: 'hidden' }]}
                onPress={() => { setNewFolderInput(''); setShowFolderPicker(true); }}
              >
                <LinearGradient
                  colors={['#5c6b7a', '#6b7c8d']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.actionBarBtnGradient}
                >
                  <FolderInput size={15} color="#fff" />
                  <Text style={styles.actionBarBtnText}>Move to Folder</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBarBtn, { overflow: 'hidden' }]}
                onPress={() => setShowAttachPanel(true)}
              >
                <LinearGradient
                  colors={['#1B4D6E', '#245d82']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.actionBarBtnGradient}
                >
                  <Link size={15} color="#fff" />
                  <Text style={styles.actionBarBtnText}>Attach to Job</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBarBtn, { overflow: 'hidden' }]}
                onPress={() => { setSendCaption(''); setShowSendModal(true); }}
              >
                <LinearGradient
                  colors={['#2D8B57', '#34a065']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.actionBarBtnGradient}
                >
                  <Send size={15} color="#fff" />
                  <Text style={styles.actionBarBtnText}>Send to Client</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}

          {(folders.length > 0 || photos.length > 0) && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={[styles.folderBar, { borderBottomColor: colors.border }]}
              contentContainerStyle={styles.folderBarContent}
            >
              <TouchableOpacity
                style={[styles.folderTab, !activeFolder && { backgroundColor: colors.primary }]}
                onPress={() => setActiveFolder(null)}
              >
                <Images size={13} color={!activeFolder ? '#fff' : colors.textSecondary} />
                <Text style={[styles.folderTabText, { color: !activeFolder ? '#fff' : colors.textSecondary }]}>
                  All ({photos.length})
                </Text>
              </TouchableOpacity>
              {folders.map(folder => (
                <TouchableOpacity
                  key={folder}
                  style={[styles.folderTab, activeFolder === folder && { backgroundColor: colors.primary }]}
                  onPress={() => setActiveFolder(folder)}
                >
                  <FolderOpen size={13} color={activeFolder === folder ? '#fff' : colors.textSecondary} />
                  <Text style={[styles.folderTabText, { color: activeFolder === folder ? '#fff' : colors.textSecondary }]}>
                    {folder} ({photos.filter(p => p.folder_name === folder).length})
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {loading ? (
              <ActivityIndicator style={{ marginTop: 60 }} color={colors.primary} />
            ) : photos.length === 0 ? (
              <View style={styles.empty}>
                <Images size={48} color={colors.textSecondary} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No photos yet</Text>
                <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
                  Photos taken from the Camera tab will appear here
                </Text>
              </View>
            ) : displayedPhotos.length === 0 && activeFolder ? (
              <View style={styles.empty}>
                <FolderOpen size={48} color={colors.textSecondary} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No photos in "{activeFolder}"</Text>
                <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
                  Select photos and use "Move to Folder" to add them here
                </Text>
              </View>
            ) : (
              <View style={styles.grid}>
                {displayedPhotos.map((photo) => {
                  const isSelected = selectedPhotos.has(photo.id);
                  const hasAnnotation = !!photo.annotation_data;
                  return (
                    <TouchableOpacity
                      key={photo.id}
                      style={[
                        styles.photoCard,
                        isSelected && { borderColor: colors.primary, borderWidth: 3 },
                      ]}
                      onPress={() => {
                        if (selectMode) {
                          togglePhoto(photo.id);
                        } else {
                          setAnnotatingPhoto(photo);
                        }
                      }}
                      onLongPress={() => {
                        if (!selectMode) {
                          setSelectMode(true);
                          setSelectedPhotos(new Set([photo.id]));
                        }
                      }}
                      activeOpacity={0.85}
                    >
                      <AnnotatedPhoto
                        photoUri={photo.photo_url}
                        annotationData={photo.annotation_data}
                        style={styles.photoImage}
                        resizeMode="cover"
                      />
                      {selectMode && (
                        <View style={[styles.checkOverlay, isSelected && { backgroundColor: colors.primary }]}>
                          {isSelected ? (
                            <Check size={14} color="#fff" />
                          ) : (
                            <Square size={14} color="#fff" />
                          )}
                        </View>
                      )}
                      {hasAnnotation && !selectMode && (
                        <View style={[styles.annotationBadge, { backgroundColor: colors.primary }]}>
                          <Pen size={10} color="#fff" />
                        </View>
                      )}
                      {!selectMode && (
                        <View style={[styles.annotateOverlay]}>
                          <Pen size={14} color="#fff" />
                        </View>
                      )}
                      {photo.folder_name && !activeFolder && !selectMode && (
                        <View style={styles.folderBadge}>
                          <FolderOpen size={9} color="#fff" />
                          <Text style={styles.folderBadgeText} numberOfLines={1}>{photo.folder_name}</Text>
                        </View>
                      )}
                      {photo.caption ? (
                        <View style={styles.captionBar}>
                          <Text style={styles.captionText} numberOfLines={1}>
                            {photo.caption}
                          </Text>
                        </View>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>

      {annotatingPhoto && (
        <PhotoAnnotationModal
          visible={true}
          photoUri={displayUrl(annotatingPhoto)}
          onClose={() => setAnnotatingPhoto(null)}
          onSave={handleAnnotationSave}
        />
      )}

      <Modal visible={showSendModal} transparent animationType="fade" onRequestClose={() => setShowSendModal(false)}>
        <View style={styles.sendOverlay}>
          <View style={[styles.sendSheet, { backgroundColor: colors.card }]}>
            <View style={[styles.sendSheetHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.sendSheetTitle, { color: colors.text }]}>
                Send {selectedPhotos.size} Photo{selectedPhotos.size !== 1 ? 's' : ''} to {clientName}
              </Text>
              <TouchableOpacity onPress={() => setShowSendModal(false)}>
                <X size={20} color={colors.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.sendSheetBody}>
              <TextInput
                style={[styles.captionInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                placeholder="Add a message (optional)"
                placeholderTextColor={colors.textSecondary}
                value={sendCaption}
                onChangeText={setSendCaption}
                multiline
                numberOfLines={3}
              />
              <TouchableOpacity
                style={[styles.sendOptionBtn, { borderColor: colors.border, backgroundColor: colors.background }, !clientEmail && styles.sendOptionDisabled]}
                onPress={handleSendPhotosEmail}
                disabled={!clientEmail || sending}
              >
                {sending ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Mail size={20} color={clientEmail ? colors.primary : colors.textSecondary} />
                )}
                <View style={styles.sendOptionInfo}>
                  <Text style={[styles.sendOptionTitle, { color: clientEmail ? colors.text : colors.textSecondary }]}>Send by Email</Text>
                  <Text style={[styles.sendOptionSub, { color: colors.textSecondary }]}>{clientEmail || 'No email on file'}</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sendOptionBtn, { borderColor: colors.border, backgroundColor: colors.background }, !clientPhone && styles.sendOptionDisabled]}
                onPress={handleSendPhotosSms}
                disabled={!clientPhone || sending}
              >
                {sending ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <MessageSquare size={20} color={clientPhone ? colors.primary : colors.textSecondary} />
                )}
                <View style={styles.sendOptionInfo}>
                  <Text style={[styles.sendOptionTitle, { color: clientPhone ? colors.text : colors.textSecondary }]}>Send by Text</Text>
                  <Text style={[styles.sendOptionSub, { color: colors.textSecondary }]}>{clientPhone || 'No phone on file'}</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showFolderPicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowFolderPicker(false)}
      >
        <View style={styles.attachOverlay}>
          <View style={[styles.attachSheet, { backgroundColor: colors.card }]}>
            <View style={[styles.attachHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.attachTitle, { color: colors.text }]}>
                Move {selectedPhotos.size} Photo{selectedPhotos.size !== 1 ? 's' : ''} to Folder
              </Text>
              <TouchableOpacity onPress={() => setShowFolderPicker(false)}>
                <X size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={[styles.attachScroll, { maxHeight: 420 }]} showsVerticalScrollIndicator={false}>
              {folders.length > 0 && (
                <View style={{ marginBottom: 16 }}>
                  <Text style={[styles.folderPickerSectionLabel, { color: colors.textSecondary }]}>Existing Folders</Text>
                  {folders.map(folder => (
                    <TouchableOpacity
                      key={folder}
                      style={[styles.folderPickerRow, { borderColor: colors.border }]}
                      onPress={() => handleMoveToFolder(folder)}
                      disabled={movingToFolder}
                    >
                      <FolderOpen size={18} color={colors.primary} />
                      <Text style={[styles.folderPickerRowText, { color: colors.text }]}>{folder}</Text>
                      <Text style={[styles.folderPickerRowCount, { color: colors.textSecondary }]}>
                        {photos.filter(p => p.folder_name === folder).length} photos
                      </Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    style={[styles.folderPickerRow, { borderColor: colors.border }]}
                    onPress={() => handleMoveToFolder(null)}
                    disabled={movingToFolder}
                  >
                    <X size={18} color="#ef4444" />
                    <Text style={[styles.folderPickerRowText, { color: '#ef4444' }]}>Remove from folder</Text>
                  </TouchableOpacity>
                </View>
              )}

              <Text style={[styles.folderPickerSectionLabel, { color: colors.textSecondary }]}>
                {folders.length > 0 ? 'Create New Folder' : 'Add to a Folder'}
              </Text>

              {SUGGESTED_FOLDERS.filter(s => !folders.includes(s)).length > 0 && (
                <View style={styles.suggestedFolderChips}>
                  {SUGGESTED_FOLDERS.filter(s => !folders.includes(s)).map(s => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.suggestedChip, { borderColor: colors.border, backgroundColor: colors.background }]}
                      onPress={() => setNewFolderInput(s)}
                    >
                      <Text style={[styles.suggestedChipText, { color: colors.text }]}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <View style={[styles.newFolderInputRow, { borderColor: colors.border, backgroundColor: colors.background }]}>
                <FolderPlus size={16} color={colors.textSecondary} />
                <TextInput
                  style={[styles.newFolderInput, { color: colors.text }]}
                  value={newFolderInput}
                  onChangeText={setNewFolderInput}
                  placeholder="Type folder name..."
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="words"
                  onSubmitEditing={() => { if (newFolderInput.trim()) handleMoveToFolder(newFolderInput.trim()); }}
                  returnKeyType="done"
                />
              </View>
            </ScrollView>

            <View style={[styles.attachFooter, { borderTopColor: colors.border }]}>
              <TouchableOpacity
                style={[
                  styles.confirmAttachBtn,
                  { overflow: 'hidden' },
                  (!newFolderInput.trim() || movingToFolder) && { opacity: 0.4 },
                ]}
                onPress={() => { if (newFolderInput.trim()) handleMoveToFolder(newFolderInput.trim()); }}
                disabled={!newFolderInput.trim() || movingToFolder}
              >
                <LinearGradient
                  colors={['#1B4D6E', '#245d82']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.confirmAttachBtnGradient}
                >
                  {movingToFolder ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.confirmAttachText}>
                      Move to "{newFolderInput.trim() || '...'}"
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showAttachPanel}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAttachPanel(false)}
      >
        <View style={styles.attachOverlay}>
          <View style={[styles.attachSheet, { backgroundColor: colors.card }]}>
            <View style={[styles.attachHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.attachTitle, { color: colors.text }]}>
                Attach to Checklist Item
              </Text>
              <TouchableOpacity onPress={() => setShowAttachPanel(false)}>
                <X size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.attachScroll} showsVerticalScrollIndicator={false}>
              {jobs.length === 0 ? (
                <Text style={[styles.noJobsText, { color: colors.textSecondary }]}>
                  No jobs found for this client
                </Text>
              ) : (
                jobs.map((job) => (
                  <View key={job.id} style={[styles.jobBlock, { borderColor: colors.border }]}>
                    <TouchableOpacity
                      style={styles.jobRow}
                      onPress={() => toggleJobExpand(job.id)}
                    >
                      <View style={styles.jobRowLeft}>
                        <ListChecks size={16} color={colors.primary} />
                        <View style={{ marginLeft: 10 }}>
                          <Text style={[styles.jobTitle, { color: colors.text }]}>{job.title}</Text>
                          {job.job_date && (
                            <Text style={[styles.jobDate, { color: colors.textSecondary }]}>
                              {new Date(job.job_date).toLocaleDateString()}
                            </Text>
                          )}
                        </View>
                      </View>
                      {expandedJob === job.id ? (
                        <ChevronUp size={16} color={colors.textSecondary} />
                      ) : (
                        <ChevronDown size={16} color={colors.textSecondary} />
                      )}
                    </TouchableOpacity>

                    {expandedJob === job.id && (
                      <View style={[styles.checklistsContainer, { borderTopColor: colors.border }]}>
                        <TouchableOpacity
                          style={[styles.newChecklistBtn, { borderColor: colors.primary }]}
                          onPress={() => {
                            setShowNewChecklist(showNewChecklist === job.id ? null : job.id);
                            setNewChecklistTitle('');
                            setNewChecklistItems(['']);
                          }}
                        >
                          <Plus size={14} color={colors.primary} />
                          <Text style={[styles.newChecklistBtnText, { color: colors.primary }]}>
                            New Checklist
                          </Text>
                        </TouchableOpacity>

                        {showNewChecklist === job.id && (
                          <View style={[styles.newChecklistForm, { borderColor: colors.border }]}>
                            <TextInput
                              style={[styles.newClInput, { color: colors.text, borderColor: colors.border }]}
                              placeholder="Checklist title"
                              placeholderTextColor={colors.textSecondary}
                              value={newChecklistTitle}
                              onChangeText={setNewChecklistTitle}
                            />
                            <Text style={[styles.itemsLabel, { color: colors.textSecondary }]}>Items</Text>
                            {newChecklistItems.map((item, idx) => (
                              <View key={idx} style={styles.itemFieldRow}>
                                <TextInput
                                  style={[styles.itemInput, { color: colors.text, borderColor: colors.border, flex: 1 }]}
                                  placeholder={`Item ${idx + 1}`}
                                  placeholderTextColor={colors.textSecondary}
                                  value={item}
                                  onChangeText={(v) => updateChecklistItemField(idx, v)}
                                />
                                {newChecklistItems.length > 1 && (
                                  <TouchableOpacity
                                    onPress={() => removeChecklistItemField(idx)}
                                    style={styles.removeItemBtn}
                                  >
                                    <Trash2 size={14} color="#ef4444" />
                                  </TouchableOpacity>
                                )}
                              </View>
                            ))}
                            <TouchableOpacity onPress={addChecklistItemField} style={styles.addItemFieldBtn}>
                              <Plus size={13} color={colors.primary} />
                              <Text style={[styles.addItemFieldText, { color: colors.primary }]}>Add item</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[
                                styles.saveChecklistBtn,
                                { overflow: 'hidden' },
                                (!newChecklistTitle.trim() || savingChecklist) && { opacity: 0.5 },
                              ]}
                              onPress={() => handleCreateChecklist(job.id)}
                              disabled={!newChecklistTitle.trim() || savingChecklist}
                            >
                              <LinearGradient
                                colors={['#1B4D6E', '#245d82']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.saveChecklistBtnGradient}
                              >
                                {savingChecklist ? (
                                  <ActivityIndicator color="#fff" size="small" />
                                ) : (
                                  <Text style={styles.saveChecklistBtnText}>Create Checklist</Text>
                                )}
                              </LinearGradient>
                            </TouchableOpacity>
                          </View>
                        )}

                        {(checklists[job.id] || []).map((cl) => (
                          <View key={cl.id} style={[styles.checklistBlock, { borderColor: colors.border }]}>
                            <Text style={[styles.checklistTitle, { color: colors.text }]}>{cl.title}</Text>
                            {cl.items.length === 0 ? (
                              <Text style={[styles.noItemsText, { color: colors.textSecondary }]}>
                                No items
                              </Text>
                            ) : (
                              cl.items.map((item) => {
                                const isChosen = selectedChecklistItem === item.id;
                                return (
                                  <TouchableOpacity
                                    key={item.id}
                                    style={[
                                      styles.checklistItemRow,
                                      isChosen && { backgroundColor: colors.primary + '18' },
                                    ]}
                                    onPress={() =>
                                      setSelectedChecklistItem(isChosen ? null : item.id)
                                    }
                                  >
                                    <View
                                      style={[
                                        styles.itemSelectCircle,
                                        isChosen && { backgroundColor: colors.primary, borderColor: colors.primary },
                                      ]}
                                    >
                                      {isChosen && <Check size={11} color="#fff" />}
                                    </View>
                                    <Text style={[styles.itemText, { color: colors.text }]}>
                                      {item.description}
                                    </Text>
                                  </TouchableOpacity>
                                );
                              })
                            )}
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                ))
              )}
            </ScrollView>

            <View style={[styles.attachFooter, { borderTopColor: colors.border }]}>
              <TouchableOpacity
                style={[
                  styles.confirmAttachBtn,
                  { overflow: 'hidden' },
                  (!selectedChecklistItem || attaching) && { opacity: 0.4 },
                ]}
                onPress={handleAttachToItem}
                disabled={!selectedChecklistItem || attaching}
              >
                <LinearGradient
                  colors={['#1B4D6E', '#245d82']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.confirmAttachBtnGradient}
                >
                  {attaching ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.confirmAttachText}>
                      Attach {selectedPhotos.size} Photo{selectedPhotos.size !== 1 ? 's' : ''}
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerCount: {
    fontSize: 13,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  selectBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  closeBtn: {
    padding: 4,
    marginLeft: 4,
  },
  attachBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  attachBarText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  scrollContent: {
    padding: 16,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 80,
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  photoCard: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: '#eee',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  checkOverlay: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  annotationBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  annotateOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 6,
    paddingTop: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
    opacity: 0,
  },
  captionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  captionText: {
    color: '#fff',
    fontSize: 10,
  },
  attachOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  attachSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    paddingBottom: Platform.OS === 'ios' ? 30 : 16,
  },
  attachHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  attachTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  attachScroll: {
    flex: 1,
    padding: 16,
  },
  noJobsText: {
    textAlign: 'center',
    paddingTop: 32,
    fontSize: 14,
  },
  jobBlock: {
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 10,
    overflow: 'hidden',
  },
  jobRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  jobRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  jobTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  jobDate: {
    fontSize: 12,
    marginTop: 1,
  },
  checklistsContainer: {
    borderTopWidth: 1,
    padding: 12,
    gap: 10,
  },
  newChecklistBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  newChecklistBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  newChecklistForm: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  newClInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
  },
  itemsLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  itemFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  itemInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 13,
  },
  removeItemBtn: {
    padding: 6,
  },
  addItemFieldBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingTop: 2,
  },
  addItemFieldText: {
    fontSize: 13,
    fontWeight: '500',
  },
  saveChecklistBtn: {
    borderRadius: 8,
    overflow: 'hidden',
    marginTop: 4,
  },
  saveChecklistBtnGradient: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  saveChecklistBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  checklistBlock: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    gap: 4,
  },
  checklistTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  noItemsText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  checklistItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 4,
    borderRadius: 8,
    gap: 10,
  },
  itemSelectCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#aaa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: {
    fontSize: 13,
    flex: 1,
  },
  attachFooter: {
    borderTopWidth: 1,
    padding: 16,
  },
  confirmAttachBtn: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  confirmAttachBtnGradient: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmAttachText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  actionBar: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  actionBarBtn: {
    flex: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  actionBarBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 10,
  },
  actionBarBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  sendOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sendSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  sendSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  sendSheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
    paddingRight: 12,
  },
  sendSheetBody: {
    padding: 16,
    gap: 12,
  },
  captionInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 72,
    textAlignVertical: 'top',
  },
  sendOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  sendOptionDisabled: {
    opacity: 0.4,
  },
  sendOptionInfo: {
    flex: 1,
  },
  sendOptionTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  sendOptionSub: {
    fontSize: 13,
    marginTop: 2,
  },
  folderBar: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    maxHeight: 46,
  },
  folderBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  folderTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.12)',
  },
  folderTabText: {
    fontSize: 12,
    fontWeight: '600',
  },
  folderBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
    maxWidth: '80%',
  },
  folderBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '600',
  },
  folderPickerSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
    marginTop: 4,
  },
  folderPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  folderPickerRowText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  folderPickerRowCount: {
    fontSize: 12,
  },
  suggestedFolderChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  suggestedChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  suggestedChipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  newFolderInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 4,
  },
  newFolderInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
    margin: 0,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
  } as any,
});
