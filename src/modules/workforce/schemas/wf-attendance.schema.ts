import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type WfAttendanceDocument = WfAttendance & Document;

@Schema({ timestamps: true, collection: 'wf_attendance' })
export class WfAttendance {
  @Prop({ default: 'bekem' })
  organizationId: string;

  @Prop({ required: true })
  employeeId: string;

  @Prop()
  employeeName?: string;

  @Prop({ required: true })
  projectId: string;

  @Prop()
  siteId?: string;

  @Prop()
  checkInAt?: Date;

  @Prop()
  checkOutAt?: Date;

  @Prop({ default: 'day' })
  shift: string;

  @Prop()
  geoLocation?: string;

  @Prop({ default: 'checked_in' })
  status: string;

  @Prop({ default: 0 })
  overtimeHours: number;

  @Prop()
  createdBy?: string;
}

export const WfAttendanceSchema = SchemaFactory.createForClass(WfAttendance);
WfAttendanceSchema.index({ employeeId: 1, checkInAt: -1 });
WfAttendanceSchema.index({ projectId: 1, checkInAt: -1 });
