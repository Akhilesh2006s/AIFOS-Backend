import { NotFoundException } from '@nestjs/common';
import { Model, Document } from 'mongoose';

export async function findByIdOrThrow<T extends Document>(
  model: Model<T>,
  id: string,
): Promise<T> {
  const doc = await model.findById(id);
  if (!doc) throw new NotFoundException('Record not found');
  return doc;
}

export async function updateByIdOrThrow<T extends Document>(
  model: Model<T>,
  id: string,
  data: Partial<T>,
): Promise<T> {
  const doc = await model.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  if (!doc) throw new NotFoundException('Record not found');
  return doc;
}

export async function deleteByIdOrThrow<T extends Document>(
  model: Model<T>,
  id: string,
): Promise<void> {
  const result = await model.findByIdAndDelete(id);
  if (!result) throw new NotFoundException('Record not found');
}
