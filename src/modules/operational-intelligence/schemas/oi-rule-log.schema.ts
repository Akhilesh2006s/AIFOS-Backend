import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type OiRuleLogDocument = OiRuleLog & Document;

@Schema({ _id: false })
export class OiMatchedEntity {
  @Prop() type?: string;
  @Prop() id?: string;
  @Prop() name?: string;
}

@Schema({ _id: false })
export class OiExecutedAction {
  @Prop({ required: true }) type: string;
  @Prop({ default: 'success' }) result: string;
  @Prop() message?: string;
}

@Schema({ timestamps: true, collection: 'oi_rule_logs' })
export class OiRuleLog {
  @Prop({ type: Types.ObjectId, ref: 'OiRule' })
  ruleId?: Types.ObjectId;

  @Prop()
  ruleCode?: string;

  @Prop({ required: true })
  ruleName: string;

  @Prop()
  domain?: string;

  @Prop({ required: true })
  triggered: boolean;

  @Prop()
  metricValue?: number;

  @Prop()
  threshold?: number;

  @Prop()
  message?: string;

  @Prop({ default: 'evaluate' })
  action: string;

  @Prop({ type: OiMatchedEntity })
  matchedEntity?: OiMatchedEntity;

  @Prop()
  executionTimeMs?: number;

  @Prop({ type: [OiExecutedAction], default: [] })
  triggeredActions: OiExecutedAction[];

  @Prop({ default: 'success' })
  executionResult: string;

  @Prop()
  projectId?: string;

  @Prop({ default: 'bekem' })
  organizationId: string;

  @Prop()
  executedBy?: string;
}

export const OiRuleLogSchema = SchemaFactory.createForClass(OiRuleLog);
OiRuleLogSchema.index({ createdAt: -1 });
OiRuleLogSchema.index({ ruleId: 1, createdAt: -1 });
