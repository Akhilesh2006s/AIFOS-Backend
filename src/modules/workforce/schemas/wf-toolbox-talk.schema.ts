import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { TOOLBOX_STATUSES } from './safety.constants';

export type WfToolboxTalkDocument = WfToolboxTalk & Document;

@Schema({ _id: false })
export class ToolboxAttendee {
  @Prop()
  employeeId?: string;

  @Prop()
  name: string;

  @Prop({ default: false })
  present: boolean;
}

@Schema({ timestamps: true, collection: 'wf_toolbox_talks' })
export class WfToolboxTalk {
  @Prop({ required: true })
  topic: string;

  @Prop({ required: true })
  instructor: string;

  @Prop({ required: true })
  projectId: string;

  @Prop()
  siteId?: string;

  @Prop({ type: Date, required: true })
  talkDate: Date;

  @Prop({ type: [ToolboxAttendee], default: [] })
  attendees: ToolboxAttendee[];

  @Prop({ type: [String], default: [] })
  photoUrls: string[];

  @Prop({ type: [String], default: [] })
  documentIds: string[];

  @Prop({ default: true })
  digitalAttendance: boolean;

  @Prop()
  remarks?: string;

  @Prop({ default: 'scheduled', enum: TOOLBOX_STATUSES })
  status: string;

  @Prop()
  createdBy?: string;

  @Prop({ default: 'bekem' })
  organizationId: string;
}

export const WfToolboxTalkSchema = SchemaFactory.createForClass(WfToolboxTalk);
WfToolboxTalkSchema.index({ projectId: 1, talkDate: -1 });
