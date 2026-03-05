const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
    const items = await p.captureItem.findMany({
        where: { id: { startsWith: 'bk_17726416' } },
        select: { id: true, title: true, content: true, tags: true },
        orderBy: { createdAt: 'asc' },
    });

    items.forEach(i => {
        console.log('---');
        console.log('id:', i.id);
        console.log('title:', i.title);
        console.log('content is null?', i.content === null);
        console.log('content type:', typeof i.content);
        console.log('content value:', JSON.stringify(i.content));
        console.log('tags:', i.tags);
    });

    await p.$disconnect();
}

main();
