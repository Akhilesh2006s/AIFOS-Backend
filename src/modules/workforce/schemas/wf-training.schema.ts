import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { TRAINING_TYPES } from './intelligence.constants';

export type WfTrainingDocument = WfTraining & Document;

@Schema({ _id: false })
export class TrainingAttendee {
  @Prop({ required: true }) employeeId: string;
  @Prop() employeeName?: string;
  @Prop({ default: 'registered' }) status: string;
  @Prop() result?: string;
  @Prop() certificateNumber?: string;
  @Prop({ type: Date }) certificateExpiry?: Date;
}

@Schema({ timestamps: true, collection: 'wf_training' })
export class WfTraining {
  @Prop({ required: true, unique: true })
  trainingNumber: string;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true, enum: TRAINING_TYPES })
  trainingType: string;

  @Prop()
  description?: string;

  @Prop()
  projectId?: string;

  @Prop()
  siteId?: string;

  @Prop({ type: Date, required: true })
  scheduledDate: Date;

  @Prop({ type: Date })
  completedDate?: Date;

  @Prop()
  trainer?: string;

  @Prop({ default: 'scheduled' })
  status: string;

  @Prop({ type: [TrainingAttendee], default: [] })
  attendees: TrainingAttendee[];

  @Prop({ type: [String], default: [] })
  documentIds: string[];

  @Prop({ default: 'bekem' })
  organizationId: string;

  @Prop()
  createdBy?: string;
}

export const WfTrainingSchema = SchemaFactory.createForClass(WfTraining);
WfTrainingSchema.index({ projectId: 1, scheduledDate: -1 });
