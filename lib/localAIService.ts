import { Platform } from 'react-native';
import { supabase } from './supabase';

interface AIGenerationOptions {
  context?: Record<string, any>;
  maxLength?: number;
  category?: string;
  jobTypeName?: string;
  existingContent?: string;
}

interface JobTypeDefault {
  id: string;
  job_type_id: string;
  default_description?: string;
  default_included_items?: string;
  default_notes?: string;
  default_disclaimers?: string;
  default_materials_list?: string;
}

const COMMON_MATERIALS: Record<string, string[]> = {
  lawn_care: ['Mower', 'Trimmer', 'Edger', 'Blower', 'Fuel', 'Safety equipment'],
  landscaping: ['Plants', 'Mulch', 'Soil', 'Stone', 'Tools', 'Edging materials'],
  snow_removal: ['Salt', 'Sand', 'Shovel', 'Snow blower', 'Ice melt'],
  cleaning: ['Cleaning solution', 'Rags', 'Vacuum', 'Mop', 'Disinfectant'],
  painting: ['Paint', 'Primer', 'Brushes', 'Rollers', 'Drop cloths', 'Tape'],
  plumbing: ['Pipes', 'Fittings', 'Sealant', 'Tools', 'Parts'],
  electrical: ['Wire', 'Switches', 'Outlets', 'Breakers', 'Conduit'],
  hvac: ['Filters', 'Refrigerant', 'Parts', 'Tools', 'Testing equipment'],
};

const COMMON_DISCLAIMERS: Record<string, string[]> = {
  weather: 'Service may be rescheduled due to severe weather conditions.',
  access: 'Customer must provide clear access to work areas.',
  pets: 'Please secure pets during service.',
  payment: 'Payment is due upon completion unless otherwise arranged.',
  warranty: 'Work is guaranteed for 30 days from completion date.',
};

class LocalAIService {
  private modelLoaded = false;
  private cache: Map<string, string> = new Map();

  async initialize(): Promise<void> {
    if (Platform.OS === 'web') {
      try {
        this.modelLoaded = true;
      } catch (error) {
        console.log('AI model not available, using template system');
        this.modelLoaded = false;
      }
    }
  }

  async generateJobDescription(jobTypeName: string, smartDefault?: string): Promise<string> {
    const cacheKey = `job_desc_${jobTypeName}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    if (smartDefault) {
      const enhanced = this.enhanceText(smartDefault, 'job_description');
      this.cache.set(cacheKey, enhanced);
      return enhanced;
    }

    const templates = [
      `Professional ${jobTypeName} service. We provide high-quality workmanship with attention to detail and customer satisfaction guaranteed.`,
      `Expert ${jobTypeName} for residential and commercial properties. Our experienced team ensures quality results every time.`,
      `Comprehensive ${jobTypeName} service. We handle all aspects of the job from start to finish with professional care.`,
    ];

    const result = templates[Math.floor(Math.random() * templates.length)];
    this.cache.set(cacheKey, result);
    return result;
  }

  async generateIncludedItems(jobTypeName: string, smartDefault?: string): Promise<string> {
    const cacheKey = `included_${jobTypeName}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    if (smartDefault) {
      const enhanced = this.enhanceText(smartDefault, 'included_items');
      this.cache.set(cacheKey, enhanced);
      return enhanced;
    }

    const commonItems = [
      'Complete assessment and planning',
      'Professional-grade equipment and materials',
      'Skilled labor and expertise',
      'Clean-up and disposal of debris',
      'Quality inspection upon completion',
    ];

    const result = commonItems.join('\n');
    this.cache.set(cacheKey, result);
    return result;
  }

  async generateNotes(context: { jobType?: string; service?: string }): Promise<string> {
    const { jobType, service } = context;
    const subject = jobType || service || 'this service';

    const templates = [
      `This estimate includes all labor and materials for ${subject}. Please review and let us know if you have any questions.`,
      `We're committed to providing excellent ${subject}. All work will be completed by our experienced professionals.`,
      `Thank you for considering us for your ${subject} needs. We look forward to serving you.`,
    ];

    return templates[Math.floor(Math.random() * templates.length)];
  }

  async generateMaterialsList(jobTypeName: string, smartDefault?: string): Promise<string> {
    if (smartDefault) {
      return this.enhanceText(smartDefault, 'materials');
    }

    const normalized = jobTypeName.toLowerCase().replace(/\s+/g, '_');
    const materials = COMMON_MATERIALS[normalized] || [
      'Materials as needed',
      'Professional equipment',
      'Safety gear',
      'Supplies',
    ];

    return materials.join('\n');
  }

  async generateDisclaimers(categories: string[] = ['general']): Promise<string> {
    const disclaimers: string[] = [];

    categories.forEach(cat => {
      if (cat === 'general' || cat === 'all') {
        disclaimers.push(COMMON_DISCLAIMERS.weather);
        disclaimers.push(COMMON_DISCLAIMERS.payment);
      }
      if (COMMON_DISCLAIMERS[cat]) {
        const disclaimer = COMMON_DISCLAIMERS[cat];
        if (Array.isArray(disclaimer)) {
          disclaimers.push(...disclaimer);
        } else {
          disclaimers.push(disclaimer);
        }
      }
    });

    if (disclaimers.length === 0) {
      disclaimers.push(COMMON_DISCLAIMERS.payment);
    }

    return disclaimers.join('\n\n');
  }

  async generateEstimateNotes(serviceNames: string[], items: string[], hasMaterials: boolean = false): Promise<string> {
    const itemCount = items.length;
    const serviceText = serviceNames.length === 0
      ? 'your requested services'
      : serviceNames.length === 1
      ? serviceNames[0]
      : serviceNames.length === 2
      ? `${serviceNames[0]} and ${serviceNames[1]}`
      : `${serviceNames.slice(0, -1).join(', ')}, and ${serviceNames[serviceNames.length - 1]}`;

    const materialsText = hasMaterials ? ' All pricing includes labor and materials.' : '';

    const templates = [
      `This estimate for ${serviceText} includes ${itemCount} item${itemCount !== 1 ? 's' : ''}.${materialsText} Price is valid for 30 days.`,
      `Detailed estimate for ${serviceText}.${materialsText} Valid for 30 days from date of estimate.`,
      `Thank you for requesting an estimate for ${serviceText}. This proposal outlines the scope and pricing for your project.${materialsText}`,
    ];

    return templates[Math.floor(Math.random() * templates.length)];
  }

  async generateInvoiceSummary(items: Array<{ description: string; quantity?: number }>): Promise<string> {
    if (items.length === 0) {
      return 'Work completed as agreed.';
    }

    const descriptions = items.map(item => {
      const qty = item.quantity && item.quantity > 1 ? `${item.quantity}x ` : '';
      return `${qty}${item.description}`;
    });

    if (descriptions.length === 1) {
      return `Completed: ${descriptions[0]}`;
    }

    return `Work completed:\n${descriptions.slice(0, 5).join('\n')}${descriptions.length > 5 ? '\n...' : ''}`;
  }

  async generateClientMessage(topic: string, context?: string): Promise<string> {
    const templates = [
      `Hi! I wanted to reach out regarding ${topic}. ${context || 'Please let me know if you have any questions.'}`,
      `Hello! This is a quick message about ${topic}. ${context || 'Feel free to contact me if you need any information.'}`,
      `Hi there! Just following up on ${topic}. ${context || 'Looking forward to hearing from you.'}`,
    ];

    return templates[Math.floor(Math.random() * templates.length)];
  }

  async generateEmailSubject(type: 'estimate' | 'invoice' | 'reminder' | 'update', clientName?: string): Promise<string> {
    const name = clientName ? ` for ${clientName}` : '';

    const subjects: Record<string, string[]> = {
      estimate: [
        `Your Estimate${name}`,
        `Estimate Ready${name}`,
        `Proposal${name}`,
      ],
      invoice: [
        `Invoice${name}`,
        `Your Invoice${name}`,
        `Payment Due${name}`,
      ],
      reminder: [
        `Friendly Reminder${name}`,
        `Upcoming Service${name}`,
        `Scheduled Appointment${name}`,
      ],
      update: [
        `Service Update${name}`,
        `Project Status${name}`,
        `Quick Update${name}`,
      ],
    };

    const options = subjects[type] || subjects.update;
    return options[Math.floor(Math.random() * options.length)];
  }

  async generateEmailBody(type: 'estimate' | 'invoice' | 'reminder', context: Record<string, any>): Promise<string> {
    const { clientName = 'Valued Customer', businessName = 'Our Team', jobType, date, amount } = context;

    const templates: Record<string, string[]> = {
      estimate: [
        `Dear ${clientName},\n\nThank you for your interest in our services. Please find attached your estimate for ${jobType || 'the requested service'}.\n\nIf you have any questions or would like to proceed, please don't hesitate to contact us.\n\nBest regards,\n${businessName}`,
        `Hi ${clientName},\n\nWe've prepared your estimate for ${jobType || 'your project'}. Please review the attached document and let us know if you'd like to move forward.\n\nWe look forward to working with you!\n\n${businessName}`,
      ],
      invoice: [
        `Dear ${clientName},\n\nThank you for your business. Your invoice for ${jobType || 'services rendered'} is attached.${amount ? ` The total amount due is ${amount}.` : ''}\n\nPlease remit payment at your earliest convenience.\n\nBest regards,\n${businessName}`,
        `Hi ${clientName},\n\nPlease find your invoice attached for ${jobType || 'the work completed'}.${amount ? ` Amount due: ${amount}.` : ''}\n\nThank you for choosing us!\n\n${businessName}`,
      ],
      reminder: [
        `Dear ${clientName},\n\nThis is a friendly reminder about your scheduled ${jobType || 'service'}${date ? ` on ${date}` : ''}.\n\nWe look forward to serving you. Please contact us if you need to make any changes.\n\nBest regards,\n${businessName}`,
        `Hi ${clientName},\n\nJust a reminder about your upcoming ${jobType || 'appointment'}${date ? ` scheduled for ${date}` : ''}.\n\nSee you soon!\n\n${businessName}`,
      ],
    };

    const options = templates[type] || [];
    if (options.length === 0) {
      return `Dear ${clientName},\n\nThank you for your business.\n\nBest regards,\n${businessName}`;
    }

    return options[Math.floor(Math.random() * options.length)];
  }

  private enhanceText(text: string, category: string): string {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim());

    if (sentences.length === 0) return text;

    const variations = [
      text,
      sentences.join('. ') + '.',
      text.replace(/\b(good|great)\b/gi, 'excellent').replace(/\b(nice)\b/gi, 'professional'),
    ];

    return variations[Math.floor(Math.random() * variations.length)];
  }

  async getSmartDefault(organizationId: string, jobTypeId?: string, field?: string): Promise<string | null> {
    try {
      let query = supabase
        .from('job_type_defaults')
        .select('*')
        .eq('organization_id', organizationId);

      if (jobTypeId) {
        query = query.eq('job_type_id', jobTypeId);
      }

      const { data, error } = await query.maybeSingle();

      if (error || !data) return null;

      if (field) {
        return (data as any)[field] || null;
      }

      return null;
    } catch (error) {
      console.error('Error fetching smart default:', error);
      return null;
    }
  }

  async saveSmartDefault(
    organizationId: string,
    jobTypeId: string,
    field: string,
    value: string
  ): Promise<boolean> {
    try {
      const { data: existing } = await supabase
        .from('job_type_defaults')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('job_type_id', jobTypeId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('job_type_defaults')
          .update({ [field]: value, updated_at: new Date().toISOString() })
          .eq('id', existing.id);

        return !error;
      } else {
        const { error } = await supabase
          .from('job_type_defaults')
          .insert({
            organization_id: organizationId,
            job_type_id: jobTypeId,
            [field]: value,
          });

        return !error;
      }
    } catch (error) {
      console.error('Error saving smart default:', error);
      return false;
    }
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export const localAI = new LocalAIService();

export async function generateLocalAIText(
  type: 'job_description' | 'included_items' | 'notes' | 'materials' | 'disclaimers' | 'estimate_notes' | 'invoice_summary' | 'client_message' | 'email_subject' | 'email_body',
  options: AIGenerationOptions = {}
): Promise<string> {
  await localAI.initialize();

  try {
    switch (type) {
      case 'job_description':
        return await localAI.generateJobDescription(
          options.jobTypeName || 'service',
          options.existingContent
        );

      case 'included_items':
        return await localAI.generateIncludedItems(
          options.jobTypeName || 'service',
          options.existingContent
        );

      case 'notes':
        return await localAI.generateNotes(options.context || {});

      case 'materials':
        return await localAI.generateMaterialsList(
          options.jobTypeName || 'service',
          options.existingContent
        );

      case 'disclaimers':
        return await localAI.generateDisclaimers(options.context?.categories || ['general']);

      case 'estimate_notes':
        return await localAI.generateEstimateNotes(
          options.context?.serviceNames || [],
          options.context?.items || [],
          options.context?.hasMaterials || false
        );

      case 'invoice_summary':
        return await localAI.generateInvoiceSummary(options.context?.items || []);

      case 'client_message':
        return await localAI.generateClientMessage(
          options.context?.topic || 'your service',
          options.context?.additionalContext
        );

      case 'email_subject':
        return await localAI.generateEmailSubject(
          options.context?.type || 'update',
          options.context?.clientName
        );

      case 'email_body':
        return await localAI.generateEmailBody(
          options.context?.type || 'reminder',
          options.context || {}
        );

      default:
        return 'Generated text';
    }
  } catch (error) {
    console.error('Error generating text:', error);
    return 'Unable to generate text. Please enter manually.';
  }
}

export { LocalAIService };
export default localAI;
