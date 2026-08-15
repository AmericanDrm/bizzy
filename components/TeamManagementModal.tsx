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
  Platform,
  TextInput,
  Share,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Shield, UserCog, User, ChevronDown, Trash2, Copy, CircleCheck as CheckCircle, Settings, Send, UserPlus, Link } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { supabase } from '@/lib/supabase';
import OrganizationalDefaultsModal from './OrganizationalDefaultsModal';

interface TeamManagementModalProps {
  visible: boolean;
  onClose: () => void;
}

interface TeamMember {
  id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'manager' | 'member';
  email: string;
  display_name: string;
}

type RoleType = 'owner' | 'admin' | 'manager' | 'member';

const ROLE_LABELS: Record<RoleType, string> = {
  owner: 'Owner',
  admin: 'Admin',
  manager: 'Manager',
  member: 'Member',
};

const ROLE_DESCRIPTIONS: Record<RoleType, string> = {
  owner: 'Full control over organization',
  admin: 'Can manage team and settings',
  manager: 'Can assign jobs and manage schedule',
  member: 'Can only see their assigned work',
};

export default function TeamManagementModal({
  visible,
  onClose,
}: TeamManagementModalProps) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { organizationMember, currentOrganization, refreshOrganizations } = useOrganization();
  const isOwner = organizationMember?.role === 'owner';
  const isAdmin = organizationMember?.role === 'admin' || organizationMember?.role === 'owner';
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState<string>('');
  const [codeCopied, setCodeCopied] = useState(false);
  const [showDefaultsModal, setShowDefaultsModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [sendingInvite, setSendingInvite] = useState(false);
  const [inviteSent, setInviteSent] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [confirmRemoveUserId, setConfirmRemoveUserId] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      fetchTeamMembers();
      fetchJoinCode();
    }
  }, [visible]);

  const fetchJoinCode = async () => {
    if (!currentOrganization?.id || !isAdmin) return;

    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('join_code')
        .eq('id', currentOrganization.id)
        .maybeSingle();

      if (error) throw error;
      if (data?.join_code) {
        setJoinCode(data.join_code);
      }
    } catch (error) {
      console.error('Error fetching join code:', error);
    }
  };

  const getInviteLink = () => {
    const base = Platform.OS === 'web' && typeof window !== 'undefined'
      ? `${window.location.origin}/invite`
      : 'https://getbizzy.io/invite';
    return `${base}?code=${joinCode}`;
  };

  const handleCopyCode = async () => {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(joinCode);
        setCodeCopied(true);
        setTimeout(() => setCodeCopied(false), 2000);
      } catch (error) {
        console.error('Error copying code:', error);
      }
    }
  };

  const handleShareInviteLink = async () => {
    const link = getInviteLink();
    const orgName = currentOrganization?.name || 'our team';
    const message = `Join ${orgName} on Bizzy! Tap this link to sign up and your organization code will be filled in automatically:\n\n${link}`;

    if (Platform.OS === 'web') {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(link);
          Alert.alert('Copied!', 'Invite link copied to clipboard.');
        } catch {
          Alert.alert('Invite Link', link);
        }
      }
    } else {
      try {
        await Share.share({ message, url: link });
      } catch {
        // user dismissed
      }
    }
  };

  const handleSendInvite = async () => {
    if (!inviteEmail.trim() || !currentOrganization?.id) return;
    setSendingInvite(true);
    try {
      const { data: orgData } = await supabase
        .from('organizations')
        .select('name, join_code')
        .eq('id', currentOrganization.id)
        .maybeSingle();

      const inviteLink = getInviteLink();
      const { fetchFunction } = await import('@/lib/supabase');
      await fetchFunction('send-tenant-email', {
        method: 'POST',
        body: {
          to: inviteEmail.trim(),
          subject: `You're invited to join ${orgData?.name || 'our team'} on Bizzy`,
          html: `
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
              <h2 style="font-size: 22px; font-weight: 700; color: #111;">You're invited!</h2>
              <p style="color: #555; font-size: 15px; line-height: 1.6;">
                You've been invited to join <strong>${orgData?.name || 'our organization'}</strong> on <strong>Bizzy</strong> — the field service management app.
              </p>
              <p style="color: #555; font-size: 15px; line-height: 1.6;">
                Tap the button below to sign up. Your organization code will be filled in automatically.
              </p>
              <div style="text-align: center; margin: 28px 0;">
                <a href="${inviteLink}" style="display: inline-block; background: #1B4D6E; color: #fff; font-size: 16px; font-weight: 700; padding: 14px 32px; border-radius: 10px; text-decoration: none;">
                  Accept Invitation
                </a>
              </div>
              <div style="background: #f4f4f5; border-radius: 10px; padding: 20px; text-align: center; margin: 0 0 24px;">
                <p style="font-size: 13px; color: #888; margin: 0 0 6px;">Or enter this code manually during sign up</p>
                <p style="font-size: 28px; font-weight: 700; letter-spacing: 4px; color: #111; margin: 0;">${orgData?.join_code || ''}</p>
              </div>
              <p style="color: #aaa; font-size: 12px; text-align: center;">
                If the button doesn't work, copy this link: ${inviteLink}
              </p>
            </div>
          `,
        },
      });

      setInviteSent(true);
      setInviteEmail('');
      setTimeout(() => {
        setInviteSent(false);
        setShowInviteForm(false);
      }, 3000);
    } catch (error) {
      Alert.alert('Error', 'Failed to send invite. Please try again.');
    } finally {
      setSendingInvite(false);
    }
  };

  const fetchTeamMembers = async () => {
    if (!currentOrganization?.id) return;

    try {
      setLoading(true);
      const { data: orgMembersData, error: orgMembersError } = await supabase
        .from('organization_members')
        .select('id, user_id, role')
        .eq('organization_id', currentOrganization.id);

      if (orgMembersError) throw orgMembersError;

      if (!orgMembersData || orgMembersData.length === 0) {
        setMembers([]);
        setLoading(false);
        return;
      }

      const userIds = orgMembersData.map((m) => m.user_id);
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, display_name')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      const membersWithProfiles = orgMembersData.map((member) => {
        const profile = profilesData?.find((p) => p.id === member.user_id);
        return {
          id: member.id,
          user_id: member.user_id,
          role: member.role as RoleType,
          email: profile?.email || 'Unknown',
          display_name: profile?.display_name || profile?.email?.split('@')[0] || 'Unknown User',
        };
      });

      setMembers(membersWithProfiles);
    } catch (error) {
      console.error('Error fetching team members:', error);
      Alert.alert('Error', 'Failed to load team members');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (memberId: string, newRole: RoleType) => {
    const member = members.find((m) => m.id === memberId);
    if (!member) return;

    if (member.user_id === user?.id && member.role === 'owner') {
      Alert.alert(
        'Cannot Change Role',
        'You cannot change your own role as the organization owner.',
        [{ text: 'OK' }]
      );
      return;
    }

    if (member.user_id === user?.id && (member.role === 'admin' || member.role === 'manager') && newRole === 'member') {
      Alert.alert(
        'Warning',
        'You are about to downgrade your own access. Are you sure?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Continue',
            style: 'destructive',
            onPress: () => updateRole(memberId, newRole),
          },
        ]
      );
      return;
    }

    await updateRole(memberId, newRole);
  };

  const updateRole = async (memberId: string, newRole: RoleType) => {
    if (!currentOrganization?.id) return;

    setUpdating(memberId);
    try {
      const { error } = await supabase
        .from('organization_members')
        .update({ role: newRole })
        .eq('id', memberId)
        .eq('organization_id', currentOrganization.id);

      if (error) throw error;

      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m))
      );
      setExpandedUserId(null);
      await refreshOrganizations();
    } catch (error: any) {
      console.error('Error updating role:', error);
      Alert.alert('Error', error.message || 'Failed to update role');
    } finally {
      setUpdating(null);
    }
  };

  const handleRemoveMember = (member: TeamMember) => {
    if (member.user_id === user?.id) {
      Alert.alert(
        'Cannot Remove Yourself',
        'You cannot remove yourself from the organization.',
        [{ text: 'OK' }]
      );
      return;
    }

    if (member.role === 'owner') {
      Alert.alert(
        'Cannot Remove Owner',
        'The organization owner cannot be removed.',
        [{ text: 'OK' }]
      );
      return;
    }

    setConfirmRemoveUserId(member.user_id);
  };

  const removeMember = async (member: TeamMember) => {
    if (!currentOrganization) return;
    setRemoving(member.user_id);
    try {
      const { error } = await supabase
        .from('organization_members')
        .delete()
        .eq('organization_id', currentOrganization.id)
        .eq('user_id', member.user_id);

      if (error) throw error;

      setMembers((prev) => prev.filter((m) => m.user_id !== member.user_id));
      setExpandedUserId(null);
    } catch (error: any) {
      console.error('Error removing member:', error);
      Alert.alert('Error', error.message || 'Failed to remove member');
    } finally {
      setRemoving(null);
    }
  };

  const getRoleIcon = (role: RoleType) => {
    switch (role) {
      case 'owner':
        return <Shield size={18} color={colors.primary} />;
      case 'admin':
        return <UserCog size={18} color={colors.error} />;
      case 'manager':
        return <UserCog size={18} color="#d97706" />;
      default:
        return <User size={18} color={colors.textSecondary} />;
    }
  };

  const getRoleColor = (role: RoleType) => {
    switch (role) {
      case 'owner':
        return colors.primary;
      case 'admin':
        return colors.error;
      case 'manager':
        return '#d97706';
      default:
        return colors.textSecondary;
    }
  };

  const dynamicStyles = getDynamicStyles(colors);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={dynamicStyles.overlay}>
        <View style={dynamicStyles.modal}>
          <View style={dynamicStyles.header}>
            <Text style={dynamicStyles.title}>Team Management</Text>
            <TouchableOpacity onPress={onClose}>
              <X size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={dynamicStyles.content}>
            <Text style={dynamicStyles.description}>
              Manage team member roles and permissions. Admins can view all data and manage settings.
              Managers can assign jobs and manage the schedule. Members can only see their assigned work.
            </Text>

            {isAdmin && (
              <TouchableOpacity
                style={[dynamicStyles.defaultsButton, { marginBottom: 4 }]}
                onPress={() => setShowDefaultsModal(true)}
              >
                <Settings size={20} color={colors.primary} />
                <View style={dynamicStyles.defaultsButtonContent}>
                  <Text style={dynamicStyles.defaultsButtonTitle}>
                    Set Organizational Defaults
                  </Text>
                  <Text style={dynamicStyles.defaultsButtonSubtext}>
                    Configure default layout for new team members
                  </Text>
                </View>
                <ChevronDown
                  size={20}
                  color={colors.textSecondary}
                  style={{ transform: [{ rotate: '-90deg' }] }}
                />
              </TouchableOpacity>
            )}

            {isAdmin && joinCode && (
              <View style={dynamicStyles.joinCodeContainer}>
                <Text style={dynamicStyles.joinCodeLabel}>Organization Join Code</Text>
                <Text style={dynamicStyles.joinCodeSubtext}>
                  Share this code with team members to join your organization
                </Text>
                <View style={dynamicStyles.codeDisplayContainer}>
                  <Text style={dynamicStyles.codeDisplayText}>{joinCode}</Text>
                  <TouchableOpacity
                    style={dynamicStyles.copyButton}
                    onPress={handleCopyCode}
                  >
                    {codeCopied ? (
                      <CheckCircle size={18} color="#16a34a" />
                    ) : (
                      <Copy size={18} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                </View>
                {codeCopied && (
                  <Text style={dynamicStyles.copiedText}>Copied to clipboard!</Text>
                )}

                {!showInviteForm ? (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 14, backgroundColor: colors.primary + '15', borderRadius: 8 }}
                      onPress={handleShareInviteLink}
                    >
                      <Link size={16} color={colors.primary} />
                      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.primary }}>Share Invite Link</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 14, backgroundColor: colors.primary + '10', borderRadius: 8, borderWidth: 1, borderColor: colors.primary + '30' }}
                      onPress={() => setShowInviteForm(true)}
                    >
                      <UserPlus size={16} color={colors.primary} />
                      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.primary }}>Invite by Email</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={{ marginTop: 12, backgroundColor: colors.surface, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: colors.border }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 4 }}>Invite team member by email</Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 10 }}>
                      They'll receive an email with the join code and download instructions.
                    </Text>
                    <TextInput
                      style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.text, backgroundColor: colors.background, marginBottom: 10 }}
                      value={inviteEmail}
                      onChangeText={setInviteEmail}
                      placeholder="employee@email.com"
                      placeholderTextColor={colors.textSecondary}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity
                        style={{ flex: 1, borderRadius: 8, overflow: 'hidden' }}
                        onPress={handleSendInvite}
                        disabled={sendingInvite || !inviteEmail.trim()}
                      >
                        <LinearGradient
                          colors={inviteSent ? ['#2D8B57', '#34a065'] : ['#1B4D6E', '#245d82']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 }}
                        >
                          {sendingInvite ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : inviteSent ? (
                            <>
                              <CheckCircle size={16} color="#fff" />
                              <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>Sent!</Text>
                            </>
                          ) : (
                            <>
                              <Send size={16} color="#fff" />
                              <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>Send Invite</Text>
                            </>
                          )}
                        </LinearGradient>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={{ paddingHorizontal: 14, paddingVertical: 10, backgroundColor: colors.surface, borderRadius: 8, borderWidth: 1, borderColor: colors.border }}
                        onPress={() => { setShowInviteForm(false); setInviteEmail(''); }}
                      >
                        <Text style={{ fontSize: 14, color: colors.textSecondary }}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            )}

            {loading ? (
              <View style={dynamicStyles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : (
              <View style={dynamicStyles.membersList}>
                {members.map((member) => {
                  const isExpanded = expandedUserId === member.user_id;
                  const isCurrentUser = member.user_id === user?.id;

                  return (
                    <View key={member.id} style={dynamicStyles.memberCard}>
                      <TouchableOpacity
                        style={dynamicStyles.memberHeader}
                        onPress={() => {
                          setExpandedUserId(isExpanded ? null : member.user_id);
                          if (isExpanded) setConfirmRemoveUserId(null);
                        }}
                      >
                        <View style={dynamicStyles.memberInfo}>
                          <View style={dynamicStyles.memberNameRow}>
                            <Text style={dynamicStyles.memberName}>
                              {member.display_name}
                            </Text>
                            {isCurrentUser && (
                              <View style={dynamicStyles.youBadge}>
                                <Text style={dynamicStyles.youBadgeText}>You</Text>
                              </View>
                            )}
                          </View>
                          <Text style={dynamicStyles.memberEmail}>{member.email}</Text>
                        </View>
                        <View style={dynamicStyles.memberRoleContainer}>
                          {getRoleIcon(member.role)}
                          <Text
                            style={[
                              dynamicStyles.memberRole,
                              { color: getRoleColor(member.role) },
                            ]}
                          >
                            {ROLE_LABELS[member.role]}
                          </Text>
                          <ChevronDown
                            size={16}
                            color={colors.textSecondary}
                            style={{
                              transform: [{ rotate: isExpanded ? '180deg' : '0deg' }],
                            }}
                          />
                        </View>
                      </TouchableOpacity>

                      {isExpanded && (
                        <View style={dynamicStyles.roleOptions}>
                          {updating === member.id ? (
                            <ActivityIndicator size="small" color={colors.primary} />
                          ) : (
                            <>
                              {(['admin', 'manager', 'member'] as RoleType[]).map((role) => (
                                <TouchableOpacity
                                  key={role}
                                  style={[
                                    dynamicStyles.roleOption,
                                    member.role === role && dynamicStyles.roleOptionActive,
                                  ]}
                                  onPress={() => handleRoleChange(member.id, role)}
                                >
                                  <View style={dynamicStyles.roleOptionHeader}>
                                    {getRoleIcon(role)}
                                    <Text
                                      style={[
                                        dynamicStyles.roleOptionLabel,
                                        member.role === role && {
                                          color: getRoleColor(role),
                                          fontWeight: '600',
                                        },
                                      ]}
                                    >
                                      {ROLE_LABELS[role]}
                                    </Text>
                                  </View>
                                  <Text style={dynamicStyles.roleOptionDescription}>
                                    {ROLE_DESCRIPTIONS[role]}
                                  </Text>
                                </TouchableOpacity>
                              ))}
                              {isOwner && !isCurrentUser && (
                                confirmRemoveUserId === member.user_id ? (
                                  <View style={dynamicStyles.confirmRemoveContainer}>
                                    <Text style={dynamicStyles.confirmRemoveText}>
                                      Remove {member.display_name} from the organization?
                                    </Text>
                                    <View style={dynamicStyles.confirmRemoveButtons}>
                                      <TouchableOpacity
                                        style={dynamicStyles.confirmCancelButton}
                                        onPress={() => setConfirmRemoveUserId(null)}
                                      >
                                        <Text style={dynamicStyles.confirmCancelText}>Cancel</Text>
                                      </TouchableOpacity>
                                      <TouchableOpacity
                                        style={dynamicStyles.confirmRemoveButton}
                                        onPress={() => { setConfirmRemoveUserId(null); removeMember(member); }}
                                        disabled={removing === member.user_id}
                                      >
                                        {removing === member.user_id ? (
                                          <ActivityIndicator size="small" color="#fff" />
                                        ) : (
                                          <Text style={dynamicStyles.confirmRemoveButtonText}>Remove</Text>
                                        )}
                                      </TouchableOpacity>
                                    </View>
                                  </View>
                                ) : (
                                  <TouchableOpacity
                                    style={dynamicStyles.removeButton}
                                    onPress={() => handleRemoveMember(member)}
                                    disabled={removing === member.user_id}
                                  >
                                    {removing === member.user_id ? (
                                      <ActivityIndicator size="small" color={colors.error} />
                                    ) : (
                                      <>
                                        <Trash2 size={16} color={colors.error} />
                                        <Text style={dynamicStyles.removeButtonText}>
                                          Remove from Organization
                                        </Text>
                                      </>
                                    )}
                                  </TouchableOpacity>
                                )
                              )}
                            </>
                          )}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </ScrollView>
        </View>
      </View>

      <OrganizationalDefaultsModal
        visible={showDefaultsModal}
        onClose={() => setShowDefaultsModal(false)}
      />
    </Modal>
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
      maxHeight: '90%',
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
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text,
    },
    content: {
      padding: 20,
    },
    description: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
      marginBottom: 20,
    },
    defaultsButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.cardBackground,
      padding: 16,
      borderRadius: 12,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 12,
    },
    defaultsButtonContent: {
      flex: 1,
    },
    defaultsButtonTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 2,
    },
    defaultsButtonSubtext: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    joinCodeContainer: {
      backgroundColor: colors.cardBackground,
      padding: 16,
      borderRadius: 12,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },
    joinCodeLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    joinCodeSubtext: {
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: 12,
    },
    codeDisplayContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.inputBackground,
      padding: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    codeDisplayText: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.primary,
      letterSpacing: 4,
    },
    copyButton: {
      padding: 8,
      borderRadius: 8,
      backgroundColor: colors.surface,
    },
    copiedText: {
      fontSize: 12,
      color: '#16a34a',
      marginTop: 8,
      textAlign: 'center',
      fontWeight: '500',
    },
    loadingContainer: {
      padding: 40,
      alignItems: 'center',
    },
    membersList: {
      gap: 12,
    },
    memberCard: {
      backgroundColor: colors.cardBackground,
      borderRadius: 12,
      overflow: 'hidden',
    },
    memberHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
    },
    memberInfo: {
      flex: 1,
    },
    memberNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    memberName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    youBadge: {
      backgroundColor: colors.primary,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 10,
    },
    youBadgeText: {
      fontSize: 11,
      fontWeight: '600',
      color: '#fff',
    },
    memberEmail: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
    },
    memberRoleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    memberRole: {
      fontSize: 14,
      fontWeight: '500',
    },
    roleOptions: {
      padding: 16,
      paddingTop: 0,
      gap: 8,
    },
    roleOption: {
      padding: 12,
      borderRadius: 8,
      backgroundColor: colors.inputBackground,
    },
    roleOptionActive: {
      borderWidth: 1,
      borderColor: colors.border,
    },
    roleOptionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 4,
    },
    roleOptionLabel: {
      fontSize: 14,
      color: colors.text,
    },
    roleOptionDescription: {
      fontSize: 12,
      color: colors.textSecondary,
      marginLeft: 26,
    },
    removeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      padding: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.error,
      marginTop: 4,
    },
    removeButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.error,
    },
    confirmRemoveContainer: {
      marginTop: 4,
      padding: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.error,
      gap: 10,
    },
    confirmRemoveText: {
      fontSize: 13,
      color: colors.text,
      textAlign: 'center',
    },
    confirmRemoveButtons: {
      flexDirection: 'row',
      gap: 8,
    },
    confirmCancelButton: {
      flex: 1,
      padding: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
    },
    confirmCancelText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    confirmRemoveButton: {
      flex: 1,
      padding: 10,
      borderRadius: 8,
      backgroundColor: colors.error,
      alignItems: 'center',
    },
    confirmRemoveButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: '#fff',
    },
  });
