import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

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

// GET - Check if seeding is needed and perform if necessary
export async function GET() {
  try {
    // Check if any templates exist
    const existingTemplates = await db.template.findMany();

    // Only seed if no templates exist
    if (existingTemplates.length === 0) {
      for (const template of defaultTemplates) {
        await db.template.create({
          data: {
            name: template.name,
            description: template.description,
            content: template.content,
            category: template.category,
            icon: template.icon,
            isDefault: template.isDefault,
            // createdAt/updatedAt handled by Prisma defaults
          },
        });
      }

      return NextResponse.json({
        seeded: true,
        count: defaultTemplates.length,
        message: 'Default templates seeded successfully'
      });
    }

    return NextResponse.json({
      seeded: false,
      count: existingTemplates.length,
      message: 'Templates already exist'
    });
  } catch (error) {
    console.error('Error seeding templates:', error);
    return NextResponse.json({ error: 'Failed to seed templates' }, { status: 500 });
  }
}

// POST - Force seed (for testing/development)
export async function POST() {
  try {
    let seededCount = 0;

    for (const template of defaultTemplates) {
      // Check if template with same name already exists
      const existing = await db.template.findFirst({
        where: { name: template.name }
      });

      if (!existing) {
        await db.template.create({
          data: {
            name: template.name,
            description: template.description,
            content: template.content,
            category: template.category,
            icon: template.icon,
            isDefault: template.isDefault,
            // createdAt/updatedAt handled by Prisma defaults
          },
        });
        seededCount++;
      }
    }

    return NextResponse.json({
      seeded: true,
      count: seededCount,
      message: `Seeded ${seededCount} new templates`
    });
  } catch (error) {
    console.error('Error force seeding templates:', error);
    return NextResponse.json({ error: 'Failed to seed templates' }, { status: 500 });
  }
}
