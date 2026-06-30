import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

export interface TenantStore {
  organizationId?: string;
  isSuperAdmin?: boolean;
}

@Injectable()
export class TenantContextService {
  private readonly als = new AsyncLocalStorage<TenantStore>();

  run<T>(store: TenantStore, fn: () => T): T {
    return this.als.run(store, fn);
  }

  getStore(): TenantStore | undefined {
    return this.als.getStore();
  }

  getOrganizationId(): string | undefined {
    return this.als.getStore()?.organizationId;
  }

  orgFilter(): Record<string, string> {
    const id = this.getOrganizationId();
    return id ? { organizationId: id } : {};
  }

  mergeFilter<T extends Record<string, unknown>>(filter: T = {} as T): T & Record<string, string> {
    return { ...filter, ...this.orgFilter() } as T & Record<string, string>;
  }
}
