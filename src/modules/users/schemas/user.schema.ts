import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ timestamps: true, collection: 'core_users' })
export class User {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true, select: false })
  password: string;

  @Prop({ default: 'user' })
  role: string;

  @Prop({ type: [String], default: [] })
  permissions: string[];

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  department?: string;

  @Prop()
  phone?: string;

  @Prop()
  avatar?: string;

  @Prop({ type: Date })
  lastLoginAt?: Date;

  @Prop({ default: 'bekem' })
  organizationId?: string;

  @Prop({ type: [String], default: [] })
  assignedProjectIds: string[];

  @Prop({ type: [String], default: [] })
  assignedSiteIds: string[];

  @Prop()
  assignedTeamId?: string;

  @Prop({ default: false })
  isLocked: boolean;

  @Prop({ default: 'active', enum: ['active', 'inactive', 'pending', 'locked'] })
  status: string;

  @Prop({ type: [String], default: [] })
  documents: string[];

  @Prop({ type: Date })
  passwordChangedAt?: Date;

  @Prop({ default: false })
  mustResetPassword: boolean;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop({ type: Date })
  deletedAt?: Date;

  @Prop({ default: 0 })
  failedLoginAttempts: number;

  @Prop({ type: Date })
  lockedUntil?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index({ role: 1 });
