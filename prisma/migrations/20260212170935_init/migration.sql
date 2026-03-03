-- CreateTable
CREATE TABLE "CaptureItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "extractedText" TEXT,
    "imageUrl" TEXT,
    "sourceUrl" TEXT,
    "metadata" TEXT,
    "tags" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'none',
    "status" TEXT NOT NULL DEFAULT 'inbox',
    "assignedTo" TEXT,
    "dueDate" TEXT,
    "reminder" TEXT,
    "reminderSent" BOOLEAN NOT NULL DEFAULT false,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "projectId" TEXT,
    "processedAt" TEXT,
    "processedBy" TEXT,
    "createdAt" TEXT NOT NULL DEFAULT 'now()',
    "updatedAt" TEXT NOT NULL DEFAULT 'now()',
    CONSTRAINT "CaptureItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "icon" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "dueDate" TEXT,
    "metadata" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TEXT NOT NULL DEFAULT 'now()',
    "updatedAt" TEXT NOT NULL DEFAULT 'now()'
);

-- CreateTable
CREATE TABLE "Template" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "content" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "icon" TEXT,
    "variables" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "projectId" TEXT,
    "createdAt" TEXT NOT NULL DEFAULT 'now()',
    "updatedAt" TEXT NOT NULL DEFAULT 'now()',
    CONSTRAINT "Template_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ItemLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "relationType" TEXT NOT NULL DEFAULT 'related',
    "note" TEXT,
    "createdAt" TEXT NOT NULL DEFAULT 'now()'
);

-- CreateTable
CREATE TABLE "ConnectedDevice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "socketId" TEXT NOT NULL,
    "deviceName" TEXT,
    "deviceType" TEXT,
    "lastSeen" TEXT NOT NULL,
    "connectedAt" TEXT NOT NULL DEFAULT 'now()'
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "settings" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "authorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "ItemLink_sourceId_targetId_key" ON "ItemLink"("sourceId", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "ConnectedDevice_socketId_key" ON "ConnectedDevice"("socketId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
