-- CreateTable
CREATE TABLE "AIConnection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL,
    "providerType" TEXT NOT NULL DEFAULT 'OPENAI_COMPATIBLE',
    "baseUrl" TEXT,
    "apiKeyEncrypted" TEXT,
    "apiKeyHint" TEXT,
    "isLocal" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "chatModel" TEXT,
    "visionModel" TEXT,
    "embeddingModel" TEXT,
    "lastHealthStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "lastHealthMessage" TEXT,
    "lastHealthCheckAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AppConfig" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "defaultAIConnectionId" TEXT,
    "visionAIConnectionId" TEXT,
    "embeddingAIConnectionId" TEXT,
    "aiFallbackEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AppConfig_defaultAIConnectionId_fkey" FOREIGN KEY ("defaultAIConnectionId") REFERENCES "AIConnection" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AppConfig_visionAIConnectionId_fkey" FOREIGN KEY ("visionAIConnectionId") REFERENCES "AIConnection" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AppConfig_embeddingAIConnectionId_fkey" FOREIGN KEY ("embeddingAIConnectionId") REFERENCES "AIConnection" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AIConnection_enabled_providerType_idx" ON "AIConnection"("enabled", "providerType");

-- CreateIndex
CREATE INDEX "AIConnection_createdAt_idx" ON "AIConnection"("createdAt");

-- CreateIndex
CREATE INDEX "AppConfig_defaultAIConnectionId_idx" ON "AppConfig"("defaultAIConnectionId");

-- CreateIndex
CREATE INDEX "AppConfig_visionAIConnectionId_idx" ON "AppConfig"("visionAIConnectionId");

-- CreateIndex
CREATE INDEX "AppConfig_embeddingAIConnectionId_idx" ON "AppConfig"("embeddingAIConnectionId");
