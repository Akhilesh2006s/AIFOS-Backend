import { Injectable, BadRequestException } from '@nestjs/common';
import { ProjectsService } from '../projects/projects.service';
import { ProcurementService } from '../procurement/procurement.service';
import { InventoryService } from '../inventory/inventory.service';
import { ConsumptionService } from '../consumption/consumption.service';

/** Orchestrates the operational chain across clouds */
@Injectable()
export class WorkflowService {
  constructor(
    private projects: ProjectsService,
    private procurement: ProcurementService,
    private inventory: InventoryService,
    private consumption: ConsumptionService,
  ) {}

  async sendRequirementToProcurement(mrId: string) {
    const mr = await this.projects.findMaterialRequirementById(mrId);
    if (!['draft', 'submitted', 'approved'].includes(mr.status)) {
      throw new BadRequestException('Material requirement already in procurement');
    }
    const pr = await this.procurement.createPRFromMaterialRequirement(mr);
    await this.projects.markMaterialRequirementInProcurement(mrId, pr._id.toString());
    return { step: 'material_requirement → purchase_requisition', mr, pr };
  }

  async approveAndCreateRfq(prId: string, approvedBy: string, level: number, vendorIds: string[]) {
    const pr = await this.procurement.approvePR(prId, level, approvedBy);
    if (pr.status !== 'approved') {
      return { step: `approval_level_${level}`, pr, rfq: null };
    }
    const rfq = await this.procurement.createRfqFromPR(prId, vendorIds);
    return { step: 'purchase_requisition → rfq', pr, rfq };
  }

  async awardAndCreatePO(rfqId: string, quotationId: string) {
    const po = await this.procurement.awardQuotation(rfqId, quotationId);
    return { step: 'rfq → purchase_order', po };
  }

  async receiveGoods(
    poId: string,
    warehouseId: string,
    lines: Array<{
      materialId: string;
      orderedQty: number;
      receivedQty: number;
      acceptedQty: number;
      rejectedQty: number;
      unit: string;
    }>,
    receivedBy?: string,
  ) {
    const grn = await this.inventory.createGrnFromPO(poId, warehouseId, lines, receivedBy);
    return { step: 'purchase_order → grn → stock', grn };
  }

  async issueToSiteAndRecord(data: {
    warehouseId: string;
    projectId: string;
    siteId: string;
    issuedTo?: string;
    lines: Array<{ materialId: string; quantity: number; unit: string }>;
  }) {
    const issue = await this.inventory.issueToSite(data);
    const consumption = await this.consumption.recordFromMaterialIssue(issue._id.toString());
    return { step: 'warehouse → site_store → consumption_ready', issue, consumption };
  }

  async getProjectPipeline(projectId: string) {
    const flow = await this.projects.getProjectFlow(projectId);
    const prs = (await this.procurement.findAllPRs()).filter((p) => p.projectId === projectId);
    const pos = (await this.procurement.findAllPOs()).filter((p) => p.projectId === projectId);
    const grns = (await this.inventory.findAllGrns()).filter((g) => g.projectId === projectId);
    const issues = (await this.inventory.findAllIssues()).filter((i) => i.projectId === projectId);
    const stores = await this.consumption.getSiteStores(projectId);
    return { ...flow, purchaseRequisitions: prs, purchaseOrders: pos, grns, materialIssues: issues, siteStores: stores };
  }
}
