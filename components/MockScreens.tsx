import { View, Text, StyleSheet } from 'react-native';
import { Calendar, Clock, Users, DollarSign, FileText, CircleCheck as CheckCircle, Circle, MapPin, Phone, Mail, TrendingUp, TrendingDown, ChevronRight, MoveHorizontal as MoreHorizontal, Bell, Settings, Plus } from 'lucide-react-native';

const BG = '#0a1118';
const SURFACE = '#141e28';
const CARD = '#1c2a36';
const BORDER = '#253342';
const TEXT = '#e8edf2';
const TEXT2 = '#8899a8';
const PRIMARY = '#3a9ad9';
const SUCCESS = '#3dba6f';
const WARNING = '#f0a030';
const ERROR = '#e05252';
const GREEN_BG = 'rgba(61,186,111,0.12)';
const ORANGE_BG = 'rgba(240,160,48,0.12)';
const RED_BG = 'rgba(224,82,82,0.12)';
const PRIMARY_BG = 'rgba(58,154,217,0.12)';

function StatusBar() {
  return (
    <View style={s.statusBar}>
      <Text style={s.statusTime}>9:41</Text>
      <View style={s.statusRight}>
        <View style={s.signalDots}>
          {[1,2,3,4].map(i => (
            <View key={i} style={[s.signalBar, { height: 4 + i * 2, opacity: i <= 3 ? 1 : 0.3 }]} />
          ))}
        </View>
        <View style={s.batteryOuter}>
          <View style={s.batteryInner} />
        </View>
      </View>
    </View>
  );
}

function TabBar({ active }: { active: 'home' | 'schedule' | 'clients' | 'invoices' | 'finances' | 'time' }) {
  const tabs = [
    { key: 'home', icon: TrendingUp, label: 'Home' },
    { key: 'schedule', icon: Calendar, label: 'Schedule' },
    { key: 'clients', icon: Users, label: 'Clients' },
    { key: 'invoices', icon: FileText, label: 'Invoices' },
    { key: 'time', icon: Clock, label: 'Time' },
  ] as const;
  return (
    <View style={s.tabBar}>
      {tabs.map(tab => {
        const isActive = tab.key === active;
        const Icon = tab.icon;
        return (
          <View key={tab.key} style={s.tabItem}>
            <Icon size={16} color={isActive ? PRIMARY : TEXT2} strokeWidth={isActive ? 2.5 : 1.8} />
            <Text style={[s.tabLabel, { color: isActive ? PRIMARY : TEXT2 }]}>{tab.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

export function DashboardScreen() {
  return (
    <View style={s.screen}>
      <StatusBar />
      <View style={s.screenHeader}>
        <View>
          <Text style={s.greeting}>GOOD MORNING</Text>
          <Text style={s.welcomeName}>Alex Johnson</Text>
        </View>
        <View style={[s.iconBtn, { backgroundColor: CARD }]}>
          <Bell size={14} color={TEXT2} />
        </View>
      </View>

      <View style={s.statsGrid}>
        {[
          { label: "Today's Jobs", value: '4', color: PRIMARY },
          { label: "Revenue", value: '$1,840', color: SUCCESS },
          { label: 'Clients', value: '38', color: WARNING },
          { label: 'Hours', value: '6.5', color: '#a78bfa' },
        ].map((stat, i) => (
          <View key={i} style={[s.statCard, { backgroundColor: CARD }]}>
            <Text style={[s.statValue, { color: stat.color }]}>{stat.value}</Text>
            <Text style={s.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>

      <Text style={s.sectionHeading}>Today's Jobs</Text>
      <View style={s.list}>
        {[
          { name: 'Johnson Residence', job: 'Window Cleaning', time: '8:00 AM', status: 'done' },
          { name: 'Martinez Family', job: 'Gutter Cleaning', time: '10:30 AM', status: 'active' },
          { name: 'Smith Property', job: 'Pressure Wash', time: '1:00 PM', status: 'pending' },
        ].map((item, i) => (
          <View key={i} style={[s.jobRow, { backgroundColor: CARD }]}>
            <View style={[s.jobDot, {
              backgroundColor: item.status === 'done' ? SUCCESS : item.status === 'active' ? PRIMARY : BORDER,
            }]} />
            <View style={{ flex: 1 }}>
              <Text style={s.jobName}>{item.name}</Text>
              <Text style={s.jobType}>{item.job}</Text>
            </View>
            <Text style={s.jobTime}>{item.time}</Text>
          </View>
        ))}
      </View>
      <TabBar active="home" />
    </View>
  );
}

export function ScheduleScreen() {
  const days = ['S','M','T','W','T','F','S'];
  const dates = [16,17,18,19,20,21,22];
  return (
    <View style={s.screen}>
      <StatusBar />
      <View style={s.screenHeader}>
        <Text style={s.screenTitle}>Schedule</Text>
        <View style={[s.iconBtn, { backgroundColor: CARD }]}>
          <Plus size={14} color={PRIMARY} />
        </View>
      </View>

      <View style={[s.calendarStrip, { backgroundColor: CARD }]}>
        {days.map((d, i) => (
          <View key={i} style={[s.dayCol, dates[i] === 20 && s.dayColActive]}>
            <Text style={[s.dayLetter, { color: dates[i] === 20 ? PRIMARY : TEXT2 }]}>{d}</Text>
            <View style={[s.dateCircle, dates[i] === 20 && { backgroundColor: PRIMARY }]}>
              <Text style={[s.dateNum, { color: dates[i] === 20 ? '#fff' : TEXT }]}>{dates[i]}</Text>
            </View>
          </View>
        ))}
      </View>

      <Text style={s.dateLabel}>Thursday, Mar 20</Text>

      <View style={s.list}>
        {[
          { time: '8:00 AM', name: 'Johnson Residence', job: 'Window Cleaning', status: 'Completed', statusColor: SUCCESS, statusBg: GREEN_BG },
          { time: '10:30 AM', name: 'Martinez Family', job: 'Gutter Cleaning', status: 'In Progress', statusColor: PRIMARY, statusBg: PRIMARY_BG },
          { time: '1:00 PM', name: 'Smith Property', job: 'Pressure Wash', status: 'Upcoming', statusColor: TEXT2, statusBg: BORDER },
          { time: '3:30 PM', name: 'Green Valley HOA', job: 'Commercial Windows', status: 'Upcoming', statusColor: TEXT2, statusBg: BORDER },
        ].map((evt, i) => (
          <View key={i} style={[s.scheduleCard, { backgroundColor: CARD }]}>
            <View style={[s.timeStripe, { backgroundColor: evt.statusColor }]} />
            <View style={{ flex: 1, paddingLeft: 8 }}>
              <View style={s.scheduleCardHeader}>
                <Text style={s.scheduleTime}>{evt.time}</Text>
                <View style={[s.badge, { backgroundColor: evt.statusBg }]}>
                  <Text style={[s.badgeText, { color: evt.statusColor }]}>{evt.status}</Text>
                </View>
              </View>
              <Text style={s.scheduleClientName}>{evt.name}</Text>
              <Text style={s.scheduleJobType}>{evt.job}</Text>
            </View>
          </View>
        ))}
      </View>
      <TabBar active="schedule" />
    </View>
  );
}

export function ClientsScreen() {
  return (
    <View style={s.screen}>
      <StatusBar />
      <View style={s.screenHeader}>
        <Text style={s.screenTitle}>Clients</Text>
        <View style={[s.iconBtn, { backgroundColor: CARD }]}>
          <Plus size={14} color={PRIMARY} />
        </View>
      </View>

      <View style={[s.searchBar, { backgroundColor: CARD }]}>
        <Text style={s.searchPlaceholder}>Search clients...</Text>
      </View>

      <View style={s.list}>
        {[
          { name: 'Sarah Mitchell', phone: '(555) 204-8812', tag: 'Window Cleaning', tagColor: PRIMARY },
          { name: 'Tom & Linda Garcia', phone: '(555) 371-0044', tag: 'Lawn Care', tagColor: SUCCESS },
          { name: 'Robert Nguyen', phone: '(555) 480-2291', tag: 'Gutter Cleaning', tagColor: WARNING },
          { name: 'Jennifer & Mark Davis', phone: '(555) 619-5530', tag: 'Pressure Wash', tagColor: '#e05252' },
          { name: 'Green Valley HOA', phone: '(555) 722-9981', tag: 'Commercial', tagColor: '#a78bfa' },
        ].map((client, i) => (
          <View key={i} style={[s.clientCard, { backgroundColor: CARD }]}>
            <View style={[s.avatar, { backgroundColor: PRIMARY_BG }]}>
              <Text style={s.avatarText}>{client.name[0]}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.clientName}>{client.name}</Text>
              <View style={s.clientRow}>
                <Phone size={10} color={TEXT2} />
                <Text style={s.clientMeta}>{client.phone}</Text>
              </View>
              <View style={[s.tagPill, { backgroundColor: client.tagColor + '22' }]}>
                <Text style={[s.tagText, { color: client.tagColor }]}>{client.tag}</Text>
              </View>
            </View>
            <ChevronRight size={14} color={BORDER} />
          </View>
        ))}
      </View>
      <TabBar active="clients" />
    </View>
  );
}

export function InvoicesScreen() {
  return (
    <View style={s.screen}>
      <StatusBar />
      <View style={s.screenHeader}>
        <Text style={s.screenTitle}>Invoices</Text>
        <View style={[s.iconBtn, { backgroundColor: CARD }]}>
          <Plus size={14} color={PRIMARY} />
        </View>
      </View>

      <View style={s.list}>
        {[
          { num: 'INV-1043', client: 'Johnson Residence', amount: '$320.00', status: 'Paid', statusColor: SUCCESS, statusBg: GREEN_BG, date: 'Mar 20' },
          { num: 'INV-1042', client: 'Martinez Family', amount: '$185.00', status: 'Overdue', statusColor: ERROR, statusBg: RED_BG, date: 'Mar 15' },
          { num: 'INV-1041', client: 'Smith Property', amount: '$475.00', status: 'Pending', statusColor: WARNING, statusBg: ORANGE_BG, date: 'Mar 22' },
          { num: 'INV-1040', client: 'Robert Nguyen', amount: '$240.00', status: 'Paid', statusColor: SUCCESS, statusBg: GREEN_BG, date: 'Mar 18' },
          { num: 'INV-1039', client: 'Green Valley HOA', amount: '$1,200.00', status: 'Paid', statusColor: SUCCESS, statusBg: GREEN_BG, date: 'Mar 12' },
        ].map((inv, i) => (
          <View key={i} style={[s.invoiceCard, { backgroundColor: CARD }]}>
            <View style={s.invoiceTop}>
              <View>
                <Text style={s.invoiceNum}>{inv.num}</Text>
                <Text style={s.invoiceClient}>{inv.client}</Text>
              </View>
              <View style={[s.badge, { backgroundColor: inv.statusBg }]}>
                <Text style={[s.badgeText, { color: inv.statusColor }]}>{inv.status}</Text>
              </View>
            </View>
            <View style={[s.invoiceDivider, { backgroundColor: BORDER }]} />
            <View style={s.invoiceBottom}>
              <Text style={s.invoiceDate}>Due {inv.date}</Text>
              <Text style={[s.invoiceAmount, { color: inv.status === 'Overdue' ? ERROR : TEXT }]}>{inv.amount}</Text>
            </View>
          </View>
        ))}
      </View>
      <TabBar active="invoices" />
    </View>
  );
}

export function FinancesScreen() {
  return (
    <View style={s.screen}>
      <StatusBar />
      <View style={s.screenHeader}>
        <Text style={s.screenTitle}>Finances</Text>
        <Text style={s.screenSubtitle}>March 2026</Text>
      </View>

      <View style={s.financeRow}>
        <View style={[s.financeCard, { backgroundColor: CARD }]}>
          <TrendingUp size={14} color={SUCCESS} />
          <Text style={s.financeLabel}>Income</Text>
          <Text style={[s.financeValue, { color: SUCCESS }]}>$4,820</Text>
        </View>
        <View style={[s.financeCard, { backgroundColor: CARD }]}>
          <TrendingDown size={14} color={ERROR} />
          <Text style={s.financeLabel}>Expenses</Text>
          <Text style={[s.financeValue, { color: ERROR }]}>$1,230</Text>
        </View>
        <View style={[s.financeCard, { backgroundColor: CARD }]}>
          <DollarSign size={14} color={PRIMARY} />
          <Text style={s.financeLabel}>Profit</Text>
          <Text style={[s.financeValue, { color: PRIMARY }]}>$3,590</Text>
        </View>
      </View>

      <Text style={s.sectionHeading}>Transactions</Text>
      <View style={s.list}>
        {[
          { desc: 'Johnson Residence', cat: 'Window Cleaning', amount: '+$320', color: SUCCESS, icon: TrendingUp, date: 'Mar 20' },
          { desc: 'Green Valley HOA', cat: 'Commercial', amount: '+$1,200', color: SUCCESS, icon: TrendingUp, date: 'Mar 19' },
          { desc: 'Fuel - Work Truck', cat: 'Vehicle', amount: '-$87', color: ERROR, icon: TrendingDown, date: 'Mar 18' },
          { desc: 'Robert Nguyen', cat: 'Gutter Cleaning', amount: '+$240', color: SUCCESS, icon: TrendingUp, date: 'Mar 18' },
          { desc: 'Cleaning Supplies', cat: 'Materials', amount: '-$143', color: ERROR, icon: TrendingDown, date: 'Mar 17' },
        ].map((tx, i) => {
          const Icon = tx.icon;
          return (
            <View key={i} style={[s.txRow, { backgroundColor: CARD }]}>
              <View style={[s.txIcon, { backgroundColor: tx.color + '1a' }]}>
                <Icon size={12} color={tx.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.txDesc}>{tx.desc}</Text>
                <Text style={s.txCat}>{tx.cat} · {tx.date}</Text>
              </View>
              <Text style={[s.txAmount, { color: tx.color }]}>{tx.amount}</Text>
            </View>
          );
        })}
      </View>
      <TabBar active="finances" />
    </View>
  );
}

export function TimeClockScreen() {
  return (
    <View style={s.screen}>
      <StatusBar />
      <View style={s.screenHeader}>
        <Text style={s.screenTitle}>Time Clock</Text>
        <Text style={s.screenSubtitle}>Mar 20, 2026</Text>
      </View>

      <View style={[s.clockCard, { backgroundColor: CARD }]}>
        <View style={[s.clockBadge, { backgroundColor: PRIMARY_BG }]}>
          <View style={[s.clockDot, { backgroundColor: PRIMARY }]} />
          <Text style={[s.clockStatus, { color: PRIMARY }]}>Clocked In</Text>
        </View>
        <Text style={s.clockTime}>04:22:15</Text>
        <Text style={s.clockSince}>Since 8:00 AM · Martinez Family</Text>
        <View style={[s.clockOutBtn, { backgroundColor: ERROR + '22', borderColor: ERROR }]}>
          <Text style={[s.clockOutText, { color: ERROR }]}>Clock Out</Text>
        </View>
      </View>

      <Text style={s.sectionHeading}>Today's Timesheets</Text>
      <View style={s.list}>
        {[
          { name: 'Alex Johnson', role: 'Admin', time: '4h 22m', status: 'active', color: PRIMARY },
          { name: 'Mike Torres', role: 'Crew Member', time: '4h 10m', status: 'active', color: PRIMARY },
          { name: 'Dana Lee', role: 'Crew Member', time: '3h 55m', status: 'active', color: PRIMARY },
          { name: 'Carlos Reyes', role: 'Crew Member', time: '2h 30m', status: 'break', color: WARNING },
        ].map((member, i) => (
          <View key={i} style={[s.crewRow, { backgroundColor: CARD }]}>
            <View style={[s.avatar, { backgroundColor: member.color + '22' }]}>
              <Text style={[s.avatarText, { color: member.color }]}>{member.name[0]}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.crewName}>{member.name}</Text>
              <Text style={s.crewRole}>{member.role}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[s.crewTime, { color: member.color }]}>{member.time}</Text>
              <Text style={s.crewStatusLabel}>{member.status === 'break' ? 'On Break' : 'Active'}</Text>
            </View>
          </View>
        ))}
      </View>
      <TabBar active="time" />
    </View>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG,
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 3,
  },
  statusTime: {
    color: TEXT,
    fontSize: 9,
    fontWeight: '700',
  },
  statusRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  signalDots: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 1.5,
  },
  signalBar: {
    width: 3,
    backgroundColor: TEXT,
    borderRadius: 1,
  },
  batteryOuter: {
    width: 16,
    height: 8,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: TEXT,
    padding: 1.5,
  },
  batteryInner: {
    flex: 1,
    backgroundColor: SUCCESS,
    borderRadius: 1,
  },
  screenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  screenTitle: {
    color: TEXT,
    fontSize: 14,
    fontWeight: '700',
  },
  screenSubtitle: {
    color: TEXT2,
    fontSize: 9,
  },
  iconBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greeting: {
    color: TEXT2,
    fontSize: 7,
    fontWeight: '600',
    letterSpacing: 1,
  },
  welcomeName: {
    color: PRIMARY,
    fontSize: 13,
    fontWeight: '700',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  statCard: {
    width: '47%',
    borderRadius: 8,
    padding: 8,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  statLabel: {
    color: TEXT2,
    fontSize: 8,
    marginTop: 2,
  },
  sectionHeading: {
    color: TEXT,
    fontSize: 10,
    fontWeight: '600',
    paddingHorizontal: 10,
    marginBottom: 6,
  },
  list: {
    flex: 1,
    paddingHorizontal: 10,
    gap: 5,
    overflow: 'hidden',
  },
  jobRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    borderRadius: 8,
  },
  jobDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  jobName: {
    color: TEXT,
    fontSize: 9,
    fontWeight: '600',
  },
  jobType: {
    color: TEXT2,
    fontSize: 8,
    marginTop: 1,
  },
  jobTime: {
    color: TEXT2,
    fontSize: 8,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: SURFACE,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  tabLabel: {
    fontSize: 7,
    fontWeight: '500',
  },
  calendarStrip: {
    flexDirection: 'row',
    marginHorizontal: 10,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  dayCol: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  dayColActive: {},
  dayLetter: {
    fontSize: 7,
    fontWeight: '600',
  },
  dateCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateNum: {
    fontSize: 8,
    fontWeight: '600',
  },
  dateLabel: {
    color: TEXT2,
    fontSize: 8,
    paddingHorizontal: 10,
    marginBottom: 6,
  },
  scheduleCard: {
    flexDirection: 'row',
    borderRadius: 8,
    overflow: 'hidden',
    padding: 8,
  },
  timeStripe: {
    width: 3,
    borderRadius: 2,
    marginRight: 2,
  },
  scheduleCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  scheduleTime: {
    color: TEXT2,
    fontSize: 8,
    fontWeight: '600',
  },
  scheduleClientName: {
    color: TEXT,
    fontSize: 9,
    fontWeight: '600',
  },
  scheduleJobType: {
    color: TEXT2,
    fontSize: 8,
    marginTop: 1,
  },
  badge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 7,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  searchBar: {
    marginHorizontal: 10,
    marginBottom: 8,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  searchPlaceholder: {
    color: TEXT2,
    fontSize: 9,
  },
  clientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    borderRadius: 8,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: PRIMARY,
    fontSize: 11,
    fontWeight: '700',
  },
  clientName: {
    color: TEXT,
    fontSize: 9,
    fontWeight: '600',
  },
  clientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  clientMeta: {
    color: TEXT2,
    fontSize: 8,
  },
  tagPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 3,
  },
  tagText: {
    fontSize: 7,
    fontWeight: '600',
  },
  invoiceCard: {
    borderRadius: 8,
    padding: 8,
  },
  invoiceTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  invoiceNum: {
    color: TEXT,
    fontSize: 10,
    fontWeight: '700',
  },
  invoiceClient: {
    color: TEXT2,
    fontSize: 8,
    marginTop: 1,
  },
  invoiceDivider: {
    height: 1,
    marginVertical: 6,
  },
  invoiceBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  invoiceDate: {
    color: TEXT2,
    fontSize: 8,
  },
  invoiceAmount: {
    color: TEXT,
    fontSize: 11,
    fontWeight: '700',
  },
  financeRow: {
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  financeCard: {
    flex: 1,
    borderRadius: 8,
    padding: 7,
    alignItems: 'center',
    gap: 2,
  },
  financeLabel: {
    color: TEXT2,
    fontSize: 7,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  financeValue: {
    fontSize: 11,
    fontWeight: '700',
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    borderRadius: 8,
  },
  txIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txDesc: {
    color: TEXT,
    fontSize: 9,
    fontWeight: '600',
  },
  txCat: {
    color: TEXT2,
    fontSize: 8,
    marginTop: 1,
  },
  txAmount: {
    fontSize: 10,
    fontWeight: '700',
  },
  clockCard: {
    marginHorizontal: 10,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  clockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 6,
  },
  clockDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  clockStatus: {
    fontSize: 9,
    fontWeight: '600',
  },
  clockTime: {
    color: TEXT,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 1,
  },
  clockSince: {
    color: TEXT2,
    fontSize: 8,
    marginTop: 2,
    marginBottom: 8,
  },
  clockOutBtn: {
    paddingHorizontal: 20,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  clockOutText: {
    fontSize: 9,
    fontWeight: '700',
  },
  crewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    borderRadius: 8,
  },
  crewName: {
    color: TEXT,
    fontSize: 9,
    fontWeight: '600',
  },
  crewRole: {
    color: TEXT2,
    fontSize: 8,
    marginTop: 1,
  },
  crewTime: {
    fontSize: 10,
    fontWeight: '700',
  },
  crewStatusLabel: {
    color: TEXT2,
    fontSize: 7,
    marginTop: 1,
  },
});
