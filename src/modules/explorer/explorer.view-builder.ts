import {
  ExplorerChainNode,
  ExplorerEntityType,
  ExplorerIntelligence,
  ExplorerView,
  ChainNodeStatus,
} from './explorer.types';

type Doc = Record<string, unknown>;

export function pickTitle(doc: Doc, fields: string[]): string {
  for (const f of fields) {
    const v = doc[f];
    if (v != null && String(v).trim()) return String(v);
  }
  return 'Untitled';
}

export function pickSubtitle(doc: Doc, fields?: string[]): string {
  if (!fields) return '';
  return fields.map((f) => doc[f]).filter(Boolean).join(' · ') || '';
}

export function statusFromDoc(doc: Doc, field?: string): string {
  if (!field) return 'active';
  return String(doc[field] ?? 'unknown');
}

export function chainStatusForValue(status: string): ChainNodeStatus {
  const s = status.toLowerCase();
  if (['complete', 'completed', 'approved', 'paid', 'closed', 'valid'].includes(s)) return 'complete';
  if (['blocked', 'exception', 'rejected', 'expired'].includes(s)) return 'blocked';
  if (['delayed', 'overdue'].includes(s)) return 'delayed';
  if (['pending', 'waiting', 'submitted', 'pending_l1', 'pending_l2', 'pending_qc', 'matching'].includes(s)) return 'waiting';
  if (['active', 'in_progress', 'issued', 'running', 'open'].includes(s)) return 'active';
  if (['draft', 'not_started', 'cancelled'].includes(s)) return 'not_started';
  return 'waiting';
}

export function splitChain(chain: ExplorerChainNode[], currentKey?: string) {
  const idx = currentKey ? chain.findIndex((c) => c.key === currentKey) : Math.max(0, chain.length - 1);
  const i = idx >= 0 ? idx : 0;
  return { upstream: chain.slice(0, i), downstream: chain.slice(i + 1) };
}

export function buildBreadcrumbs(view: Partial<ExplorerView>): ExplorerView['breadcrumbs'] {
  const crumbs: ExplorerView['breadcrumbs'] = [{ label: 'Mission Control' }];
  if (view.projectName && view.projectId) {
    crumbs.push({ label: view.projectName, entityType: 'project', entityId: view.projectId });
  }
  if (view.title) crumbs.push({ label: view.title });
  return crumbs;
}

export function finalizeExplorerView(
  partial: Omit<ExplorerView, 'upstream' | 'downstream' | 'breadcrumbs'> & {
    currentChainKey?: string;
    upstream?: ExplorerChainNode[];
    downstream?: ExplorerChainNode[];
    breadcrumbs?: ExplorerView['breadcrumbs'];
  },
): ExplorerView {
  const { currentChainKey, ...rest } = partial;
  const split = partial.upstream && partial.downstream
    ? { upstream: partial.upstream, downstream: partial.downstream }
    : splitChain(partial.chain, currentChainKey);
  return {
    ...rest,
    upstream: split.upstream,
    downstream: split.downstream,
    breadcrumbs: partial.breadcrumbs ?? buildBreadcrumbs(partial),
  };
}

export function generateIntelligence(
  entityType: ExplorerEntityType,
  doc: Doc,
  context: {
    grnStatus?: string;
    grnNumber?: string;
    prStatus?: string;
    prNumber?: string;
    permitExpiryDays?: number;
    milestoneName?: string;
    certExpired?: boolean;
    matchSummary?: { grnPresent?: boolean };
  } = {},
): ExplorerIntelligence | undefined {
  const status = String(doc.status ?? doc.currentStatus ?? doc.approvalStatus ?? '').toLowerCase();
  const blockers: string[] = [];

  if (entityType === 'vendor-bill') {
    if (['exception', 'matching'].includes(status)) {
      if (!context.matchSummary?.grnPresent && !doc.grnId) {
        blockers.push('GRN not linked');
        const grnRef = context.grnNumber ?? 'GRN';
        return {
          recommendation: `This Vendor Bill cannot be paid because ${grnRef} is pending or not matched.`,
          severity: 'critical',
          actionLabel: 'Resolve GRN match',
          blockers,
        };
      }
      return {
        recommendation: 'Three-way match exception — resolve PO/GRN variance before payment release.',
        severity: 'high',
        actionLabel: 'Review exceptions',
        blockers: ['PO/GRN/Bill variance'],
      };
    }
    if (status === 'ready_for_payment') {
      return { recommendation: 'Bill approved — schedule payment to avoid vendor relationship risk.', severity: 'medium', actionLabel: 'Schedule payment' };
    }
  }

  if (entityType === 'equipment' && ['idle', 'available'].includes(status)) {
    const pr = context.prNumber ?? 'PR-1024';
    if (context.prStatus?.includes('pending')) {
      return {
        recommendation: `This Equipment remains idle because ${pr} has not been approved.`,
        severity: 'high',
        actionLabel: `Approve ${pr}`,
        blockers: [`${pr} pending approval`],
      };
    }
    return { recommendation: 'Equipment idle — redeploy to active chainage or release to pool.', severity: 'medium' };
  }

  if (entityType === 'permit' && context.permitExpiryDays != null && context.permitExpiryDays <= 2) {
    const ms = context.milestoneName ?? 'downstream work';
    return {
      recommendation: `This Permit expires in ${context.permitExpiryDays} day(s) and blocks ${ms}.`,
      severity: context.permitExpiryDays <= 1 ? 'critical' : 'high',
      actionLabel: 'Renew permit',
      blockers: ['Permit expiry'],
    };
  }

  if (entityType === 'employee' && context.certExpired) {
    return {
      recommendation: 'This Employee cannot be allocated because certification expired.',
      severity: 'critical',
      actionLabel: 'Renew certification',
      blockers: ['Expired certification'],
    };
  }

  if (entityType === 'purchase-request' && status.includes('pending')) {
    return {
      recommendation: 'Approval pending — downstream PO, GRN, and site consumption are blocked.',
      severity: status.includes('l2') ? 'critical' : 'high',
      actionLabel: 'Approve PR',
      blockers: ['Finance/procurement approval'],
    };
  }

  if (entityType === 'grn' && ['pending_qc', 'pending'].includes(status)) {
    return {
      recommendation: `GRN ${doc.grnNumber ?? ''} pending QC — vendor bills and material issue remain blocked.`,
      severity: 'high',
      actionLabel: 'Complete GRN QC',
    };
  }

  if (entityType === 'ncr' && ['open', 'assigned'].includes(status)) {
    return { recommendation: 'Open NCR on critical path — link CAPA and notify project director.', severity: 'high', actionLabel: 'Open CAPA' };
  }

  return undefined;
}

export function buildWorkflowFromStatus(
  entityType: ExplorerEntityType,
  status: string,
  owner?: string,
): ExplorerView['workflow'] {
  const steps: NonNullable<ExplorerView['workflow']>['steps'] = [];
  const s = status.toLowerCase();

  if (entityType === 'purchase-request') {
    steps.push(
      { label: 'Submitted', status: 'complete' },
      { label: 'L1 Approval', status: s.includes('pending_l1') ? 'waiting' : 'complete' },
      { label: 'L2 Approval', status: s.includes('pending_l2') ? 'waiting' : s === 'approved' ? 'complete' : 'not_started' },
      { label: 'RFQ / PO', status: s === 'approved' ? 'active' : 'not_started' },
    );
    return {
      stage: 'Procurement approval',
      position: s.replace(/_/g, ' '),
      pendingWith: s.includes('pending') ? owner ?? 'Approver' : undefined,
      steps,
    };
  }

  if (entityType === 'vendor-bill') {
    steps.push(
      { label: 'Submitted', status: ['draft'].includes(s) ? 'not_started' : 'complete' },
      { label: '3-Way Match', status: ['matching', 'exception'].includes(s) ? 'blocked' : ['submitted'].includes(s) ? 'waiting' : 'complete' },
      { label: 'Approved', status: ['approved', 'ready_for_payment', 'paid'].includes(s) ? 'complete' : 'waiting' },
      { label: 'Payment', status: s === 'paid' ? 'complete' : s === 'ready_for_payment' ? 'waiting' : 'not_started' },
    );
    return { stage: 'Accounts payable', position: s.replace(/_/g, ' '), pendingWith: s === 'exception' ? 'Finance' : undefined, steps };
  }

  return {
    stage: entityType.replace(/-/g, ' '),
    position: s.replace(/_/g, ' '),
    pendingWith: owner,
    steps: [{ label: 'Current status', status: chainStatusForValue(status), detail: status }],
  };
}
