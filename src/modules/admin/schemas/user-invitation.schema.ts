import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UserInvitationDocument = UserInvitation & Document;

@Schema({ timestamps: true, collection: 'core_user_invitations' })
export class UserInvitation {
  @Prop({ required: true, lowercase: true, trim: true })
  email: string;

  @Prop({ type: Types.ObjectId, ref: 'Organization' })
  organizationId?: Types.ObjectId;

  @Prop({ default: 'user' })
  role: string;

  @Prop({ select: false })
  temporaryPassword?: string;

  @Prop({ default: 'pending', enum: ['pending', 'accepted', 'expired', 'revoked'] })
  status: string;

  @Prop()
  invitedBy?: string;

  @Prop({ type: Date })
  expiresAt?: Date;

  @Prop({ default: 0 })
  resendCount: number;

  @Prop({ type: [String], default: [] })
  assignedProjectIds: string[];

  @Prop()
  department?: string;
}

export const UserInvitationSchema = SchemaFactory.createForClass(UserInvitation);
UserInvitationSchema.index({ email: 1, status: 1 });
UserInvitationSchema.index({ organizationId: 1 });
