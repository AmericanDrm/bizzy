import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  Platform,
} from 'react-native';
import { X, Upload, Trash2, Image as ImageIcon, Check } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { supabase } from '@/lib/supabase';

interface LogoUploadModalProps {
  visible: boolean;
  onClose: () => void;
  currentLogoUrl?: string;
  onLogoUpdated: () => void;
  businessSettingsId: string;
}

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

export default function LogoUploadModal({
  visible,
  onClose,
  currentLogoUrl,
  onLogoUpdated,
  businessSettingsId,
}: LogoUploadModalProps) {
  const { colors } = useTheme();
  const { showToast } = useToast();
  const { currentOrganization } = useOrganization();
  const [selectedImage, setSelectedImage] = useState<{
    uri: string;
    type: string;
    name: string;
  } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setPreviewUrl(currentLogoUrl || null);
      setSelectedImage(null);
    }
  }, [visible, currentLogoUrl]);

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      showToast({
        message: 'Permission to access photos is required',
        type: 'error',
      });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];

      if (Platform.OS !== 'web') {
        const fileInfo = await FileSystem.getInfoAsync(asset.uri);
        if (fileInfo.exists && 'size' in fileInfo && fileInfo.size > MAX_FILE_SIZE) {
          showToast({
            message: 'Image must be smaller than 5MB',
            type: 'error',
          });
          return;
        }
      }

      const extension = asset.uri.split('.').pop()?.toLowerCase() || 'png';
      const mimeType = getMimeType(extension);

      if (!ACCEPTED_TYPES.includes(mimeType)) {
        showToast({
          message: 'Please select a PNG, JPG, SVG, or WebP image',
          type: 'error',
        });
        return;
      }

      setSelectedImage({
        uri: asset.uri,
        type: mimeType,
        name: `logo.${extension}`,
      });
      setPreviewUrl(asset.uri);
    }
  };

  const getMimeType = (extension: string): string => {
    const mimeTypes: Record<string, string> = {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      svg: 'image/svg+xml',
      webp: 'image/webp',
    };
    return mimeTypes[extension] || 'image/png';
  };

  const handleUpload = async () => {
    if (!selectedImage || !currentOrganization?.id) {
      showToast({
        message: 'Please select an image first',
        type: 'error',
      });
      return;
    }

    setUploading(true);

    try {
      const uuid = await Crypto.randomUUID();
      const extension = selectedImage.name.split('.').pop() || 'png';
      const fileName = `${currentOrganization.id}/${uuid}.${extension}`;

      let fileData: Blob | ArrayBuffer;

      if (Platform.OS === 'web') {
        const response = await fetch(selectedImage.uri);
        fileData = await response.blob();
      } else {
        const base64 = await FileSystem.readAsStringAsync(selectedImage.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        fileData = bytes.buffer;
      }

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('logos')
        .upload(fileName, fileData, {
          contentType: selectedImage.type,
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('logos')
        .getPublicUrl(fileName);

      const publicUrl = publicUrlData.publicUrl;

      const { error: updateError } = await supabase
        .from('business_settings')
        .update({
          logo_url: publicUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', businessSettingsId);

      if (updateError) throw updateError;

      showToast({
        message: 'Logo uploaded successfully',
        type: 'success',
      });

      onLogoUpdated();
      onClose();
    } catch (error: any) {
      console.error('Upload error:', error);
      showToast({
        message: error.message || 'Failed to upload logo',
        type: 'error',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (!currentLogoUrl || !businessSettingsId) return;

    setUploading(true);

    try {
      const urlParts = currentLogoUrl.split('/logos/');
      if (urlParts.length > 1) {
        const filePath = urlParts[1];
        await supabase.storage.from('logos').remove([filePath]);
      }

      const { error } = await supabase
        .from('business_settings')
        .update({
          logo_url: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', businessSettingsId);

      if (error) throw error;

      showToast({
        message: 'Logo removed successfully',
        type: 'success',
      });

      onLogoUpdated();
      onClose();
    } catch (error: any) {
      showToast({
        message: error.message || 'Failed to remove logo',
        type: 'error',
      });
    } finally {
      setUploading(false);
    }
  };

  const dynamicStyles = getDynamicStyles(colors);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={dynamicStyles.overlay}>
        <View style={dynamicStyles.modal}>
          <View style={dynamicStyles.header}>
            <Text style={dynamicStyles.title}>Business Logo</Text>
            <TouchableOpacity onPress={onClose} disabled={uploading}>
              <X size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={dynamicStyles.content}>
            <Text style={dynamicStyles.subtitle}>
              Upload your business logo to display on invoices and estimates
            </Text>

            <TouchableOpacity
              style={dynamicStyles.uploadArea}
              onPress={pickImage}
              disabled={uploading}
            >
              {previewUrl ? (
                <Image
                  source={{ uri: previewUrl }}
                  style={dynamicStyles.previewImage}
                  resizeMode="contain"
                />
              ) : (
                <View style={dynamicStyles.placeholder}>
                  <ImageIcon size={48} color={colors.textSecondary} />
                  <Text style={dynamicStyles.placeholderText}>
                    Tap to select an image
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {selectedImage && (
              <View style={dynamicStyles.selectedInfo}>
                <Check size={16} color={colors.success} />
                <Text style={dynamicStyles.selectedText}>
                  New image selected
                </Text>
              </View>
            )}

            <Text style={dynamicStyles.hint}>
              Accepts PNG, JPG, SVG, or WebP. Max 5MB.
            </Text>
          </View>

          <View style={dynamicStyles.footer}>
            {currentLogoUrl && !selectedImage && (
              <TouchableOpacity
                style={dynamicStyles.removeButton}
                onPress={handleRemoveLogo}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator size="small" color={colors.error} />
                ) : (
                  <>
                    <Trash2 size={18} color={colors.error} />
                    <Text style={dynamicStyles.removeButtonText}>Remove</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            <View style={dynamicStyles.mainButtons}>
              <TouchableOpacity
                style={dynamicStyles.cancelButton}
                onPress={onClose}
                disabled={uploading}
              >
                <Text style={dynamicStyles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  dynamicStyles.saveButton,
                  !selectedImage && dynamicStyles.saveButtonDisabled,
                ]}
                onPress={handleUpload}
                disabled={!selectedImage || uploading}
              >
                <LinearGradient
                  colors={['#1B4D6E', '#245d82']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={dynamicStyles.saveButtonGradient}
                >
                  {uploading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Upload size={18} color="#fff" />
                      <Text style={dynamicStyles.saveButtonText}>Save Logo</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const getDynamicStyles = (colors: any) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modal: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      width: '100%',
      maxWidth: 400,
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    title: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    content: {
      padding: 20,
    },
    subtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 20,
      lineHeight: 20,
    },
    uploadArea: {
      width: '100%',
      aspectRatio: 1,
      maxHeight: 200,
      borderRadius: 12,
      borderWidth: 2,
      borderStyle: 'dashed',
      borderColor: colors.border,
      backgroundColor: colors.inputBackground,
      overflow: 'hidden',
      justifyContent: 'center',
      alignItems: 'center',
    },
    previewImage: {
      width: '100%',
      height: '100%',
    },
    placeholder: {
      alignItems: 'center',
      gap: 12,
    },
    placeholderText: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    selectedInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 12,
      paddingVertical: 8,
      paddingHorizontal: 12,
      backgroundColor: colors.successLight || 'rgba(34, 197, 94, 0.1)',
      borderRadius: 8,
    },
    selectedText: {
      fontSize: 14,
      color: colors.success,
      fontWeight: '500',
    },
    hint: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 12,
      textAlign: 'center',
    },
    footer: {
      padding: 20,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      gap: 12,
    },
    removeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.error,
    },
    removeButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.error,
    },
    mainButtons: {
      flexDirection: 'row',
      gap: 12,
    },
    cancelButton: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
    },
    cancelButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    saveButton: {
      flex: 1,
      borderRadius: 10,
      overflow: 'hidden',
    },
    saveButtonGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
    },
    saveButtonDisabled: {
      opacity: 0.5,
    },
    saveButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: '#fff',
    },
  });
