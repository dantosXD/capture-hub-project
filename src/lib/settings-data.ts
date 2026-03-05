import 'server-only';

import { db } from './db';
import { safeParseJSON, safeParseTags } from './parse-utils';

type LooseRecord = Record<string, unknown>;

export interface SettingsImportPayload {
  items?: LooseRecord[];
  projects?: LooseRecord[];
  templates?: LooseRecord[];
  links?: LooseRecord[];
}

export interface SettingsDataSummary {
  items: number;
  projects: number;
  templates: number;
  links: number;
}

export interface SettingsImportPreview {
  summary: SettingsDataSummary;
  existingMatches: SettingsDataSummary;
  skippedLinks: number;
}

function normalizeArray<T extends LooseRecord>(value: unknown): T[] {
  return Array.isArray(value) ? (value.filter((item): item is T => Boolean(item) && typeof item === 'object')) : [];
}

function summarizePayload(payload: SettingsImportPayload): SettingsDataSummary {
  return {
    items: normalizeArray(payload.items).length,
    projects: normalizeArray(payload.projects).length,
    templates: normalizeArray(payload.templates).length,
    links: normalizeArray(payload.links).length,
  };
}

function parseDateInput(value: unknown): Date | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function toJSONString(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'string') {
    const parsed = safeParseJSON(value);
    return JSON.stringify(parsed ?? value);
  }
  return JSON.stringify(value);
}

function normalizeItemRecord(item: LooseRecord) {
  const createdAt = parseDateInput(item.createdAt);
  const updatedAt = parseDateInput(item.updatedAt);

  return {
    id: typeof item.id === 'string' && item.id.trim() ? item.id : undefined,
    type: typeof item.type === 'string' && item.type.trim() ? item.type : 'note',
    title: typeof item.title === 'string' && item.title.trim() ? item.title : 'Untitled',
    content: typeof item.content === 'string' ? item.content : null,
    extractedText: typeof item.extractedText === 'string' ? item.extractedText : null,
    imageUrl: typeof item.imageUrl === 'string' ? item.imageUrl : null,
    sourceUrl: typeof item.sourceUrl === 'string' ? item.sourceUrl : null,
    metadata: toJSONString(item.metadata),
    tags: JSON.stringify(Array.isArray(item.tags) ? item.tags : safeParseTags(typeof item.tags === 'string' ? item.tags : null)),
    priority: typeof item.priority === 'string' && item.priority.trim() ? item.priority : 'none',
    status: typeof item.status === 'string' && item.status.trim() ? item.status : 'inbox',
    assignedTo: typeof item.assignedTo === 'string' ? item.assignedTo : null,
    dueDate: typeof item.dueDate === 'string' ? item.dueDate : null,
    reminder: typeof item.reminder === 'string' ? item.reminder : null,
    reminderSent: Boolean(item.reminderSent),
    pinned: Boolean(item.pinned),
    projectId: typeof item.projectId === 'string' ? item.projectId : null,
    processedAt: typeof item.processedAt === 'string' ? item.processedAt : null,
    processedBy: typeof item.processedBy === 'string' ? item.processedBy : null,
    createdAt,
    updatedAt,
  };
}

function normalizeProjectRecord(project: LooseRecord) {
  const createdAt = parseDateInput(project.createdAt);
  const updatedAt = parseDateInput(project.updatedAt);

  return {
    id: typeof project.id === 'string' && project.id.trim() ? project.id : undefined,
    name: typeof project.name === 'string' && project.name.trim() ? project.name : 'Untitled Project',
    description: typeof project.description === 'string' ? project.description : null,
    color: typeof project.color === 'string' && project.color.trim() ? project.color : '#6366f1',
    icon: typeof project.icon === 'string' ? project.icon : null,
    status: typeof project.status === 'string' && project.status.trim() ? project.status : 'active',
    priority: typeof project.priority === 'string' && project.priority.trim() ? project.priority : 'medium',
    dueDate: typeof project.dueDate === 'string' ? project.dueDate : null,
    metadata: toJSONString(project.metadata),
    order: typeof project.order === 'number' ? project.order : 0,
    createdAt,
    updatedAt,
  };
}

function normalizeTemplateRecord(template: LooseRecord) {
  const createdAt = parseDateInput(template.createdAt);
  const updatedAt = parseDateInput(template.updatedAt);

  return {
    id: typeof template.id === 'string' && template.id.trim() ? template.id : undefined,
    name: typeof template.name === 'string' && template.name.trim() ? template.name : 'Untitled Template',
    description: typeof template.description === 'string' ? template.description : null,
    content: typeof template.content === 'string' ? template.content : '',
    category: typeof template.category === 'string' && template.category.trim() ? template.category : 'general',
    icon: typeof template.icon === 'string' ? template.icon : null,
    variables: toJSONString(template.variables),
    isDefault: Boolean(template.isDefault),
    projectId: typeof template.projectId === 'string' ? template.projectId : null,
    createdAt,
    updatedAt,
  };
}

function normalizeLinkRecord(link: LooseRecord) {
  const createdAt = parseDateInput(link.createdAt);

  return {
    id: typeof link.id === 'string' && link.id.trim() ? link.id : undefined,
    sourceId: typeof link.sourceId === 'string' ? link.sourceId : '',
    targetId: typeof link.targetId === 'string' ? link.targetId : '',
    relationType: typeof link.relationType === 'string' && link.relationType.trim() ? link.relationType : 'related',
    note: typeof link.note === 'string' ? link.note : null,
    createdAt,
  };
}

export async function previewImportData(payload: SettingsImportPayload): Promise<SettingsImportPreview> {
  const items = normalizeArray(payload.items).map(normalizeItemRecord);
  const projects = normalizeArray(payload.projects).map(normalizeProjectRecord);
  const templates = normalizeArray(payload.templates).map(normalizeTemplateRecord);
  const links = normalizeArray(payload.links).map(normalizeLinkRecord);

  const [existingItems, existingProjects, existingTemplates, existingLinks] = await Promise.all([
    items.length > 0
      ? db.captureItem.findMany({
          where: { id: { in: items.map((item) => item.id).filter((value): value is string => Boolean(value)) } },
          select: { id: true },
        })
      : Promise.resolve([]),
    projects.length > 0
      ? db.project.findMany({
          where: { id: { in: projects.map((project) => project.id).filter((value): value is string => Boolean(value)) } },
          select: { id: true },
        })
      : Promise.resolve([]),
    templates.length > 0
      ? db.template.findMany({
          where: { id: { in: templates.map((template) => template.id).filter((value): value is string => Boolean(value)) } },
          select: { id: true },
        })
      : Promise.resolve([]),
    links.length > 0
      ? db.itemLink.findMany({
          where: {
            OR: links
              .filter((link) => link.sourceId && link.targetId)
              .map((link) => ({ sourceId: link.sourceId, targetId: link.targetId })),
          },
          select: { id: true },
        })
      : Promise.resolve([]),
  ]);

  const validItemIds = new Set(items.map((item) => item.id).filter((value): value is string => Boolean(value)));
  const skippedLinks = links.filter((link) => !link.sourceId || !link.targetId || !validItemIds.has(link.sourceId) || !validItemIds.has(link.targetId)).length;

  return {
    summary: summarizePayload(payload),
    existingMatches: {
      items: existingItems.length,
      projects: existingProjects.length,
      templates: existingTemplates.length,
      links: existingLinks.length,
    },
    skippedLinks,
  };
}

export async function importSettingsData(payload: SettingsImportPayload): Promise<SettingsImportPreview> {
  const preview = await previewImportData(payload);
  const items = normalizeArray(payload.items).map(normalizeItemRecord);
  const projects = normalizeArray(payload.projects).map(normalizeProjectRecord);
  const templates = normalizeArray(payload.templates).map(normalizeTemplateRecord);
  const links = normalizeArray(payload.links).map(normalizeLinkRecord);

  await db.$transaction(async (tx) => {
    for (const project of projects) {
      const data = {
        name: project.name,
        description: project.description,
        color: project.color,
        icon: project.icon,
        status: project.status,
        priority: project.priority,
        dueDate: project.dueDate,
        metadata: project.metadata,
        order: project.order,
        ...(project.createdAt ? { createdAt: project.createdAt } : {}),
      };

      if (project.id) {
        await tx.project.upsert({
          where: { id: project.id },
          create: {
            id: project.id,
            ...data,
            ...(project.updatedAt ? { updatedAt: project.updatedAt } : {}),
          },
          update: data,
        });
      } else {
        await tx.project.create({ data });
      }
    }

    for (const template of templates) {
      const data = {
        name: template.name,
        description: template.description,
        content: template.content,
        category: template.category,
        icon: template.icon,
        variables: template.variables,
        isDefault: template.isDefault,
        projectId: template.projectId,
        ...(template.createdAt ? { createdAt: template.createdAt } : {}),
      };

      if (template.id) {
        await tx.template.upsert({
          where: { id: template.id },
          create: {
            id: template.id,
            ...data,
            ...(template.updatedAt ? { updatedAt: template.updatedAt } : {}),
          },
          update: data,
        });
      } else {
        await tx.template.create({ data });
      }
    }

    for (const item of items) {
      const data = {
        type: item.type,
        title: item.title,
        content: item.content,
        extractedText: item.extractedText,
        imageUrl: item.imageUrl,
        sourceUrl: item.sourceUrl,
        metadata: item.metadata,
        tags: item.tags,
        priority: item.priority,
        status: item.status,
        assignedTo: item.assignedTo,
        dueDate: item.dueDate,
        reminder: item.reminder,
        reminderSent: item.reminderSent,
        pinned: item.pinned,
        projectId: item.projectId,
        processedAt: item.processedAt,
        processedBy: item.processedBy,
        ...(item.createdAt ? { createdAt: item.createdAt } : {}),
      };

      if (item.id) {
        await tx.captureItem.upsert({
          where: { id: item.id },
          create: {
            id: item.id,
            ...data,
            ...(item.updatedAt ? { updatedAt: item.updatedAt } : {}),
          },
          update: data,
        });
      } else {
        await tx.captureItem.create({ data });
      }
    }

    const validItemIds = new Set(
      (await tx.captureItem.findMany({
        where: {
          id: {
            in: Array.from(new Set(links.flatMap((link) => [link.sourceId, link.targetId]).filter(Boolean))),
          },
        },
        select: { id: true },
      })).map((item) => item.id),
    );

    for (const link of links) {
      if (!link.sourceId || !link.targetId) continue;
      if (!validItemIds.has(link.sourceId) || !validItemIds.has(link.targetId)) continue;

      const data = {
        sourceId: link.sourceId,
        targetId: link.targetId,
        relationType: link.relationType,
        note: link.note,
      };

      if (link.id) {
        await tx.itemLink.upsert({
          where: { id: link.id },
          create: {
            id: link.id,
            ...data,
            ...(link.createdAt ? { createdAt: link.createdAt } : {}),
          },
          update: data,
        });
      } else {
        await tx.itemLink.upsert({
          where: {
            sourceId_targetId: {
              sourceId: link.sourceId,
              targetId: link.targetId,
            },
          },
          create: {
            ...data,
            ...(link.createdAt ? { createdAt: link.createdAt } : {}),
          },
          update: {
            relationType: link.relationType,
            note: link.note,
          },
        });
      }
    }
  });

  return preview;
}

export async function getResetPreview(): Promise<SettingsDataSummary> {
  const [items, projects, templates, links] = await Promise.all([
    db.captureItem.count(),
    db.project.count(),
    db.template.count(),
    db.itemLink.count(),
  ]);

  return { items, projects, templates, links };
}

export async function clearAllSettingsData(): Promise<SettingsDataSummary> {
  const summary = await getResetPreview();

  await db.$transaction([
    db.itemLink.deleteMany(),
    db.captureItem.deleteMany(),
    db.template.deleteMany(),
    db.project.deleteMany(),
  ]);

  return summary;
}
