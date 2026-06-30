import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export const TEAM_TYPES = ['crew', 'department', 'project', 'site', 'shift'] as const;

export type WfTeamDocument = WfTeam & Document;

@Schema({ timestamps: true, collection: 'wf_teams' })
export class WfTeam {
  @Prop({ default: 'bekem' })
  organizationId: string;

  @Prop({ required: true })
  name: string;

  @Prop({ enum: TEAM_TYPES, default: 'crew' })
  teamType: string;

  @Prop()
  projectId?: string;

  @Prop()
  siteId?: string;

  @Prop()
  supervisorId?: string;

  @Prop()
  supervisorName?: string;

  @Prop({ type: [String], default: [] })
  memberIds: string[];

  @Prop()
  shift?: string;

  @Prop()
  createdBy?: string;

  @Prop({ default: 'active' })
  status: string;
}

export const WfTeamSchema = SchemaFactory.createForClass(WfTeam);
WfTeamSchema.index({ projectId: 1, teamType: 1 });
