export interface WalkthroughStep {
  id: string;
  title: string;
  description: string;
  targetElementId?: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  gifUrl?: string;
  showSpotlight?: boolean;
  requiresNavigation?: {
    tab: string;
    action?: () => void;
  };
}

export const WALKTHROUGH_STEPS: WalkthroughStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Your Business Toolbox!',
    description:
      'This quick tour will show you the key features to help you manage clients, schedule jobs, track time, and handle invoicing all in one place. It takes about 2 minutes.',
    position: 'center',
    showSpotlight: false,
  },
  {
    id: 'home-overview',
    title: 'Your Command Center',
    description:
      'The Home screen gives you an at-a-glance view of your business. See today\'s schedule, recent clients, quick stats, and access important actions instantly.',
    targetElementId: 'home-screen',
    position: 'center',
  },
  {
    id: 'navigation-tabs',
    title: 'Navigate with Tabs',
    description:
      'Use the bottom tabs to access different sections: Home, Clients, Schedule, Invoices, Notes, and Finances. Each tab is designed for a specific part of your business.',
    targetElementId: 'tab-bar',
    position: 'top',
  },
  {
    id: 'clients-tab',
    title: 'Manage Your Clients',
    description:
      'The Clients tab is where you store all your customer information, contact details, addresses, and job history. Tap the + button to add your first client.',
    targetElementId: 'clients-add-button',
    position: 'bottom',
    requiresNavigation: { tab: 'clients' },
  },
  {
    id: 'add-client',
    title: 'Adding Clients is Easy',
    description:
      'Enter the client\'s name and contact info. Adding an address enables location features like automatic arrival detection and route optimization.',
    position: 'center',
  },
  {
    id: 'schedule-tab',
    title: 'Schedule Your Jobs',
    description:
      'The Schedule tab shows your calendar of upcoming jobs. Create one-time or recurring appointments, link them to clients, and track payment status.',
    targetElementId: 'schedule-add-button',
    position: 'bottom',
    requiresNavigation: { tab: 'schedule' },
  },
  {
    id: 'job-types',
    title: 'Define Your Services',
    description:
      'Job types are your services with rates and units. Find them in the Invoices tab by tapping the briefcase icon. Set up hourly rates, flat fees, or custom pricing.',
    targetElementId: 'job-types-button',
    position: 'bottom',
    requiresNavigation: { tab: 'invoices' },
  },
  {
    id: 'create-invoice',
    title: 'Invoice Your Work',
    description:
      'Create professional invoices with line items, tax calculations, and payment terms. Send them via email or text message directly from the app.',
    targetElementId: 'invoice-add-button',
    position: 'bottom',
    requiresNavigation: { tab: 'invoices' },
  },
  {
    id: 'job-checklists',
    title: 'Track Progress with Checklists',
    description:
      'For large jobs, create checklists to track tasks and progress. Your team can add items, check them off, and add notes. Save common checklists as templates to reuse on similar jobs. Great for ensuring nothing gets missed!',
    position: 'center',
  },
  {
    id: 'time-tracking',
    title: 'Track Your Time',
    description:
      'Clock in and out to track work hours. The app can optionally track your location, detect client arrivals, and log productivity sessions automatically.',
    targetElementId: 'time-clock-button',
    position: 'bottom',
    requiresNavigation: { tab: 'time' },
  },
  {
    id: 'notes-tab',
    title: 'Keep Notes & To-Dos',
    description:
      'Use the Notes tab to jot down important information and create to-do lists. Keep everything related to your business organized in one place.',
    position: 'center',
    requiresNavigation: { tab: 'notes' },
  },
  {
    id: 'finances-tab',
    title: 'Monitor Your Finances',
    description:
      'Track income and expenses, view financial summaries, and understand your business performance. Scan receipts with your camera for easy expense logging.',
    position: 'center',
    requiresNavigation: { tab: 'finances' },
  },
  {
    id: 'settings-overview',
    title: 'Customize Everything',
    description:
      'Tap the settings icon to customize your experience. Set up message templates, adjust your layout, manage business info, and access this help system anytime.',
    targetElementId: 'settings-button',
    position: 'bottom',
  },
  {
    id: 'layout-customization',
    title: 'Make It Yours',
    description:
      'In Settings > Customize Layout, you can hide/show features, reorder tabs, and customize quick actions. Focus on what matters most to your business.',
    position: 'center',
  },
  {
    id: 'message-templates',
    title: 'Communicate Efficiently',
    description:
      'Set up message templates for common communications like "On my way" or "Job completed". Send them to clients with a single tap, with details filled in automatically.',
    position: 'center',
  },
  {
    id: 'help-center',
    title: 'Get Help Anytime',
    description:
      'Stuck? Tap Settings > FAQ & Help Center to search for answers. Each FAQ item has a "Show Me" button that can guide you through features step-by-step.',
    position: 'center',
  },
  {
    id: 'completion',
    title: 'You\'re All Set!',
    description:
      'You now know the basics! Start by adding a client, then schedule your first job. Remember, you can always access help from the Settings menu. Let\'s get to work!',
    position: 'center',
    showSpotlight: false,
  },
];

export const WALKTHROUGH_WELCOME_BENEFITS = [
  {
    icon: 'Users',
    title: 'Manage Clients',
    description: 'Store contacts, track history, and stay organized',
  },
  {
    icon: 'Calendar',
    title: 'Smart Scheduling',
    description: 'Book jobs, set recurring appointments, and never miss a beat',
  },
  {
    icon: 'Receipt',
    title: 'Easy Invoicing',
    description: 'Create professional invoices and estimates in seconds',
  },
  {
    icon: 'Clock',
    title: 'Time Tracking',
    description: 'Track hours, breaks, and productivity automatically',
  },
  {
    icon: 'DollarSign',
    title: 'Financial Insights',
    description: 'Monitor income, expenses, and business performance',
  },
];
