import {
  Controller, Get, Post, Patch, Body, Param, Query, Req, OnModuleInit,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { WorkforceService } from './workforce.service';
import { WorkforceSafetyService } from './workforce-safety.service';
import { WorkforcePermitService } from './workforce-permit.service';
import { WorkforceQualityService } from './workforce-quality.service';
import { WorkforceIntelligenceService } from './workforce-intelligence.service';
import {
  CreateEmployeeDto, UpdateEmployeeDto, CreateContractorDto,
  CreateTeamDto, CreateAllocationDto, CheckInDto, CheckOutDto,
} from './dto/workforce.dto';
import {
  CreateIncidentDto, CreateNearMissDto, CreateObservationDto, CreateToolboxTalkDto,
  IssuePpeDto, ReturnPpeDto, UpdateEmergencyDto, UpdateNearMissDto, UpdateObservationDto,
} from './dto/safety.dto';
import { CreatePermitDto, PermitActionDto, UpdatePermitDto } from './dto/permit.dto';
import {
  CreateInspectionDto, UpdateInspectionDto, CreateMaterialTestDto,
  CreateChecklistDto, CreateNcrDto, UpdateNcrDto, CreateCapaDto, UpdateCapaDto, QualityActionDto,
} from './dto/quality.dto';
import {
  CreateProductivityDto, CreateTrainingDto, CreateSkillDto, CreateCertificationDto,
} from './dto/intelligence.dto';
import { isStartupSeedEnabled } from '../../common/config/startup-seed';

@ApiTags('Workforce')
@ApiBearerAuth()
@Controller('workforce')
export class WorkforceController implements OnModuleInit {
  constructor(
    private readonly service: WorkforceService,
    private readonly safety: WorkforceSafetyService,
    private readonly permits: WorkforcePermitService,
    private readonly quality: WorkforceQualityService,
    private readonly intelligence: WorkforceIntelligenceService,
  ) {}

  async onModuleInit() {
    if (!isStartupSeedEnabled()) return;
    await this.service.seedIfEmpty();
    await this.safety.seedIfEmpty();
    await this.permits.seedIfEmpty();
    await this.quality.seedIfEmpty();
    await this.intelligence.seedIfEmpty();
  }

  private actor(req: { user?: { sub?: string; name?: string } }) {
    return req.user?.name || req.user?.sub || 'system';
  }

  @Get('dashboard')
  dashboard(@Query('projectId') projectId?: string) {
    return this.service.getDashboard(projectId);
  }

  @Get('employees')
  employees(@Query('projectId') projectId?: string) {
    return this.service.listEmployees(projectId);
  }

  @Get('employees/:id')
  employee(@Param('id') id: string) {
    return this.service.getEmployee(id);
  }

  @Post('employees')
  createEmployee(
    @Body() dto: CreateEmployeeDto,
    @Req() req: { user?: { sub?: string; name?: string } },
  ) {
    return this.service.createEmployee(dto, this.actor(req));
  }

  @Patch('employees/:id')
  updateEmployee(
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
    @Req() req: { user?: { sub?: string; name?: string } },
  ) {
    return this.service.updateEmployee(id, dto, this.actor(req));
  }

  @Get('contractors')
  contractors(@Query('projectId') projectId?: string) {
    return this.service.listContractors(projectId);
  }

  @Post('contractors')
  createContractor(
    @Body() dto: CreateContractorDto,
    @Req() req: { user?: { sub?: string; name?: string } },
  ) {
    return this.service.createContractor(dto, this.actor(req));
  }

  @Get('teams')
  teams(@Query('projectId') projectId?: string) {
    return this.service.listTeams(projectId);
  }

  @Post('teams')
  createTeam(
    @Body() dto: CreateTeamDto,
    @Req() req: { user?: { sub?: string; name?: string } },
  ) {
    return this.service.createTeam(dto, this.actor(req));
  }

  @Get('allocations')
  allocations(@Query('projectId') projectId?: string) {
    return this.service.listAllocations(projectId);
  }

  @Post('allocations')
  createAllocation(
    @Body() dto: CreateAllocationDto,
    @Req() req: { user?: { sub?: string; name?: string } },
  ) {
    return this.service.createAllocation(dto, this.actor(req));
  }

  @Get('attendance')
  attendance(
    @Query('projectId') projectId?: string,
    @Query('employeeId') employeeId?: string,
  ) {
    return this.service.listAttendance(projectId, employeeId);
  }

  @Post('attendance/checkin')
  checkIn(
    @Body() dto: CheckInDto,
    @Req() req: { user?: { sub?: string; name?: string } },
  ) {
    return this.service.checkIn(dto, this.actor(req));
  }

  @Post('attendance/:id/checkout')
  checkOut(
    @Param('id') id: string,
    @Body() dto: CheckOutDto,
    @Req() req: { user?: { sub?: string; name?: string } },
  ) {
    return this.service.checkOut(id, dto, this.actor(req));
  }

  // ─── Safety (Sprint W2) ────────────────────────────────────────────────────

  @Get('safety/dashboard')
  safetyDashboard(@Query('projectId') projectId?: string) {
    return this.safety.getSafetyDashboard(projectId);
  }

  @Get('safety/ppe')
  listPpe(@Query('projectId') projectId?: string) {
    return this.safety.listPpe(projectId);
  }

  @Post('safety/ppe/issue')
  issuePpe(
    @Body() dto: IssuePpeDto,
    @Req() req: { user?: { sub?: string; name?: string } },
  ) {
    return this.safety.issuePpe(dto, this.actor(req));
  }

  @Post('safety/ppe/:id/return')
  returnPpe(
    @Param('id') id: string,
    @Body() dto: ReturnPpeDto,
    @Req() req: { user?: { sub?: string; name?: string } },
  ) {
    return this.safety.returnPpe(id, dto, this.actor(req));
  }

  @Get('safety/toolbox-talks')
  toolboxTalks(@Query('projectId') projectId?: string) {
    return this.safety.listToolboxTalks(projectId);
  }

  @Post('safety/toolbox-talks')
  createToolboxTalk(
    @Body() dto: CreateToolboxTalkDto,
    @Req() req: { user?: { sub?: string; name?: string } },
  ) {
    return this.safety.createToolboxTalk(dto, this.actor(req));
  }

  @Get('safety/incidents')
  incidents(@Query('projectId') projectId?: string) {
    return this.safety.listIncidents(projectId);
  }

  @Post('safety/incidents')
  createIncident(
    @Body() dto: CreateIncidentDto,
    @Req() req: { user?: { sub?: string; name?: string } },
  ) {
    return this.safety.createIncident(dto, this.actor(req));
  }

  @Get('safety/near-miss')
  nearMiss(@Query('projectId') projectId?: string) {
    return this.safety.listNearMiss(projectId);
  }

  @Post('safety/near-miss')
  createNearMiss(
    @Body() dto: CreateNearMissDto,
    @Req() req: { user?: { sub?: string; name?: string } },
  ) {
    return this.safety.createNearMiss(dto, this.actor(req));
  }

  @Patch('safety/near-miss/:id')
  updateNearMiss(
    @Param('id') id: string,
    @Body() dto: UpdateNearMissDto,
    @Req() req: { user?: { sub?: string; name?: string } },
  ) {
    return this.safety.updateNearMiss(id, dto, this.actor(req));
  }

  @Get('safety/observations')
  observations(@Query('projectId') projectId?: string) {
    return this.safety.listObservations(projectId);
  }

  @Post('safety/observations')
  createObservation(
    @Body() dto: CreateObservationDto,
    @Req() req: { user?: { sub?: string; name?: string } },
  ) {
    return this.safety.createObservation(dto, this.actor(req));
  }

  @Patch('safety/observations/:id')
  updateObservation(
    @Param('id') id: string,
    @Body() dto: UpdateObservationDto,
    @Req() req: { user?: { sub?: string; name?: string } },
  ) {
    return this.safety.updateObservation(id, dto, this.actor(req));
  }

  @Get('safety/emergency')
  emergency(@Query('projectId') projectId: string) {
    return this.safety.getEmergency(projectId);
  }

  @Patch('safety/emergency')
  updateEmergency(
    @Query('projectId') projectId: string,
    @Body() dto: UpdateEmergencyDto,
    @Req() req: { user?: { sub?: string; name?: string } },
  ) {
    return this.safety.updateEmergency(projectId, dto, this.actor(req));
  }

  // ─── Permit to Work (Sprint W3) ────────────────────────────────────────────

  @Get('permits/dashboard')
  permitsDashboard(@Query('projectId') projectId?: string) {
    return this.permits.getDashboard(projectId);
  }

  @Get('permits/search')
  searchPermits(@Query('q') q: string, @Query('projectId') projectId?: string) {
    return this.permits.searchPermits(q || '', projectId);
  }

  @Get('permits')
  listPermits(
    @Query('projectId') projectId?: string,
    @Query('status') status?: string,
    @Query('permitType') permitType?: string,
  ) {
    return this.permits.listPermits(projectId, { status, permitType });
  }

  @Get('permits/:id')
  getPermit(@Param('id') id: string) {
    return this.permits.getPermit(id);
  }

  @Post('permits')
  createPermit(
    @Body() dto: CreatePermitDto,
    @Req() req: { user?: { sub?: string; name?: string } },
  ) {
    return this.permits.createPermit(dto, this.actor(req));
  }

  @Patch('permits/:id')
  updatePermit(
    @Param('id') id: string,
    @Body() dto: UpdatePermitDto,
    @Req() req: { user?: { sub?: string; name?: string } },
  ) {
    return this.permits.updatePermit(id, dto, this.actor(req));
  }

  @Post('permits/:id/submit')
  submitPermit(@Param('id') id: string, @Body() dto: PermitActionDto, @Req() req: { user?: { sub?: string; name?: string } }) {
    return this.permits.submit(id, dto, this.actor(req));
  }

  @Post('permits/:id/review')
  reviewPermit(@Param('id') id: string, @Body() dto: PermitActionDto, @Req() req: { user?: { sub?: string; name?: string } }) {
    return this.permits.review(id, dto, this.actor(req));
  }

  @Post('permits/:id/approve')
  approvePermit(@Param('id') id: string, @Body() dto: PermitActionDto, @Req() req: { user?: { sub?: string; name?: string } }) {
    return this.permits.approve(id, dto, this.actor(req));
  }

  @Post('permits/:id/reject')
  rejectPermit(@Param('id') id: string, @Body() dto: PermitActionDto, @Req() req: { user?: { sub?: string; name?: string } }) {
    return this.permits.reject(id, dto, this.actor(req));
  }

  @Post('permits/:id/start')
  startPermit(@Param('id') id: string, @Body() dto: PermitActionDto, @Req() req: { user?: { sub?: string; name?: string } }) {
    return this.permits.start(id, dto, this.actor(req));
  }

  @Post('permits/:id/suspend')
  suspendPermit(@Param('id') id: string, @Body() dto: PermitActionDto, @Req() req: { user?: { sub?: string; name?: string } }) {
    return this.permits.suspend(id, dto, this.actor(req));
  }

  @Post('permits/:id/complete')
  completePermit(@Param('id') id: string, @Body() dto: PermitActionDto, @Req() req: { user?: { sub?: string; name?: string } }) {
    return this.permits.complete(id, dto, this.actor(req));
  }

  @Post('permits/:id/close')
  closePermit(@Param('id') id: string, @Body() dto: PermitActionDto, @Req() req: { user?: { sub?: string; name?: string } }) {
    return this.permits.close(id, dto, this.actor(req));
  }

  // ─── Quality Management ────────────────────────────────────────────────────

  @Get('quality/dashboard')
  qualityDashboard(@Query('projectId') projectId?: string) {
    return this.quality.getDashboard(projectId);
  }

  @Get('quality/search')
  qualitySearch(@Query('q') q: string, @Query('projectId') projectId?: string) {
    return this.quality.searchQuality(q || '', projectId);
  }

  @Get('quality/inspections')
  listInspections(
    @Query('projectId') projectId?: string,
    @Query('status') status?: string,
    @Query('inspectionType') inspectionType?: string,
  ) {
    return this.quality.listInspections(projectId, { status, inspectionType });
  }

  @Get('quality/inspections/:id')
  getInspection(@Param('id') id: string) {
    return this.quality.getInspection(id);
  }

  @Post('quality/inspections')
  createInspection(@Body() dto: CreateInspectionDto, @Req() req: { user?: { sub?: string; name?: string } }) {
    return this.quality.createInspection(dto, this.actor(req));
  }

  @Patch('quality/inspections/:id')
  updateInspection(@Param('id') id: string, @Body() dto: UpdateInspectionDto, @Req() req: { user?: { sub?: string; name?: string } }) {
    return this.quality.updateInspection(id, dto, this.actor(req));
  }

  @Get('quality/tests')
  listTests(
    @Query('projectId') projectId?: string,
    @Query('result') result?: string,
    @Query('testType') testType?: string,
  ) {
    return this.quality.listTests(projectId, { result, testType });
  }

  @Get('quality/tests/:id')
  getTest(@Param('id') id: string) {
    return this.quality.getTest(id);
  }

  @Post('quality/tests')
  createTest(@Body() dto: CreateMaterialTestDto, @Req() req: { user?: { sub?: string; name?: string } }) {
    return this.quality.createTest(dto, this.actor(req));
  }

  @Get('quality/checklists')
  listChecklists(@Query('projectId') projectId?: string) {
    return this.quality.listChecklists(projectId);
  }

  @Get('quality/checklists/:id')
  getChecklist(@Param('id') id: string) {
    return this.quality.getChecklist(id);
  }

  @Post('quality/checklists')
  createChecklist(@Body() dto: CreateChecklistDto, @Req() req: { user?: { sub?: string; name?: string } }) {
    return this.quality.createChecklist(dto, this.actor(req));
  }

  @Get('quality/ncr')
  listNcr(@Query('projectId') projectId?: string, @Query('status') status?: string) {
    return this.quality.listNcr(projectId, { status });
  }

  @Get('quality/ncr/:id')
  getNcr(@Param('id') id: string) {
    return this.quality.getNcr(id);
  }

  @Post('quality/ncr')
  createNcr(@Body() dto: CreateNcrDto, @Req() req: { user?: { sub?: string; name?: string } }) {
    return this.quality.createNcr(dto, this.actor(req));
  }

  @Patch('quality/ncr/:id')
  updateNcr(@Param('id') id: string, @Body() dto: UpdateNcrDto, @Req() req: { user?: { sub?: string; name?: string } }) {
    return this.quality.updateNcr(id, dto, this.actor(req));
  }

  @Post('quality/ncr/:id/close')
  closeNcr(@Param('id') id: string, @Body() dto: QualityActionDto, @Req() req: { user?: { sub?: string; name?: string } }) {
    return this.quality.closeNcr(id, this.actor(req), dto.comment);
  }

  @Get('quality/capa')
  listCapa(
    @Query('projectId') projectId?: string,
    @Query('status') status?: string,
    @Query('capaType') capaType?: string,
  ) {
    return this.quality.listCapa(projectId, { status, capaType });
  }

  @Get('quality/capa/:id')
  getCapa(@Param('id') id: string) {
    return this.quality.getCapa(id);
  }

  @Post('quality/capa')
  createCapa(@Body() dto: CreateCapaDto, @Req() req: { user?: { sub?: string; name?: string } }) {
    return this.quality.createCapa(dto, this.actor(req));
  }

  @Patch('quality/capa/:id')
  updateCapa(@Param('id') id: string, @Body() dto: UpdateCapaDto, @Req() req: { user?: { sub?: string; name?: string } }) {
    return this.quality.updateCapa(id, dto, this.actor(req));
  }

  // ─── Productivity, Training, Skills, Certifications, Performance (W5) ───

  @Get('productivity/dashboard')
  productivityDashboard(@Query('projectId') projectId?: string) {
    return this.intelligence.getProductivityDashboard(projectId);
  }

  @Get('productivity')
  listProductivity(@Query('projectId') projectId?: string) {
    return this.intelligence.listProductivity(projectId);
  }

  @Post('productivity')
  createProductivity(@Body() dto: CreateProductivityDto, @Req() req: { user?: { sub?: string; name?: string } }) {
    return this.intelligence.createProductivity(dto, this.actor(req));
  }

  @Get('training')
  listTraining(@Query('projectId') projectId?: string) {
    return this.intelligence.listTraining(projectId);
  }

  @Post('training')
  createTraining(@Body() dto: CreateTrainingDto, @Req() req: { user?: { sub?: string; name?: string } }) {
    return this.intelligence.createTraining(dto, this.actor(req));
  }

  @Get('skills')
  listSkills(@Query('projectId') projectId?: string, @Query('employeeId') employeeId?: string) {
    return this.intelligence.listSkills(projectId, employeeId);
  }

  @Post('skills')
  createSkill(@Body() dto: CreateSkillDto, @Req() req: { user?: { sub?: string; name?: string } }) {
    return this.intelligence.createSkill(dto, this.actor(req));
  }

  @Get('certifications')
  listCertifications(@Query('projectId') projectId?: string, @Query('employeeId') employeeId?: string) {
    return this.intelligence.listCertifications(projectId, employeeId);
  }

  @Post('certifications')
  createCertification(@Body() dto: CreateCertificationDto, @Req() req: { user?: { sub?: string; name?: string } }) {
    return this.intelligence.createCertification(dto, this.actor(req));
  }

  @Get('performance')
  getPerformance(@Query('projectId') projectId?: string) {
    return this.intelligence.getPerformance(projectId);
  }

  @Get('intelligence')
  getIntelligence(@Query('projectId') projectId?: string) {
    return this.intelligence.getIntelligence(projectId);
  }

  @Get('w5/dashboard')
  w5Dashboard(@Query('projectId') projectId?: string) {
    return this.intelligence.getWorkforceDashboard(projectId);
  }
}
