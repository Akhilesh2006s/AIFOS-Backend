import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VendorProfile, VendorProfileSchema } from './schemas/vendor-profile.schema';
import { VendorsService } from './vendors.service';
import { VendorsController } from './vendors.controller';

@Module({
  imports: [MongooseModule.forFeature([{ name: VendorProfile.name, schema: VendorProfileSchema }])],
  controllers: [VendorsController],
  providers: [VendorsService],
  exports: [VendorsService],
})
export class VendorsModule {}
