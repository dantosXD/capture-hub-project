import type { AIHealthStatus } from '@prisma/client';
import type { AIProvider, ChatCompletionOptions, ChatCompletionResult, EmbeddingOptions, EmbeddingResult } from './types';
import { OpenAICompatibleProvider } from './providers/openai-compatible';
import { ZAIProvider } from './providers/zai';
import { MockProvider } from './providers/mock';
import {
  type AICapability,
  type AIConnectionSource,
  type ResolvedAIConnection,
  ensureAppConfig,
  getResolvedAIConnectionById,
  listResolvedAIConnections,
  updateAIConnectionHealth,
} from '@/lib/ai-config';

export interface AIRunMeta {
  provider: string;
  model: string | null;
  connectionId: string | null;
  source: AIConnectionSource;
  capability: AICapability;
  usedMock: boolean;
}

export interface AIStatusSnapshot {
  defaultConnectionId: string | null;
  visionConnectionId: string | null;
  embeddingConnectionId: string | null;
  aiFallbackEnabled: boolean;
  connections: Array<{
    id: string;
    label: string;
    providerType: string;
    source: AIConnectionSource;
    enabled: boolean;
    chatModel: string | null;
    visionModel: string | null;
    embeddingModel: string | null;
    lastHealthStatus: AIHealthStatus;
  }>;
}

function hasVisionContent(messages: ChatCompletionOptions['messages']): boolean {
  return messages.some((message) =>
    Array.isArray(message.content) &&
    message.content.some((part) => part.type === 'image_url'),
  );
}

function modelForCapability(connection: ResolvedAIConnection, capability: AICapability): string | null {
  if (capability === 'vision') {
    return connection.visionModel ?? connection.chatModel ?? null;
  }
  if (capability === 'embedding') {
    return connection.embeddingModel ?? null;
  }
  return connection.chatModel ?? null;
}

function supportsCapability(connection: ResolvedAIConnection, capability: AICapability): boolean {
  if (!connection.enabled) return false;
  if (capability === 'embedding') return Boolean(connection.embeddingModel);
  if (capability === 'vision') return Boolean(connection.visionModel || connection.chatModel);
  return Boolean(connection.chatModel || connection.visionModel);
}

function buildProvider(connection: ResolvedAIConnection): AIProvider {
  switch (connection.providerType) {
    case 'ZAI':
      return new ZAIProvider({
        apiKey: connection.apiKey,
        baseUrl: connection.baseUrl,
        defaultModel: connection.chatModel,
        visionModel: connection.visionModel,
      });
    case 'OPENAI_COMPATIBLE':
    default:
      return new OpenAICompatibleProvider({
        apiKey: connection.apiKey,
        baseUrl: connection.baseUrl ?? 'https://api.openai.com/v1',
        defaultModel: connection.chatModel,
        visionModel: connection.visionModel,
        embeddingModel: connection.embeddingModel,
        isLocal: connection.isLocal,
      });
  }
}

function createMockConnection(capability: AICapability): ResolvedAIConnection {
  return {
    id: 'mock',
    label: 'Development Mock',
    providerType: 'OPENAI_COMPATIBLE',
    baseUrl: null,
    isLocal: false,
    enabled: true,
    chatModel: 'mock-chat',
    visionModel: capability === 'vision' ? 'mock-vision' : null,
    embeddingModel: capability === 'embedding' ? 'mock-embedding' : null,
    lastHealthStatus: 'UNKNOWN',
    lastHealthMessage: 'Development fallback',
    lastHealthCheckAt: null,
    apiKeyConfigured: false,
    apiKeyHint: null,
    source: 'mock',
    readOnly: true,
    apiKey: null,
  };
}

function createCapabilityError(capability: AICapability): Error {
  if (capability === 'vision') {
    return new Error('AI vision not configured');
  }
  if (capability === 'embedding') {
    return new Error('AI embeddings not configured');
  }
  return new Error('AI chat not configured');
}

export async function resolveConnection(capability: AICapability): Promise<ResolvedAIConnection> {
  const [routing, connections] = await Promise.all([
    ensureAppConfig(),
    listResolvedAIConnections(),
  ]);

  const enabledConnections = connections.filter((connection) => connection.enabled);
  const databaseConnections = enabledConnections.filter((connection) => connection.source === 'database');
  const environmentConnections = enabledConnections.filter((connection) => connection.source === 'environment');

  const findCapableConnection = (id: string | null | undefined): ResolvedAIConnection | null => {
    if (!id) return null;
    const match = enabledConnections.find((connection) => connection.id === id);
    return match && supportsCapability(match, capability) ? match : null;
  };

  const preferredIds = capability === 'vision'
    ? [routing.visionAIConnectionId, routing.defaultAIConnectionId]
    : capability === 'embedding'
    ? [routing.embeddingAIConnectionId, routing.defaultAIConnectionId]
    : [routing.defaultAIConnectionId];

  for (const connectionId of preferredIds) {
    const resolved = findCapableConnection(connectionId);
    if (resolved) return resolved;
  }

  if (databaseConnections.length === 1 && supportsCapability(databaseConnections[0], capability)) {
    return databaseConnections[0];
  }

  const databaseFallback = databaseConnections.find((connection) => supportsCapability(connection, capability));
  if (databaseFallback) return databaseFallback;

  const envFallback = environmentConnections.find((connection) => supportsCapability(connection, capability));
  if (envFallback) return envFallback;

  if (process.env.NODE_ENV !== 'production' && routing.aiFallbackEnabled) {
    return createMockConnection(capability);
  }

  throw createCapabilityError(capability);
}

export async function executeChat(options: ChatCompletionOptions): Promise<{ result: ChatCompletionResult; meta: AIRunMeta }> {
  const capability: AICapability = hasVisionContent(options.messages) ? 'vision' : 'chat';
  const connection = await resolveConnection(capability);
  const provider = connection.source === 'mock' ? new MockProvider() : buildProvider(connection);
  const model = options.model ?? modelForCapability(connection, capability);
  const result = await provider.chat({ ...options, model: model ?? undefined });

  return {
    result,
    meta: {
      provider: provider.name,
      model,
      connectionId: connection.id,
      source: connection.source,
      capability,
      usedMock: connection.source === 'mock',
    },
  };
}

export async function executeEmbedding(options: EmbeddingOptions): Promise<{ result: EmbeddingResult; meta: AIRunMeta }> {
  const capability: AICapability = 'embedding';
  const connection = await resolveConnection(capability);
  const provider = connection.source === 'mock' ? new MockProvider() : buildProvider(connection);
  const model = options.model ?? modelForCapability(connection, capability);
  const result = await provider.embed({ ...options, model: model ?? undefined });

  return {
    result,
    meta: {
      provider: provider.name,
      model,
      connectionId: connection.id,
      source: connection.source,
      capability,
      usedMock: connection.source === 'mock',
    },
  };
}

export async function getAIStatusSnapshot(): Promise<AIStatusSnapshot> {
  const [routing, connections] = await Promise.all([
    ensureAppConfig(),
    listResolvedAIConnections(),
  ]);

  return {
    defaultConnectionId: routing.defaultAIConnectionId,
    visionConnectionId: routing.visionAIConnectionId,
    embeddingConnectionId: routing.embeddingAIConnectionId,
    aiFallbackEnabled: routing.aiFallbackEnabled,
    connections: connections.map((connection) => ({
      id: connection.id,
      label: connection.label,
      providerType: connection.providerType,
      source: connection.source,
      enabled: connection.enabled,
      chatModel: connection.chatModel,
      visionModel: connection.visionModel,
      embeddingModel: connection.embeddingModel,
      lastHealthStatus: connection.lastHealthStatus,
    })),
  };
}

export async function isAnyAIConfigured(): Promise<boolean> {
  try {
    const connection = await resolveConnection('chat');
    return connection.source !== 'mock';
  } catch {
    return false;
  }
}

export async function testConnectionById(id: string): Promise<{
  ok: boolean;
  latencyMs: number;
  provider: string;
  capabilityStatuses: Record<AICapability, { ok: boolean; message?: string }>;
}> {
  const connection = await getResolvedAIConnectionById(id);
  if (!connection) {
    throw new Error('AI connection not found');
  }

  const provider = buildProvider(connection);
  const capabilityStatuses: Record<AICapability, { ok: boolean; message?: string }> = {
    chat: { ok: Boolean(connection.chatModel), message: connection.chatModel ? undefined : 'No chat model configured' },
    vision: { ok: Boolean(connection.visionModel || connection.chatModel), message: connection.visionModel || connection.chatModel ? undefined : 'No vision model configured' },
    embedding: {
      ok: provider.supportsEmbeddings && Boolean(connection.embeddingModel),
      message: provider.supportsEmbeddings
        ? (connection.embeddingModel ? undefined : 'No embedding model configured')
        : 'Provider does not support embeddings',
    },
  };

  const health = await provider.healthCheck();
  await updateAIConnectionHealth(id, {
    status: health.ok ? 'HEALTHY' : 'FAILED',
    message: health.error ?? null,
  });

  return {
    ok: health.ok,
    latencyMs: health.latencyMs,
    provider: provider.name,
    capabilityStatuses,
  };
}
