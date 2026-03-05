import 'server-only';

import type { AIConnection, AIHealthStatus, AIProviderType } from '@prisma/client';
import { db } from './db';
import { decryptSecret, encryptSecret, getSecretHint, isEncryptionConfigured } from './secrets';

export type AICapability = 'chat' | 'vision' | 'embedding';
export type AIConnectionSource = 'database' | 'environment' | 'mock';

export interface PublicAIConnection {
  id: string;
  label: string;
  providerType: AIProviderType;
  baseUrl: string | null;
  isLocal: boolean;
  enabled: boolean;
  chatModel: string | null;
  visionModel: string | null;
  embeddingModel: string | null;
  lastHealthStatus: AIHealthStatus;
  lastHealthMessage: string | null;
  lastHealthCheckAt: string | null;
  apiKeyConfigured: boolean;
  apiKeyHint: string | null;
  source: AIConnectionSource;
  readOnly: boolean;
}

export interface ResolvedAIConnection extends PublicAIConnection {
  apiKey: string | null;
}

export interface AIConnectionPreset {
  id: string;
  label: string;
  providerType: AIProviderType;
  baseUrl: string;
  isLocal: boolean;
  suggestedChatModel: string | null;
  suggestedVisionModel: string | null;
  suggestedEmbeddingModel: string | null;
}

export interface AIRoutingSettings {
  defaultAIConnectionId: string | null;
  visionAIConnectionId: string | null;
  embeddingAIConnectionId: string | null;
  aiFallbackEnabled: boolean;
}

export interface AISettingsResponse {
  connections: PublicAIConnection[];
  routing: AIRoutingSettings;
  presets: AIConnectionPreset[];
  encryptionAvailable: boolean;
}

export interface UpsertAIConnectionInput {
  label: string;
  providerType: AIProviderType;
  baseUrl?: string | null;
  apiKey?: string | null;
  clearApiKey?: boolean;
  isLocal?: boolean;
  enabled?: boolean;
  chatModel?: string | null;
  visionModel?: string | null;
  embeddingModel?: string | null;
}

const APP_CONFIG_ID = 'singleton';
export const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1';
export const DEFAULT_ZAI_BASE_URL = 'https://api.z.ai/api/paas/v4';

export function normalizeBaseUrl(baseUrl: string | null | undefined): string | null {
  if (!baseUrl) return null;
  const trimmed = baseUrl.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\/+$/, '');
}

export function isLocalBaseUrl(baseUrl: string | null | undefined): boolean {
  if (!baseUrl) return false;

  try {
    const hostname = new URL(baseUrl).hostname;
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname === '::1' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
    );
  } catch {
    return false;
  }
}

function toPublicConnection(
  connection: {
    id: string;
    label: string;
    providerType: AIProviderType;
    baseUrl: string | null;
    isLocal: boolean;
    enabled: boolean;
    chatModel: string | null;
    visionModel: string | null;
    embeddingModel: string | null;
    lastHealthStatus: AIHealthStatus;
    lastHealthMessage: string | null;
    lastHealthCheckAt: Date | string | null;
    apiKeyEncrypted?: string | null;
    apiKeyHint?: string | null;
  },
  source: AIConnectionSource,
  readOnly: boolean,
): PublicAIConnection {
  return {
    id: connection.id,
    label: connection.label,
    providerType: connection.providerType,
    baseUrl: normalizeBaseUrl(connection.baseUrl),
    isLocal: connection.isLocal,
    enabled: connection.enabled,
    chatModel: connection.chatModel,
    visionModel: connection.visionModel,
    embeddingModel: connection.embeddingModel,
    lastHealthStatus: connection.lastHealthStatus,
    lastHealthMessage: connection.lastHealthMessage,
    lastHealthCheckAt: connection.lastHealthCheckAt
      ? new Date(connection.lastHealthCheckAt).toISOString()
      : null,
    apiKeyConfigured: Boolean(connection.apiKeyEncrypted || connection.apiKeyHint),
    apiKeyHint: connection.apiKeyHint ?? null,
    source,
    readOnly,
  };
}

export function getAIConnectionPresets(): AIConnectionPreset[] {
  return [
    {
      id: 'openai',
      label: 'OpenAI',
      providerType: 'OPENAI_COMPATIBLE',
      baseUrl: DEFAULT_OPENAI_BASE_URL,
      isLocal: false,
      suggestedChatModel: 'gpt-4o-mini',
      suggestedVisionModel: 'gpt-4o-mini',
      suggestedEmbeddingModel: 'text-embedding-3-small',
    },
    {
      id: 'openrouter',
      label: 'OpenRouter',
      providerType: 'OPENAI_COMPATIBLE',
      baseUrl: 'https://openrouter.ai/api/v1',
      isLocal: false,
      suggestedChatModel: 'openai/gpt-4o-mini',
      suggestedVisionModel: 'openai/gpt-4o-mini',
      suggestedEmbeddingModel: null,
    },
    {
      id: 'groq',
      label: 'Groq',
      providerType: 'OPENAI_COMPATIBLE',
      baseUrl: 'https://api.groq.com/openai/v1',
      isLocal: false,
      suggestedChatModel: 'llama-3.3-70b-versatile',
      suggestedVisionModel: null,
      suggestedEmbeddingModel: null,
    },
    {
      id: 'together',
      label: 'Together',
      providerType: 'OPENAI_COMPATIBLE',
      baseUrl: 'https://api.together.xyz/v1',
      isLocal: false,
      suggestedChatModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
      suggestedVisionModel: null,
      suggestedEmbeddingModel: 'togethercomputer/m2-bert-80M-8k-retrieval',
    },
    {
      id: 'ollama',
      label: 'Ollama',
      providerType: 'OPENAI_COMPATIBLE',
      baseUrl: 'http://localhost:11434/v1',
      isLocal: true,
      suggestedChatModel: null,
      suggestedVisionModel: null,
      suggestedEmbeddingModel: null,
    },
    {
      id: 'lm-studio',
      label: 'LM Studio',
      providerType: 'OPENAI_COMPATIBLE',
      baseUrl: 'http://localhost:1234/v1',
      isLocal: true,
      suggestedChatModel: null,
      suggestedVisionModel: null,
      suggestedEmbeddingModel: null,
    },
    {
      id: 'custom-openai-compatible',
      label: 'Custom OpenAI-Compatible',
      providerType: 'OPENAI_COMPATIBLE',
      baseUrl: 'http://localhost:8000/v1',
      isLocal: true,
      suggestedChatModel: null,
      suggestedVisionModel: null,
      suggestedEmbeddingModel: null,
    },
    {
      id: 'zai',
      label: 'ZAI',
      providerType: 'ZAI',
      baseUrl: DEFAULT_ZAI_BASE_URL,
      isLocal: false,
      suggestedChatModel: null,
      suggestedVisionModel: null,
      suggestedEmbeddingModel: null,
    },
  ];
}

export async function ensureAppConfig(): Promise<{
  id: string;
  defaultAIConnectionId: string | null;
  visionAIConnectionId: string | null;
  embeddingAIConnectionId: string | null;
  aiFallbackEnabled: boolean;
}> {
  return db.appConfig.upsert({
    where: { id: APP_CONFIG_ID },
    update: {},
    create: {
      id: APP_CONFIG_ID,
      aiFallbackEnabled: true,
    },
  });
}

function getEnvironmentConnections(): ResolvedAIConnection[] {
  const connections: ResolvedAIConnection[] = [];

  const openAIBaseUrl = normalizeBaseUrl(process.env.OPENAI_BASE_URL) ?? DEFAULT_OPENAI_BASE_URL;
  const openAIKey = process.env.OPENAI_API_KEY?.trim() || null;
  const openAIIsLocal = isLocalBaseUrl(openAIBaseUrl);
  const openAIChatModel =
    process.env.OPENAI_CHAT_MODEL?.trim() ||
    process.env.OPENAI_MODEL?.trim() ||
    (openAIKey && !openAIIsLocal ? 'gpt-4o-mini' : null);
  const openAIVisionModel =
    process.env.OPENAI_VISION_MODEL?.trim() ||
    openAIChatModel;
  const openAIEmbeddingModel =
    process.env.OPENAI_EMBEDDING_MODEL?.trim() ||
    (openAIKey && !openAIIsLocal ? 'text-embedding-3-small' : null);

  if (openAIKey || process.env.OPENAI_BASE_URL || process.env.OPENAI_MODEL || process.env.OPENAI_CHAT_MODEL) {
    connections.push({
      ...toPublicConnection({
        id: 'env-openai-compatible',
        label: openAIIsLocal ? 'Environment OpenAI-Compatible (Local)' : 'Environment OpenAI-Compatible',
        providerType: 'OPENAI_COMPATIBLE',
        baseUrl: openAIBaseUrl,
        isLocal: openAIIsLocal,
        enabled: true,
        chatModel: openAIChatModel ?? null,
        visionModel: openAIVisionModel ?? null,
        embeddingModel: openAIEmbeddingModel ?? null,
        lastHealthStatus: 'UNKNOWN',
        lastHealthMessage: 'Provided via environment variables',
        lastHealthCheckAt: null,
        apiKeyEncrypted: openAIKey,
        apiKeyHint: getSecretHint(openAIKey),
      }, 'environment', true),
      apiKey: openAIKey,
    });
  }

  const zaiKey = process.env.ZAI_API_KEY?.trim() || null;
  const zaiBaseUrl = normalizeBaseUrl(process.env.ZAI_BASE_URL) ?? DEFAULT_ZAI_BASE_URL;
  const zaiChatModel = process.env.ZAI_CHAT_MODEL?.trim() || process.env.ZAI_MODEL?.trim() || null;
  const zaiVisionModel = process.env.ZAI_VISION_MODEL?.trim() || zaiChatModel;

  if (zaiKey) {
    connections.push({
      ...toPublicConnection({
        id: 'env-zai',
        label: 'Environment ZAI',
        providerType: 'ZAI',
        baseUrl: zaiBaseUrl,
        isLocal: false,
        enabled: true,
        chatModel: zaiChatModel,
        visionModel: zaiVisionModel ?? null,
        embeddingModel: null,
        lastHealthStatus: 'UNKNOWN',
        lastHealthMessage: 'Provided via environment variables',
        lastHealthCheckAt: null,
        apiKeyEncrypted: zaiKey,
        apiKeyHint: getSecretHint(zaiKey),
      }, 'environment', true),
      apiKey: zaiKey,
    });
  }

  return connections;
}

export async function listResolvedAIConnections(): Promise<ResolvedAIConnection[]> {
  const databaseConnections = await db.aIConnection.findMany({
    orderBy: { createdAt: 'asc' },
  });

  const resolvedDatabaseConnections = databaseConnections.map((connection) => ({
    ...toPublicConnection(connection, 'database', false),
    apiKey: connection.apiKeyEncrypted ? decryptSecret(connection.apiKeyEncrypted) : null,
  }));

  return [...resolvedDatabaseConnections, ...getEnvironmentConnections()];
}

export async function listPublicAIConnections(): Promise<PublicAIConnection[]> {
  const connections = await listResolvedAIConnections();
  return connections.map(({ apiKey: _apiKey, ...connection }) => connection);
}

export async function getAISettings(): Promise<AISettingsResponse> {
  const [routing, connections] = await Promise.all([
    ensureAppConfig(),
    listPublicAIConnections(),
  ]);

  return {
    connections,
    routing: {
      defaultAIConnectionId: routing.defaultAIConnectionId,
      visionAIConnectionId: routing.visionAIConnectionId,
      embeddingAIConnectionId: routing.embeddingAIConnectionId,
      aiFallbackEnabled: routing.aiFallbackEnabled,
    },
    presets: getAIConnectionPresets(),
    encryptionAvailable: isEncryptionConfigured(),
  };
}

export async function getResolvedAIConnectionById(id: string): Promise<ResolvedAIConnection | null> {
  const connections = await listResolvedAIConnections();
  return connections.find((connection) => connection.id === id) ?? null;
}

export async function createAIConnection(input: UpsertAIConnectionInput): Promise<PublicAIConnection> {
  if (input.apiKey && !isEncryptionConfigured()) {
    throw new Error('APP_ENCRYPTION_KEY is required before storing API keys in the database');
  }

  const baseUrl = normalizeBaseUrl(input.baseUrl)
    ?? (input.providerType === 'ZAI' ? DEFAULT_ZAI_BASE_URL : DEFAULT_OPENAI_BASE_URL);
  const isLocal = input.isLocal ?? isLocalBaseUrl(baseUrl);

  const created = await db.aIConnection.create({
    data: {
      label: input.label.trim(),
      providerType: input.providerType,
      baseUrl,
      apiKeyEncrypted: input.apiKey ? encryptSecret(input.apiKey.trim()) : null,
      apiKeyHint: getSecretHint(input.apiKey),
      isLocal,
      enabled: input.enabled ?? true,
      chatModel: input.chatModel?.trim() || null,
      visionModel: input.visionModel?.trim() || null,
      embeddingModel: input.embeddingModel?.trim() || null,
    },
  });

  return toPublicConnection(created, 'database', false);
}

export async function updateAIConnection(id: string, input: UpsertAIConnectionInput): Promise<PublicAIConnection> {
  const existing = await db.aIConnection.findUnique({ where: { id } });
  if (!existing) {
    throw new Error('AI connection not found');
  }

  if (input.apiKey && !isEncryptionConfigured()) {
    throw new Error('APP_ENCRYPTION_KEY is required before storing API keys in the database');
  }

  const baseUrl = normalizeBaseUrl(input.baseUrl)
    ?? normalizeBaseUrl(existing.baseUrl)
    ?? (input.providerType === 'ZAI' ? DEFAULT_ZAI_BASE_URL : DEFAULT_OPENAI_BASE_URL);
  const isLocal = input.isLocal ?? isLocalBaseUrl(baseUrl);

  const updated = await db.aIConnection.update({
    where: { id },
    data: {
      label: input.label.trim(),
      providerType: input.providerType,
      baseUrl,
      apiKeyEncrypted: input.clearApiKey
        ? null
        : input.apiKey
        ? encryptSecret(input.apiKey.trim())
        : existing.apiKeyEncrypted,
      apiKeyHint: input.clearApiKey
        ? null
        : input.apiKey
        ? getSecretHint(input.apiKey)
        : existing.apiKeyHint,
      isLocal,
      enabled: input.enabled ?? existing.enabled,
      chatModel: input.chatModel?.trim() || null,
      visionModel: input.visionModel?.trim() || null,
      embeddingModel: input.embeddingModel?.trim() || null,
    },
  });

  return toPublicConnection(updated, 'database', false);
}

export async function deleteAIConnection(id: string): Promise<void> {
  await db.$transaction(async (tx) => {
    await tx.appConfig.updateMany({
      where: {
        OR: [
          { defaultAIConnectionId: id },
          { visionAIConnectionId: id },
          { embeddingAIConnectionId: id },
        ],
      },
      data: {
        defaultAIConnectionId: null,
        visionAIConnectionId: null,
        embeddingAIConnectionId: null,
      },
    });

    await tx.aIConnection.delete({ where: { id } });
  });
}

export async function updateAIConnectionHealth(
  id: string,
  result: { status: AIHealthStatus; message?: string | null },
): Promise<void> {
  if (id.startsWith('env-')) return;

  await db.aIConnection.update({
    where: { id },
    data: {
      lastHealthStatus: result.status,
      lastHealthMessage: result.message ?? null,
      lastHealthCheckAt: new Date(),
    },
  });
}

export async function updateAIRouting(input: AIRoutingSettings): Promise<AIRoutingSettings> {
  const dbConnections = await db.aIConnection.findMany({
    where: { enabled: true },
    select: { id: true },
  });
  const validIds = new Set(dbConnections.map((connection) => connection.id));

  for (const connectionId of [
    input.defaultAIConnectionId,
    input.visionAIConnectionId,
    input.embeddingAIConnectionId,
  ]) {
    if (connectionId && !validIds.has(connectionId)) {
      throw new Error('Routing can only point to enabled database-backed connections');
    }
  }

  const updated = await db.appConfig.upsert({
    where: { id: APP_CONFIG_ID },
    update: {
      defaultAIConnectionId: input.defaultAIConnectionId,
      visionAIConnectionId: input.visionAIConnectionId,
      embeddingAIConnectionId: input.embeddingAIConnectionId,
      aiFallbackEnabled: input.aiFallbackEnabled,
    },
    create: {
      id: APP_CONFIG_ID,
      defaultAIConnectionId: input.defaultAIConnectionId,
      visionAIConnectionId: input.visionAIConnectionId,
      embeddingAIConnectionId: input.embeddingAIConnectionId,
      aiFallbackEnabled: input.aiFallbackEnabled,
    },
  });

  return {
    defaultAIConnectionId: updated.defaultAIConnectionId,
    visionAIConnectionId: updated.visionAIConnectionId,
    embeddingAIConnectionId: updated.embeddingAIConnectionId,
    aiFallbackEnabled: updated.aiFallbackEnabled,
  };
}
