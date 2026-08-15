import { supabase } from './supabase';

let sessionId: string | null = null;

export function generateSessionId(): string {
  sessionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  return sessionId;
}

export function getCurrentSessionId(): string {
  if (!sessionId) {
    return generateSessionId();
  }
  return sessionId;
}

export interface FAQAnalyticsData {
  faqItemId: string;
  category: string;
  actionType: 'viewed' | 'search' | 'show_me_clicked' | 'feedback_helpful' | 'feedback_not_helpful';
  searchQuery?: string;
}

export interface WalkthroughAnalyticsData {
  stepId?: string;
  actionType: 'started' | 'completed' | 'skipped' | 'step_viewed' | 'step_skipped' | 'resumed' | 'restarted';
  source?: 'first_time' | 'settings' | 'help_button' | 'reminder';
  timeSpentSeconds?: number;
  completionPercentage?: number;
}

export async function trackFAQEvent(data: FAQAnalyticsData): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      console.warn('No user found for FAQ analytics');
      return;
    }

    const { error } = await supabase.from('faq_analytics').insert({
      user_id: user.id,
      faq_item_id: data.faqItemId,
      category: data.category,
      action_type: data.actionType,
      search_query: data.searchQuery,
      session_id: getCurrentSessionId(),
    });

    if (error) {
      console.error('Error tracking FAQ event:', error);
    }
  } catch (err) {
    console.error('Failed to track FAQ event:', err);
  }
}

export async function trackWalkthroughEvent(data: WalkthroughAnalyticsData): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      console.warn('No user found for walkthrough analytics');
      return;
    }

    const { error } = await supabase.from('walkthrough_analytics').insert({
      user_id: user.id,
      session_id: getCurrentSessionId(),
      step_id: data.stepId,
      action_type: data.actionType,
      source: data.source,
      time_spent_seconds: data.timeSpentSeconds,
      completion_percentage: data.completionPercentage,
    });

    if (error) {
      console.error('Error tracking walkthrough event:', error);
    }
  } catch (err) {
    console.error('Failed to track walkthrough event:', err);
  }
}

export async function updateUserWalkthroughStatus(
  status: 'started' | 'skipped' | 'completed',
  lastStep?: string
): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const updates: any = {
      has_seen_walkthrough_prompt: true,
    };

    if (status === 'skipped') {
      updates.walkthrough_skipped_at = new Date().toISOString();
    } else if (status === 'completed') {
      updates.walkthrough_completed_at = new Date().toISOString();
    }

    if (lastStep) {
      updates.walkthrough_last_step = lastStep;
    }

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id);

    if (error) {
      console.error('Error updating walkthrough status:', error);
    }
  } catch (err) {
    console.error('Failed to update walkthrough status:', err);
  }
}

export async function getUserWalkthroughStatus(): Promise<{
  hasSeenPrompt: boolean;
  skippedAt: string | null;
  completedAt: string | null;
  lastStep: string | null;
  showReminders: boolean;
}> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        hasSeenPrompt: false,
        skippedAt: null,
        completedAt: null,
        lastStep: null,
        showReminders: true,
      };
    }

    const { data, error } = await supabase
      .from('profiles')
      .select(
        'has_seen_walkthrough_prompt, walkthrough_skipped_at, walkthrough_completed_at, walkthrough_last_step, show_walkthrough_reminders'
      )
      .eq('id', user.id)
      .maybeSingle();

    if (error || !data) {
      return {
        hasSeenPrompt: false,
        skippedAt: null,
        completedAt: null,
        lastStep: null,
        showReminders: true,
      };
    }

    return {
      hasSeenPrompt: data.has_seen_walkthrough_prompt || false,
      skippedAt: data.walkthrough_skipped_at,
      completedAt: data.walkthrough_completed_at,
      lastStep: data.walkthrough_last_step,
      showReminders: data.show_walkthrough_reminders !== false,
    };
  } catch (err) {
    console.error('Failed to get walkthrough status:', err);
    return {
      hasSeenPrompt: false,
      skippedAt: null,
      completedAt: null,
      lastStep: null,
      showReminders: true,
    };
  }
}

export const analyticsService = {
  trackFAQEvent,
  trackWalkthroughEvent,
  updateUserWalkthroughStatus,
  getUserWalkthroughStatus,
  generateSessionId,
  getCurrentSessionId,
};
