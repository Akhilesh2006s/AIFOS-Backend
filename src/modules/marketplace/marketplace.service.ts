import { Injectable, NotFoundException, BadRequestException, ForbiddenException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConnectorManagerService } from '../integrations/connector-manager.service';
import { TenantContextService } from '../platform/tenant-context.service';
import {
  MARKETPLACE_SEED_PLUGINS,
  PLUGIN_TYPE_LABELS,
  SDK_MANIFEST,
  SDK_VERSION,
} from './marketplace.constants';
import { InstallPluginDto, PublishPluginDto, PublishVersionDto, RatePluginDto } from './dto/marketplace.dto';
import { MktPlugin, MktPluginDocument } from './schemas/mkt-plugin.schema';
import { MktPluginVersion, MktPluginVersionDocument } from './schemas/mkt-plugin-version.schema';
import { MktInstallation, MktInstallationDocument } from './schemas/mkt-installation.schema';
import { MktRating, MktRatingDocument } from './schemas/mkt-rating.schema';

@Injectable()
export class MarketplaceService implements OnModuleInit {
  constructor(
    @InjectModel(MktPlugin.name) private pluginModel: Model<MktPluginDocument>,
    @InjectModel(MktPluginVersion.name) private versionModel: Model<MktPluginVersionDocument>,
    @InjectModel(MktInstallation.name) private installModel: Model<MktInstallationDocument>,
    @InjectModel(MktRating.name) private ratingModel: Model<MktRatingDocument>,
    private connectors: ConnectorManagerService,
    private tenant: TenantContextService,
  ) {}

  async onModuleInit() {
    if (process.env.SEED_DEMO === 'true') {
      await this.seedCatalog();
    }
  }

  private resolveOrg(override?: string) {
    const orgId = this.tenant.getOrganizationId();
    const isSuperAdmin = this.tenant.getStore()?.isSuperAdmin;
    if (override) {
      if (isSuperAdmin || override === orgId) return override;
      throw new ForbiddenException('Cannot access another organization');
    }
    return orgId || 'bekem';
  }

  private serializePlugin(p: MktPluginDocument, installed?: boolean) {
    return {
      id: p.pluginId,
      pluginId: p.pluginId,
      name: p.name,
      type: p.type,
      typeLabel: PLUGIN_TYPE_LABELS[p.type as keyof typeof PLUGIN_TYPE_LABELS] || p.type,
      version: p.currentVersion,
      publisher: p.publisher,
      description: p.description,
      category: p.category,
      registryId: p.registryId,
      icon: p.icon,
      tags: p.tags,
      permissions: p.permissions,
      installCount: p.installCount,
      ratingAvg: Math.round(p.ratingAvg * 10) / 10,
      ratingCount: p.ratingCount,
      status: p.status,
      installed: installed ?? false,
      link: `/marketplace?tab=store&type=${p.type}&id=${p.pluginId}`,
    };
  }

  private serializeInstallation(i: MktInstallationDocument, plugin?: MktPluginDocument) {
    const updateAvailable = plugin && plugin.currentVersion !== i.installedVersion;
    return {
      id: String(i._id),
      organizationId: i.organizationId,
      pluginId: i.pluginId,
      pluginName: i.pluginName,
      pluginType: i.pluginType,
      installedVersion: i.installedVersion,
      latestVersion: plugin?.currentVersion,
      updateAvailable: Boolean(updateAvailable),
      connectorInstanceId: i.connectorInstanceId,
      config: i.config,
      status: i.status,
      installedAt: (i as { createdAt?: Date }).createdAt,
      link: i.pluginType === 'connector' && i.connectorInstanceId
        ? `/integrations?tab=connectors&sub=installed&id=${i.connectorInstanceId}`
        : `/marketplace?tab=installed&id=${i.pluginId}`,
    };
  }

  private compareVersions(a: string, b: string) {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
      const diff = (pa[i] || 0) - (pb[i] || 0);
      if (diff !== 0) return diff;
    }
    return 0;
  }

  async seedCatalog() {
    for (const seed of MARKETPLACE_SEED_PLUGINS) {
      const existing = await this.pluginModel.findOne({ pluginId: seed.pluginId });
      if (!existing) {
        await this.pluginModel.create({
          pluginId: seed.pluginId,
          name: seed.name,
          type: seed.type,
          currentVersion: seed.version,
          publisher: seed.publisher,
          description: seed.description,
          category: seed.category,
          registryId: seed.registryId,
          icon: seed.icon,
          tags: seed.tags || [],
          permissions: seed.permissions || [],
          configPayload: seed.configPayload || {},
          status: 'published',
        });
        await this.versionModel.create({
          pluginId: seed.pluginId,
          version: seed.version,
          sdkVersion: SDK_VERSION,
          changelog: 'Initial release',
          manifest: { ...seed },
          status: 'published',
        });
      }
    }
  }

  async getDashboard(organizationId?: string) {
    const orgId = this.resolveOrg(organizationId);
    const [plugins, installations] = await Promise.all([
      this.pluginModel.find({ status: 'published', isDeleted: false }),
      this.installModel.find({ organizationId: orgId }),
    ]);
    const installedIds = new Set(installations.map((i) => i.pluginId));
    const pendingUpdates = installations.filter((i) => {
      const p = plugins.find((pl) => pl.pluginId === i.pluginId);
      return p && this.compareVersions(p.currentVersion, i.installedVersion) > 0;
    }).length;

    const byType = plugins.reduce((acc, p) => {
      acc[p.type] = (acc[p.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topRated = [...plugins]
      .filter((p) => p.ratingCount > 0)
      .sort((a, b) => b.ratingAvg - a.ratingAvg || b.ratingCount - a.ratingCount)
      .slice(0, 5)
      .map((p) => this.serializePlugin(p, installedIds.has(p.pluginId)));

    return {
      catalogCount: plugins.length,
      installedCount: installations.length,
      pendingUpdates,
      byType,
      topRated,
      stores: {
        connector: `/marketplace?tab=connectors`,
        dashboard: `/marketplace?tab=dashboards`,
        workflow: `/marketplace?tab=workflows`,
        report: `/marketplace?tab=reports`,
      },
      links: {
        marketplace: '/marketplace',
        installed: '/marketplace?tab=installed',
        developer: '/marketplace?tab=developer',
        sdk: '/marketplace?tab=developer&sub=sdk',
      },
    };
  }

  async getOperationsMetrics(organizationId?: string) {
    const dash = await this.getDashboard(organizationId);
    const orgId = this.resolveOrg(organizationId);
    const recent = await this.installModel.find({ organizationId: orgId }).sort({ createdAt: -1 }).limit(4);

    return {
      catalogCount: dash.catalogCount,
      installedCount: dash.installedCount,
      pendingUpdates: dash.pendingUpdates,
      connectorStore: dash.byType.connector || 0,
      dashboardStore: dash.byType.dashboard || 0,
      workflowTemplates: dash.byType.workflow_template || 0,
      reportTemplates: dash.byType.report_template || 0,
      topRated: dash.topRated.slice(0, 3),
      recentInstalls: recent.map((i) => ({
        pluginId: i.pluginId,
        name: i.pluginName,
        type: i.pluginType,
        version: i.installedVersion,
        at: (i as { createdAt?: Date }).createdAt,
        link: `/marketplace?tab=installed&id=${i.pluginId}`,
      })),
      links: dash.links,
    };
  }

  async listPlugins(type?: string, organizationId?: string) {
    const orgId = this.resolveOrg(organizationId);
    const q: Record<string, unknown> = { status: 'published', isDeleted: false };
    if (type) q.type = type;
    const [plugins, installations] = await Promise.all([
      this.pluginModel.find(q).sort({ installCount: -1, name: 1 }),
      this.installModel.find({ organizationId: orgId }),
    ]);
    const installedIds = new Set(installations.map((i) => i.pluginId));
    return plugins.map((p) => this.serializePlugin(p, installedIds.has(p.pluginId)));
  }

  async getPlugin(pluginId: string, organizationId?: string) {
    const orgId = this.resolveOrg(organizationId);
    const plugin = await this.pluginModel.findOne({ pluginId, isDeleted: false });
    if (!plugin) throw new NotFoundException('Plugin not found');
    const [installation, versions, ratings] = await Promise.all([
      this.installModel.findOne({ organizationId: orgId, pluginId }),
      this.versionModel.find({ pluginId }).sort({ createdAt: -1 }),
      this.ratingModel.find({ pluginId }).sort({ createdAt: -1 }).limit(10),
    ]);
    return {
      ...this.serializePlugin(plugin, Boolean(installation)),
      installation: installation ? this.serializeInstallation(installation, plugin) : null,
      versions: versions.map((v) => ({
        version: v.version,
        sdkVersion: v.sdkVersion,
        changelog: v.changelog,
        status: v.status,
        publishedAt: (v as { createdAt?: Date }).createdAt,
      })),
      ratings: ratings.map((r) => ({
        stars: r.stars,
        review: r.review,
        organizationId: r.organizationId,
        at: (r as { createdAt?: Date }).createdAt,
      })),
    };
  }

  async listInstallations(organizationId?: string) {
    const orgId = this.resolveOrg(organizationId);
    const installations = await this.installModel.find({ organizationId: orgId }).sort({ createdAt: -1 });
    const pluginIds = installations.map((i) => i.pluginId);
    const plugins = await this.pluginModel.find({ pluginId: { $in: pluginIds } });
    const pluginMap = new Map(plugins.map((p) => [p.pluginId, p]));
    return installations.map((i) => this.serializeInstallation(i, pluginMap.get(i.pluginId)));
  }

  async installPlugin(pluginId: string, dto: InstallPluginDto, actor = 'admin') {
    const orgId = this.resolveOrg(dto.organizationId);
    const plugin = await this.pluginModel.findOne({ pluginId, status: 'published', isDeleted: false });
    if (!plugin) throw new NotFoundException('Plugin not found');

    const existing = await this.installModel.findOne({ organizationId: orgId, pluginId });
    if (existing) throw new BadRequestException('Plugin already installed for this organization');

    let connectorInstanceId: string | undefined;
    if (plugin.type === 'connector') {
      if (!plugin.registryId) throw new BadRequestException('Connector plugin missing registryId');
      try {
        const connector = await this.connectors.createConnector({ registryId: plugin.registryId }, actor);
        connectorInstanceId = connector.id;
      } catch (e) {
        const msg = (e as Error).message || '';
        if (!msg.includes('already installed')) throw e;
      }
    }

    const installation = await this.installModel.create({
      organizationId: orgId,
      pluginId: plugin.pluginId,
      pluginName: plugin.name,
      pluginType: plugin.type,
      installedVersion: plugin.currentVersion,
      connectorInstanceId,
      config: { ...plugin.configPayload, ...(dto.config || {}) },
      status: 'active',
      installedBy: actor,
    });

    await this.pluginModel.updateOne({ pluginId }, { $inc: { installCount: 1 } });

    return {
      installation: this.serializeInstallation(installation, plugin),
      message: `${plugin.name} installed successfully`,
    };
  }

  async uninstallPlugin(installationId: string, organizationId?: string) {
    const orgId = this.resolveOrg(organizationId);
    const installation = await this.installModel.findOne({ _id: installationId, organizationId: orgId });
    if (!installation) throw new NotFoundException('Installation not found');

    if (installation.connectorInstanceId) {
      try {
        await this.connectors.deleteConnector(installation.connectorInstanceId);
      } catch {
        /* connector may already be removed */
      }
    }

    await this.installModel.findByIdAndDelete(installationId);
    await this.pluginModel.updateOne({ pluginId: installation.pluginId }, { $inc: { installCount: -1 } });
    return { deleted: true, pluginId: installation.pluginId };
  }

  async upgradePlugin(pluginId: string, organizationId?: string) {
    const orgId = this.resolveOrg(organizationId);
    const [plugin, installation] = await Promise.all([
      this.pluginModel.findOne({ pluginId, isDeleted: false }),
      this.installModel.findOne({ organizationId: orgId, pluginId }),
    ]);
    if (!plugin) throw new NotFoundException('Plugin not found');
    if (!installation) throw new NotFoundException('Plugin not installed');

    if (this.compareVersions(plugin.currentVersion, installation.installedVersion) <= 0) {
      throw new BadRequestException('Already on latest version');
    }

    installation.installedVersion = plugin.currentVersion;
    installation.status = 'active';
    installation.config = { ...plugin.configPayload, ...installation.config };
    await installation.save();

    return {
      installation: this.serializeInstallation(installation, plugin),
      message: `Upgraded to v${plugin.currentVersion}`,
    };
  }

  async ratePlugin(pluginId: string, dto: RatePluginDto, actor = 'admin') {
    const orgId = this.resolveOrg(dto.organizationId);
    const plugin = await this.pluginModel.findOne({ pluginId, isDeleted: false });
    if (!plugin) throw new NotFoundException('Plugin not found');

    const existing = await this.ratingModel.findOne({ pluginId, organizationId: orgId });
    if (existing) {
      existing.stars = dto.stars;
      existing.review = dto.review;
      existing.ratedBy = actor;
      await existing.save();
    } else {
      await this.ratingModel.create({
        pluginId,
        organizationId: orgId,
        stars: dto.stars,
        review: dto.review,
        ratedBy: actor,
      });
      await this.pluginModel.updateOne({ pluginId }, { $inc: { ratingCount: 1 } });
    }

    const agg = await this.ratingModel.aggregate([
      { $match: { pluginId } },
      { $group: { _id: null, avg: { $avg: '$stars' } } },
    ]);
    const ratingAvg = agg[0]?.avg ?? dto.stars;
    await this.pluginModel.updateOne({ pluginId }, { ratingAvg });

    return { pluginId, stars: dto.stars, ratingAvg: Math.round(ratingAvg * 10) / 10 };
  }

  getSdkManifest() {
    return SDK_MANIFEST;
  }

  async listDeveloperPlugins(publisher?: string) {
    const q: Record<string, unknown> = { isDeleted: false };
    if (publisher) q.publisher = publisher;
    const plugins = await this.pluginModel.find(q).sort({ updatedAt: -1 });
    return plugins.map((p) => this.serializePlugin(p));
  }

  async publishPlugin(dto: PublishPluginDto) {
    const existing = await this.pluginModel.findOne({ pluginId: dto.pluginId });
    if (existing) throw new BadRequestException('pluginId already exists — publish a new version instead');

    const plugin = await this.pluginModel.create({
      pluginId: dto.pluginId,
      name: dto.name,
      type: dto.type,
      currentVersion: dto.version,
      publisher: dto.publisher,
      description: dto.description,
      category: dto.category,
      registryId: dto.registryId,
      icon: dto.icon,
      tags: dto.tags || [],
      permissions: dto.permissions || [],
      configPayload: dto.configPayload || {},
      status: 'published',
    });

    await this.versionModel.create({
      pluginId: dto.pluginId,
      version: dto.version,
      sdkVersion: SDK_VERSION,
      changelog: dto.changelog || 'Initial publish',
      manifest: { ...dto },
      status: 'published',
    });

    return this.serializePlugin(plugin);
  }

  async publishVersion(pluginId: string, dto: PublishVersionDto) {
    const plugin = await this.pluginModel.findOne({ pluginId, isDeleted: false });
    if (!plugin) throw new NotFoundException('Plugin not found');

    const dup = await this.versionModel.findOne({ pluginId, version: dto.version });
    if (dup) throw new BadRequestException('Version already exists');

    await this.versionModel.create({
      pluginId,
      version: dto.version,
      sdkVersion: dto.sdkVersion || SDK_VERSION,
      changelog: dto.changelog,
      manifest: dto.manifest || {},
      status: 'published',
    });

    plugin.currentVersion = dto.version;
    await plugin.save();

    return this.serializePlugin(plugin);
  }

  async getStore(type: 'connector' | 'dashboard' | 'workflow_template' | 'report_template', organizationId?: string) {
    const plugins = await this.listPlugins(type, organizationId);
    return {
      store: type,
      label: PLUGIN_TYPE_LABELS[type],
      count: plugins.length,
      plugins,
      link: `/marketplace?tab=${type === 'connector' ? 'connectors' : type === 'dashboard' ? 'dashboards' : type === 'workflow_template' ? 'workflows' : 'reports'}`,
    };
  }
}
