import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { Document, Types } from 'mongoose';



export type DailyReportDocument = DailyReport & Document;



@Schema({ timestamps: true, collection: 'proj_daily_reports' })

export class DailyReport {

  @Prop({ default: 'bekem', index: true })

  organizationId: string;



  @Prop({ type: Types.ObjectId, ref: 'Project', required: true, index: true })

  projectId: Types.ObjectId;



  @Prop()

  siteId?: string;



  @Prop({ type: Date, required: true })

  reportDate: Date;



  @Prop({ required: true })

  summary: string;



  @Prop()

  weather?: string;



  @Prop()

  delays?: string;



  @Prop({ type: [String], default: [] })

  issueIds: string[];



  @Prop({ default: 0 })

  progressPercent: number;



  @Prop({ type: [String], default: [] })

  photoUrls: string[];



  @Prop({ type: [String], default: [] })

  photoDocumentIds: string[];



  @Prop()

  reportedBy?: string;



  @Prop()

  createdBy?: string;



  @Prop({ default: 'draft' })

  approvalStatus: string;



  @Prop()

  submittedBy?: string;



  @Prop({ type: Date })

  submittedAt?: Date;

}



export const DailyReportSchema = SchemaFactory.createForClass(DailyReport);


