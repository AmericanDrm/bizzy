import { supabase } from './supabase';

export interface DurationPrediction {
  estimatedMinutes: number;
  baseDuration: number;
  adjustedDuration: number;
  confidenceScore: number;
  historicalDataPoints: number;
  averageCrewSize: number;
  lastJobDuration?: number;
  lastJobDate?: string;
  efficiencyMultiplier: number;
}

export interface CrewEfficiencyRule {
  id: string;
  crew_size: number;
  efficiency_multiplier: number;
  service_type: string | null;
}

export interface HistoricalJob {
  actual_duration_minutes: number;
  crew_size: number;
  date: string;
  service_type: string;
}

export const jobHistoryService = {
  async predictJobDuration(
    clientId: string,
    serviceType: string | null,
    crewSize: number = 1,
    userId: string
  ): Promise<DurationPrediction | null> {
    try {
      const historicalJobs = await this.getHistoricalJobs(clientId, serviceType);

      if (!historicalJobs || historicalJobs.length === 0) {
        const defaultDuration = await this.getDefaultDuration(clientId, serviceType, userId);
        const efficiencyMultiplier = await this.getEfficiencyMultiplier(crewSize, serviceType, userId);

        if (defaultDuration) {
          const adjustedDuration = Math.round(defaultDuration * efficiencyMultiplier);
          return {
            estimatedMinutes: adjustedDuration,
            baseDuration: defaultDuration,
            adjustedDuration,
            confidenceScore: 0.3,
            historicalDataPoints: 0,
            averageCrewSize: 1,
            efficiencyMultiplier,
          };
        }
        return null;
      }

      const baseDuration = this.calculateWeightedAverage(historicalJobs);
      const averageCrewSize = this.calculateAverageCrewSize(historicalJobs);
      const confidenceScore = this.calculateConfidenceScore(historicalJobs);
      const efficiencyMultiplier = await this.getEfficiencyMultiplier(crewSize, serviceType, userId);
      const adjustedDuration = Math.round(baseDuration * efficiencyMultiplier);

      const sortedJobs = historicalJobs.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      const lastJob = sortedJobs[0];

      return {
        estimatedMinutes: adjustedDuration,
        baseDuration,
        adjustedDuration,
        confidenceScore,
        historicalDataPoints: historicalJobs.length,
        averageCrewSize,
        lastJobDuration: lastJob?.actual_duration_minutes,
        lastJobDate: lastJob?.date,
        efficiencyMultiplier,
      };
    } catch (error) {
      console.error('Error predicting job duration:', error);
      return null;
    }
  },

  async getHistoricalJobs(
    clientId: string,
    serviceType: string | null
  ): Promise<HistoricalJob[]> {
    let query = supabase
      .from('jobs')
      .select('actual_duration_minutes, crew_size, date, service_type')
      .eq('client_id', clientId)
      .eq('status', 'completed')
      .not('actual_duration_minutes', 'is', null)
      .order('date', { ascending: false })
      .limit(20);

    if (serviceType) {
      query = query.eq('service_type', serviceType);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching historical jobs:', error);
      return [];
    }

    return data || [];
  },

  calculateWeightedAverage(jobs: HistoricalJob[]): number {
    if (jobs.length === 0) return 60;

    const sortedJobs = jobs.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    let totalWeight = 0;
    let weightedSum = 0;

    sortedJobs.forEach((job, index) => {
      const weight = Math.pow(0.85, index);
      totalWeight += weight;
      weightedSum += job.actual_duration_minutes * weight;
    });

    return Math.round(weightedSum / totalWeight);
  },

  calculateAverageCrewSize(jobs: HistoricalJob[]): number {
    if (jobs.length === 0) return 1;
    const sum = jobs.reduce((acc, job) => acc + (job.crew_size || 1), 0);
    return Math.round((sum / jobs.length) * 10) / 10;
  },

  calculateConfidenceScore(jobs: HistoricalJob[]): number {
    if (jobs.length === 0) return 0;
    if (jobs.length === 1) return 0.4;
    if (jobs.length === 2) return 0.6;
    if (jobs.length >= 3 && jobs.length < 5) return 0.75;
    if (jobs.length >= 5 && jobs.length < 10) return 0.85;
    return 0.95;
  },

  async getDefaultDuration(
    clientId: string,
    serviceType: string | null,
    userId: string
  ): Promise<number | null> {
    const { data: client } = await supabase
      .from('clients')
      .select('typical_job_duration, average_job_duration_by_service')
      .eq('id', clientId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!client) return null;

    if (
      serviceType &&
      client.average_job_duration_by_service &&
      typeof client.average_job_duration_by_service === 'object'
    ) {
      const serviceDuration =
        (client.average_job_duration_by_service as any)[serviceType];
      if (serviceDuration) return serviceDuration;
    }

    return client.typical_job_duration || 60;
  },

  async getEfficiencyMultiplier(
    crewSize: number,
    serviceType: string | null,
    userId: string
  ): Promise<number> {
    await this.ensureDefaultRulesExist(userId);

    let query = supabase
      .from('crew_efficiency_rules')
      .select('efficiency_multiplier')
      .eq('user_id', userId)
      .eq('crew_size', crewSize);

    if (serviceType) {
      const { data: specificRule } = await query
        .eq('service_type', serviceType)
        .maybeSingle();
      if (specificRule) return specificRule.efficiency_multiplier;
    }

    const { data: generalRule } = await query
      .is('service_type', null)
      .maybeSingle();

    if (generalRule) return generalRule.efficiency_multiplier;

    return this.getDefaultEfficiencyMultiplier(crewSize);
  },

  getDefaultEfficiencyMultiplier(crewSize: number): number {
    const defaultMultipliers: { [key: number]: number } = {
      1: 1.0,
      2: 0.6,
      3: 0.45,
      4: 0.35,
      5: 0.3,
    };

    if (crewSize in defaultMultipliers) {
      return defaultMultipliers[crewSize];
    }

    if (crewSize > 5) {
      return 0.25;
    }

    return 1.0;
  },

  async ensureDefaultRulesExist(userId: string): Promise<void> {
    const { data: existingRules } = await supabase
      .from('crew_efficiency_rules')
      .select('id')
      .eq('user_id', userId)
      .limit(1);

    if (!existingRules || existingRules.length === 0) {
      const { error } = await supabase.rpc(
        'initialize_default_crew_efficiency_rules',
        { p_user_id: userId }
      );

      if (error) {
        console.error('Error initializing default crew efficiency rules:', error);
      }
    }
  },

  async getCrewEfficiencyRules(userId: string): Promise<CrewEfficiencyRule[]> {
    await this.ensureDefaultRulesExist(userId);

    const { data, error } = await supabase
      .from('crew_efficiency_rules')
      .select('id, crew_size, efficiency_multiplier, service_type')
      .eq('user_id', userId)
      .order('crew_size', { ascending: true });

    if (error) {
      console.error('Error fetching crew efficiency rules:', error);
      return [];
    }

    return data || [];
  },

  async updateCrewEfficiencyRule(
    ruleId: string,
    efficiencyMultiplier: number,
    userId: string
  ): Promise<boolean> {
    const { error } = await supabase
      .from('crew_efficiency_rules')
      .update({
        efficiency_multiplier: efficiencyMultiplier,
        updated_at: new Date().toISOString(),
      })
      .eq('id', ruleId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error updating crew efficiency rule:', error);
      return false;
    }

    return true;
  },

  async createCrewEfficiencyRule(
    userId: string,
    crewSize: number,
    efficiencyMultiplier: number,
    serviceType: string | null = null
  ): Promise<boolean> {
    const { error } = await supabase
      .from('crew_efficiency_rules')
      .insert({
        user_id: userId,
        crew_size: crewSize,
        efficiency_multiplier: efficiencyMultiplier,
        service_type: serviceType,
      });

    if (error) {
      console.error('Error creating crew efficiency rule:', error);
      return false;
    }

    return true;
  },

  async updateJobCompletion(
    jobId: string,
    actualDurationMinutes: number,
    crewSize: number,
    userId: string
  ): Promise<boolean> {
    const { error } = await supabase
      .from('jobs')
      .update({
        actual_duration_minutes: actualDurationMinutes,
        crew_size: crewSize,
        status: 'completed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error updating job completion:', error);
      return false;
    }

    return true;
  },

  formatDuration(minutes: number): string {
    if (minutes < 60) {
      return `${minutes} min`;
    }

    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (mins === 0) {
      return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
    }

    return `${hours}h ${mins}m`;
  },

  getConfidenceLabel(score: number): string {
    if (score >= 0.85) return 'High';
    if (score >= 0.6) return 'Medium';
    if (score >= 0.4) return 'Low';
    return 'Very Low';
  },

  getConfidenceColor(score: number): string {
    if (score >= 0.85) return '#10b981';
    if (score >= 0.6) return '#f59e0b';
    if (score >= 0.4) return '#1B4D6E';
    return '#6b7280';
  },
};
