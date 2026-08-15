import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  Share,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Users,
  DollarSign,
  Clock,
  TrendingUp,
  ChevronDown,
  ChevronRight,
  Save,
  CircleCheck as CheckCircle,
  Shield,
  UserCog,
  User,
  Trash2,
  Link,
  UserPlus,
  Send,
  Copy,
  Lock,
  Settings,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { fetchFunction } from '@/lib/supabase';
import OrganizationalDefaultsModal from '@/components/OrganizationalDefaultsModal';
import { getDynamicStyles } from '@/styles/hrStyles';

// ─── Types ────────────────────────────────────────────────────────────────────

type RoleType = 'owner' | 'admin' | 'manager' | 'member';

interface TeamMember {
  id: string;
  user_id: string;
  role: RoleType;
  email: string;
  display_name: string;
  is_active: boolean;
}

interface EmployeeHRRecord {
  user_id: string;
  member_id: string;
  display_name: string;
  email: string;
  role: string;
  hourly_rate: number | null;
  annual_salary: number | null;
  pay_rate_type: string;
  employment_type: string;
  pay_period: string;
  overtime_rate_multiplier: number;
  hr_notes: string;
}

interface HoursData {
  user_id: string;
  total_hours: number;
  regular_hours: number;
  overtime_hours: number;
  est_pay: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

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

const ROLE_COLORS: Record<string, string> = {
  owner: '#1B4D6E',
  admin: '#dc2626',
  manager: '#d97706',
  member: '#6b7280',
};

const EMPLOYMENT_TYPES = [
  { value: 'full_time', label: 'Full-Time' },
  { value: 'part_time', label: 'Part-Time' },
  { value: 'contractor', label: 'Contractor' },
  { value: 'seasonal', label: 'Seasonal' },
];

const PAY_PERIODS = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-Weekly' },
  { value: 'semimonthly', label: 'Semi-Monthly' },
  { value: 'monthly', label: 'Monthly' },
];

const PAY_RATE_TYPES = [
  { value: 'hourly', label: 'Hourly' },
  { value: 'salary', label: 'Salary' },
];

const OT_MULTIPLIERS = [
  { value: '1.0', label: '1.0x (No OT)' },
  { value: '1.5', label: '1.5x (Standard)' },
  { value: '2.0', label: '2.0x (Double)' },
];

const TABS = ['Team', 'HR & Pay', 'Invite'] as const;
type TabName = (typeof TABS)[number];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const start = new Date(now);
  start.setDate(now.getDate() - day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function formatCurrency(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
}

function formatHM(hours: number) {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function getInitials(name: string) {
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function HRTab() {
  const { colors, isDark } = useTheme();
  const s = getDynamicStyles(colors);
  const { currentOrganization, currentUserRole, isAdminOrManager, isAdminOrOwner } = useOrganization();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<TabName>('Team');
  const [refreshing, setRefreshing] = useState(false);

  // Team state
  const [teamLoading, setTeamLoading] = useState(true);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [togglingActiveId, setTogglingActiveId] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  // HR & Pay state
  const [hrLoading, setHrLoading] = useState(true);
  const [employees, setEmployees] = useState<EmployeeHRRecord[]>([]);
  const [hoursData, setHoursData] = useState<Record<string, HoursData>>({});
  const [expandedHrId, setExpandedHrId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Partial<EmployeeHRRecord>>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  // Invite state
  const [joinCode, setJoinCode] = useState('');
  const [codeCopied, setCodeCopied] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [sendingInvite, setSendingInvite] = useState(false);
  const [inviteSent, setInviteSent] = useState(false);

  // Org defaults modal
  const [orgDefaultsVisible, setOrgDefaultsVisible] = useState(false);

  const { start: weekStart, end: weekEnd } = getWeekRange();

  // ─── Data Fetching ──────────────────────────────────────────────────────────

  const fetchTeamMembers = useCallback(async () => {
    if (!currentOrganization?.id) return;
    setTeamLoading(true);
    try {
      const { data: orgMembers, error } = await supabase
        .from('organization_members')
        .select('id, user_id, role, is_active')
        .eq('organization_id', currentOrganization.id);
      if (error) throw error;
      if (!orgMembers?.length) { setMembers([]); return; }

      const userIds = orgMembers.map(m => m.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, display_name')
        .in('id', userIds);

      setMembers(
        orgMembers.map(m => {
          const p = profiles?.find(p => p.id === m.user_id);
          return {
            id: m.id,
            user_id: m.user_id,
            role: m.role as RoleType,
            email: p?.email || 'Unknown',
            display_name: p?.display_name || p?.email?.split('@')[0] || 'Unknown',
            is_active: (m as any).is_active ?? true,
          };
        })
      );
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to load team');
    } finally {
      setTeamLoading(false);
    }
  }, [currentOrganization?.id]);

  const fetchHRData = useCallback(async () => {
    if (!currentOrganization?.id) return;
    setHrLoading(true);
    try {
      const { data: orgMembers } = await supabase
        .from('organization_members')
        .select('id, user_id, role')
        .eq('organization_id', currentOrganization.id);
      if (!orgMembers?.length) { setEmployees([]); return; }

      const userIds = orgMembers.map(m => m.user_id);
      const [{ data: profiles }, { data: entries }] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, display_name, email, hourly_rate, annual_salary, pay_rate_type, employment_type, pay_period, overtime_rate_multiplier, hr_notes')
          .in('id', userIds),
        supabase
          .from('time_entries')
          .select('user_id, clock_in, clock_out')
          .in('user_id', userIds)
          .gte('clock_in', weekStart.toISOString())
          .lte('clock_in', weekEnd.toISOString())
          .not('clock_out', 'is', null),
      ]);

      const hrs: Record<string, HoursData> = {};
      (entries || []).forEach(e => {
        const h = (new Date(e.clock_out!).getTime() - new Date(e.clock_in).getTime()) / 3_600_000;
        if (!hrs[e.user_id]) hrs[e.user_id] = { user_id: e.user_id, total_hours: 0, regular_hours: 0, overtime_hours: 0, est_pay: 0 };
        hrs[e.user_id].total_hours += h;
      });

      const recs: EmployeeHRRecord[] = orgMembers.map(m => {
        const p = profiles?.find(p => p.id === m.user_id);
        return {
          user_id: m.user_id,
          member_id: m.id,
          display_name: p?.display_name || p?.email?.split('@')[0] || 'Unknown',
          email: p?.email || '',
          role: m.role,
          hourly_rate: p?.hourly_rate ?? null,
          annual_salary: p?.annual_salary ?? null,
          pay_rate_type: p?.pay_rate_type || 'hourly',
          employment_type: p?.employment_type || 'full_time',
          pay_period: p?.pay_period || 'biweekly',
          overtime_rate_multiplier: p?.overtime_rate_multiplier ?? 1.5,
          hr_notes: p?.hr_notes || '',
        };
      });

      recs.forEach(r => {
        const h = hrs[r.user_id];
        if (!h) return;
        h.regular_hours = Math.min(h.total_hours, 40);
        h.overtime_hours = Math.max(h.total_hours - 40, 0);
        if (r.pay_rate_type === 'hourly' && r.hourly_rate) {
          h.est_pay = h.regular_hours * r.hourly_rate + h.overtime_hours * r.hourly_rate * (r.overtime_rate_multiplier || 1.5);
        } else if (r.pay_rate_type === 'salary' && r.annual_salary) {
          h.est_pay = r.annual_salary / 52;
        }
      });

      setEmployees(recs);
      setHoursData(hrs);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to load HR data');
    } finally {
      setHrLoading(false);
    }
  }, [currentOrganization?.id]);

  const fetchJoinCode = useCallback(async () => {
    if (!currentOrganization?.id || !isAdminOrOwner) return;
    const { data } = await supabase
      .from('organizations')
      .select('join_code')
      .eq('id', currentOrganization.id)
      .maybeSingle();
    if (data?.join_code) setJoinCode(data.join_code);
  }, [currentOrganization?.id, isAdminOrOwner]);

  const fetchAll = useCallback(async () => {
    await Promise.all([fetchTeamMembers(), fetchHRData(), fetchJoinCode()]);
  }, [fetchTeamMembers, fetchHRData, fetchJoinCode]);

  useEffect(() => {
    if (currentOrganization?.id && isAdminOrManager) {
      fetchAll();
    }
  }, [currentOrganization?.id, isAdminOrManager]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  }, [fetchAll]);

  // ─── Team Actions ───────────────────────────────────────────────────────────

  const updateRole = async (memberId: string, newRole: RoleType) => {
    if (!currentOrganization?.id) return;
    setUpdatingRole(memberId);
    try {
      const { error } = await supabase
        .from('organization_members')
        .update({ role: newRole })
        .eq('id', memberId)
        .eq('organization_id', currentOrganization.id);
      if (error) throw error;
      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole } : m));
      setExpandedMemberId(null);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update role');
    } finally {
      setUpdatingRole(null);
    }
  };

  const handleRoleChange = (member: TeamMember, newRole: RoleType) => {
    if (member.user_id === user?.id && member.role === 'owner') {
      Alert.alert('Cannot Change Role', 'You cannot change your own role as the organization owner.');
      return;
    }
    if (member.user_id === user?.id && newRole === 'member') {
      Alert.alert('Warning', 'You are about to downgrade your own access. Are you sure?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Continue', style: 'destructive', onPress: () => updateRole(member.id, newRole) },
      ]);
      return;
    }
    updateRole(member.id, newRole);
  };

  const toggleActive = async (member: TeamMember) => {
    if (!currentOrganization?.id) return;
    const newActive = !member.is_active;
    setTogglingActiveId(member.user_id);
    try {
      const { error } = await supabase
        .from('organization_members')
        .update({ is_active: newActive })
        .eq('id', member.id)
        .eq('organization_id', currentOrganization.id);
      if (error) throw error;
      setMembers(prev => prev.map(m => m.id === member.id ? { ...m, is_active: newActive } : m));
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update status');
    } finally {
      setTogglingActiveId(null);
    }
  };

  const confirmRemove = (member: TeamMember) => {
    if (member.user_id === user?.id) { Alert.alert('Cannot Remove Yourself', 'You cannot remove yourself from the organization.'); return; }
    if (member.role === 'owner') { Alert.alert('Cannot Remove Owner', 'The organization owner cannot be removed.'); return; }
    Alert.alert('Remove Member', `Remove ${member.display_name} from the organization?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          if (!currentOrganization) return;
          setRemovingId(member.user_id);
          try {
            const { error } = await supabase
              .from('organization_members')
              .delete()
              .eq('organization_id', currentOrganization.id)
              .eq('user_id', member.user_id);
            if (error) throw error;
            setMembers(prev => prev.filter(m => m.user_id !== member.user_id));
            setExpandedMemberId(null);
          } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to remove member');
          } finally {
            setRemovingId(null);
          }
        },
      },
    ]);
  };

  // ─── HR & Pay Actions ───────────────────────────────────────────────────────

  const getDraft = (userId: string) => drafts[userId] || {};
  const setDraft = (userId: string, patch: Partial<EmployeeHRRecord>) =>
    setDrafts(prev => ({ ...prev, [userId]: { ...prev[userId], ...patch } }));
  const getEffective = (emp: EmployeeHRRecord): EmployeeHRRecord => ({ ...emp, ...getDraft(emp.user_id) });

  const handleSave = async (emp: EmployeeHRRecord) => {
    const draft = getDraft(emp.user_id);
    if (!Object.keys(draft).length) return;
    setSaving(emp.user_id);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          hourly_rate: draft.hourly_rate !== undefined ? draft.hourly_rate : emp.hourly_rate,
          annual_salary: draft.annual_salary !== undefined ? draft.annual_salary : emp.annual_salary,
          pay_rate_type: draft.pay_rate_type || emp.pay_rate_type,
          employment_type: draft.employment_type || emp.employment_type,
          pay_period: draft.pay_period || emp.pay_period,
          overtime_rate_multiplier: draft.overtime_rate_multiplier !== undefined ? draft.overtime_rate_multiplier : emp.overtime_rate_multiplier,
          hr_notes: draft.hr_notes !== undefined ? draft.hr_notes : emp.hr_notes,
        })
        .eq('id', emp.user_id);
      if (error) throw error;
      setEmployees(prev => prev.map(e => e.user_id === emp.user_id ? { ...e, ...draft } : e));
      setDrafts(prev => { const n = { ...prev }; delete n[emp.user_id]; return n; });
      setSaved(emp.user_id);
      setTimeout(() => setSaved(null), 2000);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save');
    } finally {
      setSaving(null);
    }
  };

  // ─── Invite Actions ─────────────────────────────────────────────────────────

  const getInviteLink = () => {
    const base = Platform.OS === 'web' && typeof window !== 'undefined'
      ? `${window.location.origin}/invite`
      : 'https://getbizzy.io/invite';
    return `${base}?code=${joinCode}`;
  };

  const handleCopyCode = async () => {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(joinCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    }
  };

  const handleShareLink = async () => {
    const link = getInviteLink();
    const orgName = currentOrganization?.name || 'our team';
    const message = `Join ${orgName} on Bizzy!\n\n${link}`;
    if (Platform.OS === 'web') {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(link);
        Alert.alert('Copied!', 'Invite link copied to clipboard.');
      }
    } else {
      try { await Share.share({ message, url: link }); } catch { /* dismissed */ }
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
      await fetchFunction('send-tenant-email', {
        method: 'POST',
        body: {
          to: inviteEmail.trim(),
          subject: `You're invited to join ${orgData?.name || 'our team'} on Bizzy`,
          html: `
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
              <h2 style="font-size: 22px; font-weight: 700; color: #111;">You're invited!</h2>
              <p style="color: #555; font-size: 15px; line-height: 1.6;">
                You've been invited to join <strong>${orgData?.name || 'our organization'}</strong> on <strong>Bizzy</strong>.
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
            </div>
          `,
        },
      });
      setInviteSent(true);
      setInviteEmail('');
      setTimeout(() => { setInviteSent(false); setShowInviteForm(false); }, 3000);
    } catch {
      Alert.alert('Error', 'Failed to send invite. Please try again.');
    } finally {
      setSendingInvite(false);
    }
  };

  // ─── Access Guard ───────────────────────────────────────────────────────────

  if (!isAdminOrManager) {
    return (
      <SafeAreaView style={[s.root, { backgroundColor: colors.background }]}>
        <View style={s.lockedContainer}>
          <Lock size={48} color={colors.textSecondary} />
          <Text style={[s.lockedTitle, { color: colors.text }]}>Access Restricted</Text>
          <Text style={[s.lockedSub, { color: colors.textSecondary }]}>
            HR management is only available to admins, managers, and owners.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Computed values ────────────────────────────────────────────────────────

  const totalPayroll = Object.values(hoursData).reduce((s, h) => s + h.est_pay, 0);
  const totalHours = Object.values(hoursData).reduce((s, h) => s + h.total_hours, 0);
  const totalOT = Object.values(hoursData).reduce((s, h) => s + h.overtime_hours, 0);

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={[s.root, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <LinearGradient
        colors={isDark ? [colors.primary + 'cc', colors.primary + '88'] : [colors.primary, colors.primary + 'dd']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.header}
      >
        <View style={s.headerContent}>
          <Users size={22} color="#fff" />
          <View>
            <Text style={s.headerTitle}>HR Hub</Text>
            <Text style={s.headerSub}>{currentOrganization?.name || 'Your Organization'}</Text>
          </View>
        </View>
        <View style={s.headerBadge}>
          <Text style={s.headerBadgeText}>{members.length} {members.length === 1 ? 'employee' : 'employees'}</Text>
        </View>
      </LinearGradient>

      {/* Segmented Tab Bar */}
      <View style={[s.tabBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab}
            style={[s.tabItem, activeTab === tab && [s.tabItemActive, { borderBottomColor: colors.primary }]]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[s.tabText, { color: activeTab === tab ? colors.primary : colors.textSecondary }]}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={s.body}
        contentContainerStyle={s.bodyContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        keyboardShouldPersistTaps="handled"
      >
        {activeTab === 'Team' && <TeamSection />}
        {activeTab === 'HR & Pay' && <HRPaySection />}
        {activeTab === 'Invite' && <InviteSection />}
      </ScrollView>

      <OrganizationalDefaultsModal
        visible={orgDefaultsVisible}
        onClose={() => setOrgDefaultsVisible(false)}
      />
    </SafeAreaView>
  );

  // ─── Team Section ────────────────────────────────────────────────────────────

  function TeamSection() {
    if (teamLoading) {
      return <ActivityIndicator color={colors.primary} style={{ marginTop: 48 }} />;
    }

    return (
      <View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <Text style={[s.sectionLabel, { color: colors.textSecondary, marginBottom: 0 }]}>TEAM MEMBERS ({members.filter(m => m.is_active).length})</Text>
          {members.some(m => !m.is_active) && (
            <TouchableOpacity onPress={() => setShowInactive(!showInactive)} style={{ paddingHorizontal: 8, paddingVertical: 4 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.primary }}>
                {showInactive ? 'Hide Inactive' : `Show Inactive (${members.filter(m => !m.is_active).length})`}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {isAdminOrOwner && (
          <TouchableOpacity
            style={[s.orgDefaultsBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => setOrgDefaultsVisible(true)}
          >
            <Settings size={18} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[s.orgDefaultsBtnTitle, { color: colors.text }]}>Organizational Defaults</Text>
              <Text style={[s.orgDefaultsBtnSub, { color: colors.textSecondary }]}>Configure default layout for new team members</Text>
            </View>
            <ChevronRight size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
        {members.filter(m => showInactive ? true : m.is_active).map(member => {
          const isExpanded = expandedMemberId === member.user_id;
          const isCurrentUser = member.user_id === user?.id;
          const roleColor = ROLE_COLORS[member.role] || colors.textSecondary;
          const isInactive = !member.is_active;

          return (
            <View key={member.id} style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <TouchableOpacity
                style={s.cardRow}
                onPress={() => setExpandedMemberId(isExpanded ? null : member.user_id)}
                activeOpacity={0.7}
              >
                <View style={[s.avatar, { backgroundColor: roleColor + '20' }]}>
                  <Text style={[s.avatarText, { color: roleColor }]}>{getInitials(member.display_name)}</Text>
                </View>
                <View style={s.cardInfo}>
                  <View style={s.nameRow}>
                    <Text style={[s.cardName, { color: isInactive ? colors.textSecondary : colors.text }]}>{member.display_name}</Text>
                    {isInactive && (
                      <View style={{ paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, backgroundColor: colors.textSecondary + '20', marginLeft: 4 }}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textSecondary }}>INACTIVE</Text>
                      </View>
                    )}
                    {isCurrentUser && (
                      <View style={[s.youBadge, { backgroundColor: colors.primary + '18' }]}>
                        <Text style={[s.youBadgeText, { color: colors.primary }]}>You</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[s.cardSub, { color: colors.textSecondary }]}>{member.email}</Text>
                </View>
                <View style={s.roleChip}>
                  <View style={[s.rolePill, { backgroundColor: roleColor + '18' }]}>
                    <Text style={[s.rolePillText, { color: roleColor }]}>{ROLE_LABELS[member.role]}</Text>
                  </View>
                  <ChevronDown
                    size={15}
                    color={colors.textSecondary}
                    style={{ transform: [{ rotate: isExpanded ? '180deg' : '0deg' }] }}
                  />
                </View>
              </TouchableOpacity>

              {isExpanded && (
                <View style={[s.expandedPanel, { borderTopColor: colors.border }]}>
                  <Text style={[s.expandedLabel, { color: colors.textSecondary }]}>
                    {ROLE_DESCRIPTIONS[member.role]}
                  </Text>

                  {isAdminOrOwner && (
                    <>
                      <Text style={[s.fieldLabel, { color: colors.textSecondary, marginBottom: 8 }]}>Change Role</Text>
                      <View style={s.roleOptions}>
                        {updatingRole === member.id ? (
                          <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                          (['admin', 'manager', 'member'] as RoleType[]).map(role => (
                            <TouchableOpacity
                              key={role}
                              style={[
                                s.roleOption,
                                { borderColor: colors.border, backgroundColor: colors.background },
                                member.role === role && { borderColor: ROLE_COLORS[role], backgroundColor: ROLE_COLORS[role] + '12' },
                              ]}
                              onPress={() => handleRoleChange(member, role)}
                            >
                              <Text style={[s.roleOptionText, { color: member.role === role ? ROLE_COLORS[role] : colors.textSecondary }]}>
                                {ROLE_LABELS[role]}
                              </Text>
                            </TouchableOpacity>
                          ))
                        )}
                      </View>
                    </>
                  )}

                  {isAdminOrOwner && !isCurrentUser && member.role !== 'owner' && (
                    <>
                      <TouchableOpacity
                        style={[s.removeBtn, { borderColor: (member.is_active ? colors.textSecondary : colors.primary) + '40', marginBottom: 8 }]}
                        onPress={() => toggleActive(member)}
                        disabled={togglingActiveId === member.user_id}
                      >
                        {togglingActiveId === member.user_id ? (
                          <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                          <>
                            {member.is_active ? <UserCog size={15} color={colors.textSecondary} /> : <User size={15} color={colors.primary} />}
                            <Text style={[s.removeBtnText, { color: member.is_active ? colors.textSecondary : colors.primary }]}>
                              {member.is_active ? 'Set Inactive (On Break)' : 'Reactivate Employee'}
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[s.removeBtn, { borderColor: colors.error + '40' }]}
                        onPress={() => confirmRemove(member)}
                        disabled={removingId === member.user_id}
                      >
                        {removingId === member.user_id ? (
                          <ActivityIndicator size="small" color={colors.error} />
                        ) : (
                          <>
                            <Trash2 size={15} color={colors.error} />
                            <Text style={[s.removeBtnText, { color: colors.error }]}>Remove from Organization</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              )}
            </View>
          );
        })}
        <View style={{ height: 32 }} />
      </View>
    );
  }

  // ─── HR & Pay Section ────────────────────────────────────────────────────────

  function HRPaySection() {
    if (hrLoading) {
      return <ActivityIndicator color={colors.primary} style={{ marginTop: 48 }} />;
    }

    return (
      <View>
        {/* Weekly summary strip */}
        <View style={s.summaryRow}>
          <View style={[s.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <DollarSign size={16} color={colors.primary} />
            <Text style={[s.summaryValue, { color: colors.text }]}>{formatCurrency(totalPayroll)}</Text>
            <Text style={[s.summaryLabel, { color: colors.textSecondary }]}>Est. This Week</Text>
          </View>
          <View style={[s.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Clock size={16} color="#d97706" />
            <Text style={[s.summaryValue, { color: colors.text }]}>{formatHM(totalHours)}</Text>
            <Text style={[s.summaryLabel, { color: colors.textSecondary }]}>Total Hours</Text>
          </View>
          <View style={[s.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TrendingUp size={16} color={totalOT > 0 ? colors.error : colors.textSecondary} />
            <Text style={[s.summaryValue, { color: totalOT > 0 ? colors.error : colors.text }]}>{formatHM(totalOT)}</Text>
            <Text style={[s.summaryLabel, { color: colors.textSecondary }]}>Overtime</Text>
          </View>
        </View>

        <Text style={[s.sectionLabel, { color: colors.textSecondary }]}>EMPLOYEE PAY DETAILS</Text>

        {employees.map(emp => {
          const eff = getEffective(emp);
          const h = hoursData[emp.user_id];
          const isDirty = Object.keys(getDraft(emp.user_id)).length > 0;
          const isExpanded = expandedHrId === emp.user_id;
          const roleColor = ROLE_COLORS[emp.role] || colors.textSecondary;

          return (
            <View key={emp.user_id} style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <TouchableOpacity
                style={s.cardRow}
                onPress={() => setExpandedHrId(isExpanded ? null : emp.user_id)}
                activeOpacity={0.7}
              >
                <View style={[s.avatar, { backgroundColor: roleColor + '20' }]}>
                  <Text style={[s.avatarText, { color: roleColor }]}>{getInitials(eff.display_name)}</Text>
                </View>
                <View style={s.cardInfo}>
                  <View style={s.nameRow}>
                    <Text style={[s.cardName, { color: colors.text }]}>{eff.display_name}</Text>
                    <View style={[s.rolePill, { backgroundColor: roleColor + '18' }]}>
                      <Text style={[s.rolePillText, { color: roleColor }]}>{emp.role.charAt(0).toUpperCase() + emp.role.slice(1)}</Text>
                    </View>
                    {isDirty && <View style={s.dirtyDot} />}
                  </View>
                  <Text style={[s.cardSub, { color: colors.textSecondary }]}>{eff.email}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 2 }}>
                  {h ? (
                    <>
                      <Text style={[s.hoursVal, { color: colors.text }]}>{formatHM(h.total_hours)}</Text>
                      {h.est_pay > 0 && <Text style={[s.payVal, { color: colors.primary }]}>{formatCurrency(h.est_pay)}</Text>}
                    </>
                  ) : (
                    <Text style={[s.noHours, { color: colors.textSecondary }]}>No hours</Text>
                  )}
                  <ChevronDown
                    size={14}
                    color={colors.textSecondary}
                    style={{ transform: [{ rotate: isExpanded ? '180deg' : '0deg' }], marginTop: 2 }}
                  />
                </View>
              </TouchableOpacity>

              {isExpanded && (
                <View style={[s.expandedPanel, { borderTopColor: colors.border }]}>
                  {/* Hours breakdown */}
                  {h && (
                    <View style={[s.hoursBreakdown, { backgroundColor: colors.background, borderColor: colors.border }]}>
                      {[
                        { label: 'Regular', val: formatHM(h.regular_hours), color: colors.text },
                        { label: 'Overtime', val: formatHM(h.overtime_hours), color: h.overtime_hours > 0 ? colors.error : colors.text },
                        { label: 'Est. Pay', val: h.est_pay > 0 ? formatCurrency(h.est_pay) : '—', color: colors.primary },
                      ].map((item, i) => (
                        <View key={item.label} style={[s.hbItem, i > 0 && { borderLeftWidth: 1, borderLeftColor: colors.border }]}>
                          <Text style={[s.hbLabel, { color: colors.textSecondary }]}>{item.label}</Text>
                          <Text style={[s.hbVal, { color: item.color }]}>{item.val}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Pay type */}
                  <View style={s.fieldRow}>
                    <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>Pay Type</Text>
                    <View style={s.segRow}>
                      {PAY_RATE_TYPES.map(opt => (
                        <TouchableOpacity
                          key={opt.value}
                          style={[s.segBtn, { borderColor: colors.border, backgroundColor: colors.background }, eff.pay_rate_type === opt.value && { borderColor: colors.primary, backgroundColor: colors.primary + '15' }]}
                          onPress={() => setDraft(emp.user_id, { pay_rate_type: opt.value })}
                        >
                          <Text style={[s.segBtnText, { color: eff.pay_rate_type === opt.value ? colors.primary : colors.textSecondary }]}>{opt.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Rate input */}
                  {eff.pay_rate_type === 'hourly' ? (
                    <View style={s.fieldRow}>
                      <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>Hourly Rate</Text>
                      <View style={[s.rateInputWrap, { borderColor: colors.border, backgroundColor: colors.background }]}>
                        <Text style={[s.currencySymbol, { color: colors.textSecondary }]}>$</Text>
                        <TextInput
                          style={[s.rateInput, { color: colors.text }]}
                          value={eff.hourly_rate != null ? String(eff.hourly_rate) : ''}
                          onChangeText={v => setDraft(emp.user_id, { hourly_rate: v === '' ? null : parseFloat(v) || 0 })}
                          keyboardType="decimal-pad"
                          placeholder="0.00"
                          placeholderTextColor={colors.textSecondary}
                        />
                        <Text style={[s.rateUnit, { color: colors.textSecondary }]}>/hr</Text>
                      </View>
                    </View>
                  ) : (
                    <View style={s.fieldRow}>
                      <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>Annual Salary</Text>
                      <View style={[s.rateInputWrap, { borderColor: colors.border, backgroundColor: colors.background }]}>
                        <Text style={[s.currencySymbol, { color: colors.textSecondary }]}>$</Text>
                        <TextInput
                          style={[s.rateInput, { color: colors.text }]}
                          value={eff.annual_salary != null ? String(eff.annual_salary) : ''}
                          onChangeText={v => setDraft(emp.user_id, { annual_salary: v === '' ? null : parseFloat(v) || 0 })}
                          keyboardType="decimal-pad"
                          placeholder="0.00"
                          placeholderTextColor={colors.textSecondary}
                        />
                        <Text style={[s.rateUnit, { color: colors.textSecondary }]}>/yr</Text>
                      </View>
                    </View>
                  )}

                  {/* OT multiplier */}
                  {eff.pay_rate_type === 'hourly' && (
                    <View style={s.fieldRow}>
                      <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>OT Rate</Text>
                      <View style={s.segRow}>
                        {OT_MULTIPLIERS.map(opt => (
                          <TouchableOpacity
                            key={opt.value}
                            style={[s.segBtn, { borderColor: colors.border, backgroundColor: colors.background }, String(eff.overtime_rate_multiplier) === opt.value && { borderColor: colors.primary, backgroundColor: colors.primary + '15' }]}
                            onPress={() => setDraft(emp.user_id, { overtime_rate_multiplier: parseFloat(opt.value) })}
                          >
                            <Text style={[s.segBtnText, { color: String(eff.overtime_rate_multiplier) === opt.value ? colors.primary : colors.textSecondary }]}>{opt.label}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* Employment type */}
                  <View style={s.fieldRow}>
                    <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>Employment</Text>
                    <View style={s.segRow}>
                      {EMPLOYMENT_TYPES.map(opt => (
                        <TouchableOpacity
                          key={opt.value}
                          style={[s.segBtn, { borderColor: colors.border, backgroundColor: colors.background }, eff.employment_type === opt.value && { borderColor: colors.primary, backgroundColor: colors.primary + '15' }]}
                          onPress={() => setDraft(emp.user_id, { employment_type: opt.value })}
                        >
                          <Text style={[s.segBtnText, { color: eff.employment_type === opt.value ? colors.primary : colors.textSecondary }]}>{opt.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Pay period */}
                  <View style={s.fieldRow}>
                    <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>Pay Period</Text>
                    <View style={s.segRow}>
                      {PAY_PERIODS.map(opt => (
                        <TouchableOpacity
                          key={opt.value}
                          style={[s.segBtn, { borderColor: colors.border, backgroundColor: colors.background }, eff.pay_period === opt.value && { borderColor: colors.primary, backgroundColor: colors.primary + '15' }]}
                          onPress={() => setDraft(emp.user_id, { pay_period: opt.value })}
                        >
                          <Text style={[s.segBtnText, { color: eff.pay_period === opt.value ? colors.primary : colors.textSecondary }]}>{opt.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* HR Notes */}
                  <View style={[s.fieldRow, { alignItems: 'flex-start' }]}>
                    <Text style={[s.fieldLabel, { color: colors.textSecondary, marginTop: 10 }]}>Notes</Text>
                    <TextInput
                      style={[s.notesInput, { borderColor: colors.border, backgroundColor: colors.background, color: colors.text }]}
                      value={eff.hr_notes}
                      onChangeText={v => setDraft(emp.user_id, { hr_notes: v })}
                      placeholder="Private admin notes..."
                      placeholderTextColor={colors.textSecondary}
                      multiline
                      numberOfLines={3}
                    />
                  </View>

                  {/* Save */}
                  <TouchableOpacity
                    style={[s.saveBtn, !isDirty && s.saveBtnDisabled]}
                    onPress={() => handleSave(emp)}
                    disabled={!isDirty || saving === emp.user_id}
                  >
                    {saving === emp.user_id ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : saved === emp.user_id ? (
                      <><CheckCircle size={16} color="#fff" /><Text style={s.saveBtnText}>Saved</Text></>
                    ) : (
                      <><Save size={16} color="#fff" /><Text style={s.saveBtnText}>Save Changes</Text></>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}
        <View style={{ height: 32 }} />
      </View>
    );
  }

  // ─── Invite Section ──────────────────────────────────────────────────────────

  function InviteSection() {
    return (
      <View>
        {joinCode ? (
          <View style={[s.inviteCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[s.inviteCardTitle, { color: colors.text }]}>Organization Join Code</Text>
            <Text style={[s.inviteCardSub, { color: colors.textSecondary }]}>
              Share this code with team members so they can join your organization during sign up.
            </Text>

            <View style={[s.codeBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Text style={[s.codeText, { color: colors.text }]}>{joinCode}</Text>
              <TouchableOpacity onPress={handleCopyCode} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                {codeCopied
                  ? <CheckCircle size={20} color="#16a34a" />
                  : <Copy size={20} color={colors.primary} />
                }
              </TouchableOpacity>
            </View>
            {codeCopied && <Text style={[s.copiedText, { color: '#16a34a' }]}>Copied to clipboard!</Text>}

            <View style={s.inviteActions}>
              <TouchableOpacity
                style={[s.inviteActionBtn, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '30' }]}
                onPress={handleShareLink}
              >
                <Link size={16} color={colors.primary} />
                <Text style={[s.inviteActionText, { color: colors.primary }]}>Share Invite Link</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.inviteActionBtn, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '25' }]}
                onPress={() => setShowInviteForm(v => !v)}
              >
                <UserPlus size={16} color={colors.primary} />
                <Text style={[s.inviteActionText, { color: colors.primary }]}>Invite by Email</Text>
              </TouchableOpacity>
            </View>

            {showInviteForm && (
              <View style={[s.emailForm, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Text style={[s.emailFormTitle, { color: colors.text }]}>Invite team member by email</Text>
                <Text style={[s.emailFormSub, { color: colors.textSecondary }]}>
                  They'll receive an email with the join code and download instructions.
                </Text>
                <TextInput
                  style={[s.emailInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
                  value={inviteEmail}
                  onChangeText={setInviteEmail}
                  placeholder="employee@email.com"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <View style={s.emailFormActions}>
                  <TouchableOpacity
                    style={s.sendBtnWrap}
                    onPress={handleSendInvite}
                    disabled={sendingInvite || !inviteEmail.trim()}
                  >
                    <LinearGradient
                      colors={inviteSent ? ['#2D8B57', '#34a065'] : ['#1B4D6E', '#245d82']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={s.sendBtn}
                    >
                      {sendingInvite ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : inviteSent ? (
                        <><CheckCircle size={16} color="#fff" /><Text style={s.sendBtnText}>Sent!</Text></>
                      ) : (
                        <><Send size={16} color="#fff" /><Text style={s.sendBtnText}>Send Invite</Text></>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.cancelBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    onPress={() => { setShowInviteForm(false); setInviteEmail(''); }}
                  >
                    <Text style={[s.cancelBtnText, { color: colors.textSecondary }]}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        ) : (
          <View style={s.noCodeContainer}>
            <Text style={[s.noCodeText, { color: colors.textSecondary }]}>
              No join code available. Contact the organization owner.
            </Text>
          </View>
        )}
        <View style={{ height: 32 }} />
      </View>
    );
  }
}

// ─── Styles ───────────────────────────────────────────────────────────────────


