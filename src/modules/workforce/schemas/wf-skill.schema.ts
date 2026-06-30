import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { SKILL_LEVELS, TRADES } from './intelligence.constants';

export type WfSkillDocument = WfSkill & Document;

@Schema({ timestamps: true, collection: 'wf_skills' })
export class WfSkill {
  @Prop({ required: true })
  employeeId: string;

  @Prop()
  employeeName?: string;

  @Prop({ required: true })
  skillName: string;

  @Prop({ required: true, enum: SKILL_LEVELS })
  skillLevel: string;

  @Prop({ enum: TRADES })
  trade?: string;

  @Prop()
  experienceYears?: number;

  @Prop({ default: false })
  isMachineCertification: boolean;

  @Prop({ default: false })
  isOperatorSkill: boolean;

  @Prop({ type: Date })
  validFrom?: Date;

  @Prop({ type: Date })
  expiryDate?: Date;

  @Prop({ default: 'valid' })
  status: string;

  @Prop()
  projectId?: string;

  @Prop({ default: 'bekem' })
  organizationId: string;

  @Prop()
  createdBy?: string;
}

export const WfSkillSchema = SchemaFactory.createForClass(WfSkill);
WfSkillSchema.index({ employeeId: 1, skillName: 1 });
