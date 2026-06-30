import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import {
  RULE_ACTION_TYPES, RULE_CATEGORIES, RULE_DOMAINS, RULE_OPERATORS,
  RULE_PRIORITIES, RULE_SCHEDULE_FREQUENCIES, RULE_SEVERITIES, RULE_STATUSES,
} from '../oi.constants';

export type OiRuleDocument = OiRule & Document;

@Schema({ _id: false })
export class OiRuleCondition {
  @Prop({ required: true }) metric: string;
  @Prop({ required: true, enum: RULE_OPERATORS }) operator: string;
  @Prop({ required: true }) threshold: number;
  @Prop() label?: string;
}

@Schema({ _id: false })
export class OiRuleAction {
  @Prop({ required: true, enum: RULE_ACTION_TYPES }) type: string;
  @Prop({ type: Object }) config?: Record<string, unknown>;
}

@Schema({ _id: false })
export class OiRuleSchedule {
  @Prop({ default: 'continuous', enum: RULE_SCHEDULE_FREQUENCIES }) frequency: string;
  @Prop({ default: true }) enabled: boolean;
  @Prop() cron?: string;
}

@Schema({ timestamps: true, collection: 'oi_rules' })
export class OiRule {
  @Prop({ required: true, unique: true })
  ruleCode: string;

  @Prop({ required: true })
  name: string;

  @Prop()
  description?: string;

  @Prop({ required: true, enum: RULE_DOMAINS })
  domain: string;

  @Prop({ required: true, enum: RULE_CATEGORIES })
  category: string;

  /** Legacy single-condition fields (kept for backward compatibility) */
  @Prop({ required: true })
  metric: string;

  @Prop({ required: true, enum: RULE_OPERATORS })
  operator: string;

  @Prop({ required: true })
  threshold: number;

  @Prop({ type: [OiRuleCondition], default: [] })
  conditions: OiRuleCondition[];

  @Prop({ type: [OiRuleAction], default: [] })
  actions: OiRuleAction[];

  @Prop({ type: OiRuleSchedule, default: () => ({ frequency: 'continuous', enabled: true }) })
  schedule: OiRuleSchedule;

  @Prop({ default: 'warning', enum: RULE_SEVERITIES })
  severity: string;

  @Prop({ default: 'medium', enum: RULE_PRIORITIES })
  priority: string;

  @Prop({ default: 'active', enum: RULE_STATUSES })
  status: string;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop()
  owner?: string;

  @Prop()
  projectId?: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: false })
  isSystem: boolean;

  @Prop({ default: 'bekem' })
  organizationId: string;

  @Prop()
  createdBy?: string;
}

export const OiRuleSchema = SchemaFactory.createForClass(OiRule);
