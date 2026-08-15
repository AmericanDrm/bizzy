export interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: string;
  keywords: string[];
  gifUrl?: string;
  relatedWalkthroughStep?: string;
}

export type FAQCategory =
  | 'getting-started'
  | 'clients'
  | 'jobs'
  | 'schedule'
  | 'invoicing'
  | 'time-tracking'
  | 'settings'
  | 'troubleshooting';

export const FAQ_CATEGORIES: Record<FAQCategory, { title: string; icon: string }> = {
  'getting-started': { title: 'Getting Started', icon: 'Rocket' },
  'clients': { title: 'Managing Clients', icon: 'Users' },
  'jobs': { title: 'Jobs & Checklists', icon: 'Briefcase' },
  'schedule': { title: 'Scheduling', icon: 'Calendar' },
  'invoicing': { title: 'Invoicing & Estimates', icon: 'Receipt' },
  'time-tracking': { title: 'Time Tracking', icon: 'Clock' },
  'settings': { title: 'Settings & Customization', icon: 'Settings' },
  'troubleshooting': { title: 'Troubleshooting', icon: 'HelpCircle' },
};

export const FAQ_DATA: FAQItem[] = [
  // Getting Started
  {
    id: 'what-is-this-app',
    question: 'What is this app for?',
    answer:
      'This is a comprehensive business management tool designed for service professionals. It helps you manage clients, schedule jobs, track time, create invoices and estimates, and organize your business finances all in one place.',
    category: 'getting-started',
    keywords: ['app', 'overview', 'purpose', 'what', 'features'],
    relatedWalkthroughStep: 'welcome',
  },
  {
    id: 'first-steps',
    question: 'What should I do first?',
    answer:
      'Start by adding your first client in the Clients tab, then create job types in the Invoices tab (tap the briefcase icon). After that, you can schedule jobs, track time, and create invoices. You can also customize your layout in Settings to show only the features you need.',
    category: 'getting-started',
    keywords: ['start', 'begin', 'first', 'setup', 'initialize'],
    relatedWalkthroughStep: 'home-overview',
  },
  {
    id: 'where-job-types',
    question: 'Where do I find job types?',
    answer:
      'Job types are found in the Invoices tab. Look for the briefcase icon in the top right corner. Job types let you define your services with rates and units of measure (hourly, per square foot, flat rate, etc.).',
    category: 'getting-started',
    keywords: ['job types', 'services', 'rates', 'briefcase', 'find', 'where'],
    relatedWalkthroughStep: 'job-types',
  },
  {
    id: 'customize-layout',
    question: 'Can I customize what I see?',
    answer:
      'Yes! Go to Settings and tap "Customize Layout". You can hide/show home screen cards, reorder tabs, and customize quick actions. This lets you focus on the features most important to your business.',
    category: 'getting-started',
    keywords: ['customize', 'layout', 'hide', 'show', 'personalize', 'tabs'],
    relatedWalkthroughStep: 'layout-customization',
  },
  {
    id: 'user-roles',
    question: 'What are the different user roles?',
    answer:
      'There are 5 roles: Basic (view only, add items, complete tasks), Crew Lead (create/delete checklists), Manager (full access to jobs and schedules), Admin (team management), and Owner (full control). Roles determine what features each team member can access.',
    category: 'getting-started',
    keywords: ['roles', 'permissions', 'basic', 'manager', 'admin', 'owner', 'crew', 'team'],
  },
  {
    id: 'what-can-basic-users-do',
    question: 'What can Basic users do?',
    answer:
      'Basic users can view all data, add checklist items, check off completed items, and add notes. They cannot create or delete checklists, manage clients, or delete jobs. Perfect for field crew members who need to track their work.',
    category: 'getting-started',
    keywords: ['basic', 'permissions', 'crew', 'limited', 'field'],
  },

  // Clients
  {
    id: 'add-client',
    question: 'How do I add a new client?',
    answer:
      'Go to the Clients tab and tap the + button. Fill in the client\'s name, contact info, and address. You can also set a typical job duration and notification preference for each client.',
    category: 'clients',
    keywords: ['add', 'new', 'client', 'contact', 'create'],
    relatedWalkthroughStep: 'add-client',
  },
  {
    id: 'client-location',
    question: 'Why should I add client addresses?',
    answer:
      'Adding addresses enables location-based features like automatic arrival detection, route optimization, and travel time tracking. The app can also associate photos with nearby clients automatically.',
    category: 'clients',
    keywords: ['address', 'location', 'gps', 'map', 'geofence'],
  },
  {
    id: 'import-contacts',
    question: 'Can I import contacts from my phone?',
    answer:
      'Yes! In the Clients tab, tap the import icon to access your phone\'s contacts. Select the contacts you want to add as clients. Note: You\'ll need to grant contacts permission when prompted.',
    category: 'clients',
    keywords: ['import', 'contacts', 'phone', 'address book'],
  },
  {
    id: 'client-photos',
    question: 'How do I add photos for a client?',
    answer:
      'Open a client and tap the camera icon. Photos are automatically tagged with location and time. If you\'re near a client location, the app can auto-associate photos with that client.',
    category: 'clients',
    keywords: ['photos', 'pictures', 'camera', 'images', 'before', 'after'],
  },

  // Jobs & Checklists
  {
    id: 'job-checklists',
    question: 'How do job checklists work?',
    answer:
      'Job checklists help you track progress on large jobs. Create multiple checklists per job (e.g., "Site Prep", "Materials", "Final Inspection"). All team members can add items and check them off. Progress is shown with visual progress bars.',
    category: 'jobs',
    keywords: ['checklist', 'tasks', 'progress', 'tracking', 'job', 'items'],
    relatedWalkthroughStep: 'job-checklists',
  },
  {
    id: 'create-checklist',
    question: 'How do I create a job checklist?',
    answer:
      'Open a job and tap "Manage Checklists". If you\'re a Crew Lead or higher, tap "Create New Checklist", give it a title and description, then start adding items. Anyone can add items, but only non-basic users can create or delete checklists.',
    category: 'jobs',
    keywords: ['create', 'checklist', 'new', 'add', 'make'],
  },
  {
    id: 'checklist-templates',
    question: 'What are checklist templates?',
    answer:
      'Checklist templates are reusable checklists you can apply when creating jobs. Save commonly-used checklists (like "Lawn Service Checklist" or "House Cleaning Tasks") as templates, then select them when creating new jobs to auto-populate items.',
    category: 'jobs',
    keywords: ['template', 'reuse', 'save', 'preset', 'default'],
  },
  {
    id: 'save-checklist-template',
    question: 'How do I save a checklist as a template?',
    answer:
      'While viewing a job checklist, tap "Save as Template". The checklist and all its items will be saved for reuse. When creating a new job, you\'ll see a dropdown to select which templates to apply.',
    category: 'jobs',
    keywords: ['save', 'template', 'reuse', 'create'],
  },
  {
    id: 'who-can-manage-checklists',
    question: 'Who can create and delete checklists?',
    answer:
      'Crew Leads, Managers, Admins, and Owners can create checklists, save templates, and delete checklists. All users (including Basic) can add items, complete items, and add notes. This ensures field crews can update progress while maintaining organizational control.',
    category: 'jobs',
    keywords: ['permissions', 'roles', 'create', 'delete', 'manage', 'who'],
  },
  {
    id: 'checklist-notes',
    question: 'Can I add notes to checklist items?',
    answer:
      'Yes! Every checklist item can have notes. Tap "Add notes" on any item to record measurements, issues found, or special instructions. Notes are visible to all team members and help document work details.',
    category: 'jobs',
    keywords: ['notes', 'comments', 'details', 'annotations', 'documentation'],
  },

  // Schedule
  {
    id: 'create-event',
    question: 'How do I schedule a job?',
    answer:
      'Go to the Schedule tab and tap the + button. Select a client, set the date and time, add a job type, and optionally set an amount. You can also enable recurring schedules for regular clients.',
    category: 'schedule',
    keywords: ['schedule', 'appointment', 'job', 'event', 'book'],
    relatedWalkthroughStep: 'create-schedule',
  },
  {
    id: 'recurring-events',
    question: 'Can I create recurring schedules?',
    answer:
      'Yes! When creating or editing a schedule event, enable "Recurring" and choose your frequency (daily, weekly, biweekly, monthly, or custom). You can specify end dates and customize recurrence patterns.',
    category: 'schedule',
    keywords: ['recurring', 'repeat', 'regular', 'weekly', 'monthly'],
  },
  {
    id: 'schedule-notifications',
    question: 'Will I get notified about upcoming jobs?',
    answer:
      'The app includes message templates for "day of" and "on the way" notifications. You can set these up in Settings > Message Templates and send them to clients with a tap.',
    category: 'schedule',
    keywords: ['notifications', 'reminders', 'alerts', 'messages'],
    relatedWalkthroughStep: 'message-templates',
  },
  {
    id: 'payment-tracking',
    question: 'Can I track payments in my schedule?',
    answer:
      'Yes! Each schedule event has payment status tracking. You can mark jobs as paid, record payment methods, and see unpaid jobs at a glance. Payments link to your income tracking automatically.',
    category: 'schedule',
    keywords: ['payment', 'paid', 'unpaid', 'money', 'collect'],
  },

  // Invoicing
  {
    id: 'create-invoice',
    question: 'How do I create an invoice?',
    answer:
      'Go to the Invoices tab and tap the invoice icon. Select a client, add line items using your job types, set payment terms, and send it via email or text. The app calculates totals and tax automatically.',
    category: 'invoicing',
    keywords: ['invoice', 'bill', 'charge', 'payment', 'send'],
    relatedWalkthroughStep: 'create-invoice',
  },
  {
    id: 'estimates-vs-invoices',
    question: 'What\'s the difference between estimates and invoices?',
    answer:
      'Estimates are quotes you send before doing work. They show potential costs and can be converted to invoices. Invoices are bills for completed work that request payment with due dates.',
    category: 'invoicing',
    keywords: ['estimate', 'quote', 'proposal', 'invoice', 'difference'],
  },
  {
    id: 'invoice-payment-terms',
    question: 'Can I set different payment terms?',
    answer:
      'Yes! When creating an invoice, you can choose from common payment terms: Due on Receipt, Net 15, Net 30, Net 60, or custom terms. The app will automatically calculate and show the due date.',
    category: 'invoicing',
    keywords: ['payment terms', 'due date', 'net 30', 'net 15'],
  },
  {
    id: 'invoice-status',
    question: 'How do I track invoice status?',
    answer:
      'Invoices have status tracking: Draft, Sent, Paid, Overdue, or Cancelled. The app automatically marks invoices as overdue when past their due date. Update status as you send and receive payments.',
    category: 'invoicing',
    keywords: ['status', 'paid', 'overdue', 'sent', 'tracking'],
  },

  // Time Tracking
  {
    id: 'clock-in-out',
    question: 'How does time tracking work?',
    answer:
      'Go to the Time tab and tap "Clock In" to start tracking. Clock out when done. The app tracks your total hours, breaks, and can optionally track your location during work sessions.',
    category: 'time-tracking',
    keywords: ['time', 'clock', 'hours', 'track', 'timesheet'],
    relatedWalkthroughStep: 'time-tracking',
  },
  {
    id: 'breaks',
    question: 'Can I track breaks separately?',
    answer:
      'Yes! While clocked in, tap "Start Break" to pause time tracking. Tap "End Break" to resume. All breaks are recorded and deducted from your total work time automatically.',
    category: 'time-tracking',
    keywords: ['break', 'lunch', 'pause', 'rest'],
  },
  {
    id: 'location-tracking',
    question: 'What is location tracking for?',
    answer:
      'Enable location tracking to automatically detect when you arrive at and leave client locations. This helps track drive time, verify job completion, and associate photos with specific clients.',
    category: 'time-tracking',
    keywords: ['location', 'gps', 'tracking', 'geofence', 'arrival'],
  },
  {
    id: 'productivity-sessions',
    question: 'What are productivity sessions?',
    answer:
      'Productivity sessions automatically track your time at different locations (job sites, driving, breaks). They help you understand where your time goes and optimize your schedule.',
    category: 'time-tracking',
    keywords: ['productivity', 'sessions', 'efficiency', 'tracking'],
  },

  // Settings
  {
    id: 'message-templates',
    question: 'How do I set up message templates?',
    answer:
      'Go to Settings > Message Templates. Create templates for "Day of", "On the way", and "Follow up" messages. You can use placeholders like {clientName} and {time} that get automatically filled in.',
    category: 'settings',
    keywords: ['messages', 'templates', 'sms', 'text', 'communication'],
    relatedWalkthroughStep: 'message-templates',
  },
  {
    id: 'business-info',
    question: 'Where do I add my business info?',
    answer:
      'Go to Settings > Business Settings. Add your business name, address, phone, email, and logo. This information appears on your invoices and estimates.',
    category: 'settings',
    keywords: ['business', 'company', 'logo', 'info', 'details'],
  },
  {
    id: 'theme',
    question: 'Can I change the app theme?',
    answer:
      'Yes! Go to Settings and toggle between Light and Dark theme. The app will remember your preference and apply it every time you open the app.',
    category: 'settings',
    keywords: ['theme', 'dark mode', 'light mode', 'appearance'],
  },
  {
    id: 'geofence-radius',
    question: 'What is the geofence radius setting?',
    answer:
      'The geofence radius determines how close you need to be to a client location for automatic arrival detection. Default is 100 meters. Increase it for rural areas or decrease for dense neighborhoods.',
    category: 'settings',
    keywords: ['geofence', 'radius', 'distance', 'arrival', 'detection'],
  },

  // Troubleshooting
  {
    id: 'sync-issues',
    question: 'My data isn\'t syncing. What should I do?',
    answer:
      'First, check your internet connection. If connected, try pulling down to refresh on any screen. If issues persist, log out and log back in. Your data is safely stored in the cloud.',
    category: 'troubleshooting',
    keywords: ['sync', 'loading', 'refresh', 'connection', 'internet'],
  },
  {
    id: 'location-not-working',
    question: 'Location features aren\'t working',
    answer:
      'Go to your device Settings > Privacy > Location Services and ensure this app has "While Using" or "Always" permission. Also check that Location Services is enabled for your device.',
    category: 'troubleshooting',
    keywords: ['location', 'gps', 'permission', 'not working', 'broken'],
  },
  {
    id: 'cant-send-messages',
    question: 'I can\'t send messages to clients',
    answer:
      'Make sure you\'ve added phone numbers for your clients. The app will open your default messaging app with the message pre-filled, but you need to have SMS/messaging capability on your device.',
    category: 'troubleshooting',
    keywords: ['messages', 'sms', 'send', 'text', 'not working'],
  },
  {
    id: 'invoice-not-calculating',
    question: 'Invoice totals aren\'t calculating correctly',
    answer:
      'Double-check that you\'ve entered valid numbers for quantity and price. If using job types, make sure the rates are set correctly. Tax is calculated on the subtotal before being added to the total.',
    category: 'troubleshooting',
    keywords: ['invoice', 'calculation', 'wrong', 'total', 'math'],
  },
];
