import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type { TemplateWhereInput } from '@/lib/prisma-types';
import { apiError, classifyError } from '@/lib/api-route-handler';

// Default templates to seed on first load
const defaultTemplates = [
  {
    name: 'Meeting Notes',
    description: 'Template for capturing meeting notes',
    content: '# Meeting: {{title}}\n\n**Date:** {{date}}\n**Attendees:** {{attendees}}\n\n## Agenda\n- {{agenda_item}}\n\n## Notes\n{{notes}}\n\n## Action Items\n- [ ] {{action_item}}',
    category: 'meeting',
    icon: '📅',
    isDefault: true,
  },
  {
    name: 'Quick Task',
    description: 'Simple task template with priority',
    content: '- [ ] {{task}}\n  - **Priority:** {{priority}}\n  - **Due:** {{due_date}}\n  - **Notes:** {{notes}}',
    category: 'task',
    icon: '✅',
    isDefault: true,
  },
  {
    name: 'Reading Notes',
    description: 'Template for book or article notes',
    content: '# {{title}}\n\n**Author:** {{author}}\n**Source:** {{source}}\n\n## Key Points\n- {{key_point}}\n\n## Quotes\n> {{quote}}\n\n## My Thoughts\n{{thoughts}}',
    category: 'note',
    icon: '📚',
    isDefault: true,
  },
  {
    name: 'Weekly Review',
    description: 'Template for weekly GTD review',
    content: '# Weekly Review - {{week_of}}\n\n## Accomplishments\n- {{accomplishment}}\n\n## Challenges\n- {{challenge}}\n\n## Next Week Focus\n- {{focus}}\n\n## Inbox Count\n- Items to process: {{inbox_count}}',
    category: 'review',
    icon: '🔄',
    isDefault: true,
  },
];

// Track whether we've checked for default templates this session
let defaultTemplatesSeeded = false;

// Helper function to seed default templates (only runs once per server start)
async function ensureDefaultTemplates() {
  if (defaultTemplatesSeeded) return;
  defaultTemplatesSeeded = true;

  const count = await db.template.count();

  // Only seed if no templates exist
  if (count === 0) {
    await db.template.createMany({
      data: defaultTemplates.map(t => ({
        name: t.name,
        description: t.description,
        content: t.content,
        category: t.category,
        icon: t.icon,
        isDefault: t.isDefault,
      })),
    });
  }
}

// GET - Get all templates
export async function GET(request: NextRequest) {
  try {
    // Auto-seed default templates on first load
    await ensureDefaultTemplates();

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const projectId = searchParams.get('projectId');

    const where: TemplateWhereInput = {};
    if (category) where.category = category;
    if (projectId) where.projectId = projectId;

    const templates = await db.template.findMany({
      where,
      include: {
        project: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
      },
      orderBy: [
        { isDefault: 'desc' },
        { name: 'asc' },
      ],
    });

    return NextResponse.json({ templates });
  } catch (error) {
    const classified = classifyError(error);
    return apiError(classified.message === 'Internal server error' ? 'Failed to fetch templates' : classified.message, classified.status, {
      details: classified.details,
      logPrefix: '[GET /api/templates]',
      error,
    });
  }
}

// POST - Create a new template
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, content, category, icon, variables, isDefault, projectId } = body;

    if (!name || !content) {
      return NextResponse.json({ error: 'Name and content are required' }, { status: 400 });
    }

    const template = await db.template.create({
      data: {
        name,
        description: description || null,
        content,
        category: category || 'general',
        icon: icon || null,
        variables: variables ? JSON.stringify(variables) : null,
        isDefault: isDefault || false,
        projectId: projectId || null,
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
      },
    });

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    const classified = classifyError(error);
    return apiError(classified.message === 'Internal server error' ? 'Failed to create template' : classified.message, classified.status, {
      details: classified.details,
      logPrefix: '[POST /api/templates]',
      error,
    });
  }
}
