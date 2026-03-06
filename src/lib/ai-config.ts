import 'server-only';

import type { AIHealthStatus, AIProviderType, RuntimeEnvOverride } from '@prisma/client';
import { db } from './db';
import { decryptSecret, encryptSecret, getSecretHint, isEncryptionConfigured } from './secrets';

export type AICapability = 'chat' | 'vision' | 'embedding';
export type AIConnectionSource = 'database' | 'environment' | 'mock';
export type AIEnvironmentGroup = 'openai' | 'zai';
export type AIEnvironmentSource = 'override' | 'environment' | 'default' | 'unset';
export type AIEnvironmentKey =
  | 'OPENAI_BASE_URL'
  | 'OPENAI_API_KEY'
  | 'OPENAI_CHAT_MODEL'
  | 'OPENAI_MODEL'
  | 'OPENAI_VISION_MODEL'
  | 'OPENAI_EMBEDDING_MODEL'
  | 'ZAI_BASE_URL'
  | 'ZAI_API_KEY'
  | 'ZAI_CHAT_MODEL'
  | 'ZAI_MODEL'
  | 'ZAI_VISION_MODEL';

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

export interface PublicAIEnvironmentVariable {
  key: AIEnvironmentKey;
  label: string;
  description: string;
  group: AIEnvironmentGroup;
  isSecret: boolean;
  effectiveValue: string | null;
  source: AIEnvironmentSource;
  hasOverride: boolean;
  configured: boolean;
  hint: string | null;
  defaultValue: string | null;
}

export interface AIEnvironmentSettings {
  variables: PublicAIEnvironmentVariable[];
}

export interface AISettingsResponse {
  connections: PublicAIConnection[];
  routing: AIRoutingSettings;
  presets: AIConnectionPreset[];
  environment: AIEnvironmentSettings;
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

export interface UpdateAIEnvironmentVariableInput {
  key: AIEnvironmentKey;
  value?: string | null;
  clearOverride?: boolean;
}

interface AIEnvironmentDefinition {
  key: AIEnvironmentKey;
  label: string;
  description: string;
  group: AIEnvironmentGroup;
  isSecret: boolean;
  defaultValue: string | null;
}

interface ResolvedAIEnvironmentEntry extends AIEnvironmentDefinition {
  value: string | null;
  source: AIEnvironmentSource;
  hasOverride: boolean;
  hint: string | null;
}

const APP_CONFIG_ID = 'singleton';
export const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1';
export const DEFAULT_ZAI_BASE_URL = 'https://api.z.ai/api/paas/v4';

const AI_ENV_DEFINITIONS: AIEnvironmentDefinition[] = [
  {
    key: 'OPENAI_BASE_URL',
    label: 'OPENAI_BASE_URL',
    description: 'Base URL for OpenAI-compatible providers such as OpenAI, OpenRouter, Groq, Together, Ollama, or LM Studio.',
    group: 'openai',
    isSecret: false,
    defaultValue: DEFAULT_OPENAI_BASE_URL,
  },
  {
    key: 'OPENAI_API_KEY',
    label: 'OPENAI_API_KEY',
    description: 'API key for the OpenAI-compatible provider. Optional for local endpoints that do not require auth.',
    group: 'openai',
    isSecret: true,
    defaultValue: null,
  },
  {
    key: 'OPENAI_CHAT_MODEL',
    label: 'OPENAI_CHAT_MODEL',
    description: 'Primary chat model for OpenAI-compatible providers.',
    group: 'openai',
    isSecret: false,
    defaultValue: null,
  },
  {
    key: 'OPENAI_MODEL',
    label: 'OPENAI_MODEL',
    description: 'Legacy alias for the OpenAI-compatible chat model. Used when OPENAI_CHAT_MODEL is not set.',
    group: 'openai',
    isSecret: false,
    defaultValue: null,
  },
  {
    key: 'OPENAI_VISION_MODEL',
    label: 'OPENAI_VISION_MODEL',
    description: 'Model used for image or multimodal requests on OpenAI-compatible providers.',
    group: 'openai',
    isSecret: false,
    defaultValue: null,
  },
  {
    key: 'OPENAI_EMBEDDING_MODEL',
    label: 'OPENAI_EMBEDDING_MODEL',
    description: 'Embedding model used for search and retrieval.',
    group: 'openai',
    isSecret: false,
    defaultValue: null,
  },
  {
    key: 'ZAI_BASE_URL',
    label: 'ZAI_BASE_URL',
    description: 'Base URL for ZAI.',
    group: 'zai',
    isSecret: false,
    defaultValue: DEFAULT_ZAI_BASE_URL,
  },
  {
    key: 'ZAI_API_KEY',
    label: 'ZAI_API_KEY',
    description: 'API key for ZAI.',
    group: 'zai',
    isSecret: true,
    defaultValue: null,
  },
  {
    key: 'ZAI_CHAT_MODEL',
    label: 'ZAI_CHAT_MODEL',
    description: 'Primary chat model for ZAI.',
    group: 'zai',
    isSecret: false,
    defaultValue: null,
  },
  {
    key: 'ZAI_MODEL',
    label: 'ZAI_MODEL',
    description: 'Legacy alias for the ZAI chat model. Used when ZAI_CHAT_MODEL is not set.',
    group: 'zai',
    isSecret: false,
    defaultValue: null,
  },
  {
    key: 'ZAI_VISION_MODEL',
    label: 'ZAI_VISION_MODEL',
    description: 'Model used for image or multimodal requests on ZAI.',
    group: 'zai',
    isSecret: false,
    defaultValue: null,
  },
];

const AI_ENV_KEY_SET = new Set<AIEnvironmentKey>(AI_ENV_DEFINITIONS.map((definition) => definition.key));

function getAIEnvironmentDefinition(key: AIEnvironmentKey): AIEnvironmentDefinition {
  const definition = AI_ENV_DEFINITIONS.find((entry) => entry.key === key);
  if (!definition) {
    throw new Error(`Unsupported AI environment variable: ${key}`);
  }
  return definition;
}

function normalizeRuntimeEnvValue(key: AIEnvironmentKey, value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (key === 'OPENAI_BASE_URL' || key === 'ZAI_BASE_URL') {
    return normalizeBaseUrl(trimmed);
  }

  return trimmed;
}

function resolveOverrideValue(override: RuntimeEnvOverride): string | null {
  if (override.isSecret) {
    return override.valueEncrypted ? decryptSecret(override.valueEncrypted) : null;
  }
  return normalizeRuntimeEnvValue(override.key as AIEnvironmentKey, override.valueText);
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

export function isAIEnvironmentKey(value: unknown): value is AIEnvironmentKey {
  return typeof value === 'string' && AI_ENV_KEY_SET.has(value as AIEnvironmentKey);
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

async function listResolvedAIEnvironmentEntries(): Promise<ResolvedAIEnvironmentEntry[]> {
  const overrides = await db.runtimeEnvOverride.findMany({
    where: {
      key: {
        in: AI_ENV_DEFINITIONS.map((definition) => definition.key),
      },
    },
  });

  const overrideMap = new Map(overrides.map((override) => [override.key as AIEnvironmentKey, override]));

  return AI_ENV_DEFINITIONS.map((definition) => {
    const override = overrideMap.get(definition.key);
    const overrideValue = override ? resolveOverrideValue(override) : null;
    const environmentValue = normalizeRuntimeEnvValue(definition.key, process.env[definition.key]);

    if (override) {
      return {
        ...definition,
        value: overrideValue,
        source: 'override' as const,
        hasOverride: true,
        hint: definition.isSecret ? getSecretHint(overrideValue) : null,
      };
    }

    if (environmentValue) {
      return {
        ...definition,
        value: environmentValue,
        source: 'environment' as const,
        hasOverride: Boolean(override),
        hint: definition.isSecret ? getSecretHint(environmentValue) : null,
      };
    }

    if (definition.defaultValue) {
      return {
        ...definition,
        value: definition.defaultValue,
        source: 'default' as const,
        hasOverride: Boolean(override),
        hint: null,
      };
    }

    return {
      ...definition,
      value: null,
      source: 'unset' as const,
      hasOverride: Boolean(override),
      hint: null,
    };
  });
}

async function listPublicAIEnvironmentVariables(): Promise<PublicAIEnvironmentVariable[]> {
  const entries = await listResolvedAIEnvironmentEntries();
  return entries.map((entry) => ({
    key: entry.key,
    label: entry.label,
    description: entry.description,
    group: entry.group,
    isSecret: entry.isSecret,
    effectiveValue: entry.isSecret ? null : entry.value,
    source: entry.source,
    hasOverride: entry.hasOverride,
    configured: Boolean(entry.value),
    hint: entry.hint,
    defaultValue: entry.defaultValue,
  }));
}

export async function getAIEnvironmentSettings(): Promise<AIEnvironmentSettings> {
  return {
    variables: await listPublicAIEnvironmentVariables(),
  };
}

export async function updateAIEnvironmentVariables(
  inputs: UpdateAIEnvironmentVariableInput[],
): Promise<AIEnvironmentSettings> {
  const operations = inputs.map(async (input) => {
    if (!isAIEnvironmentKey(input.key)) {
      throw new Error(`Unsupported AI environment variable: ${String(input.key)}`);
    }

    const definition = getAIEnvironmentDefinition(input.key);
    const normalizedValue = normalizeRuntimeEnvValue(definition.key, input.value);
    const clearOverride = input.clearOverride === true;

    if (clearOverride) {
      await db.runtimeEnvOverride.deleteMany({
        where: { key: definition.key },
      });
      return;
    }

    if (definition.isSecret && normalizedValue && !isEncryptionConfigured()) {
      throw new Error('APP_ENCRYPTION_KEY is required before storing API keys in the database');
    }

    await db.runtimeEnvOverride.upsert({
      where: { key: definition.key },
      update: definition.isSecret
        ? {
            valueText: null,
            valueEncrypted: normalizedValue ? encryptSecret(normalizedValue) : null,
            valueHint: normalizedValue ? getSecretHint(normalizedValue) : null,
            isSecret: true,
          }
        : {
            valueText: normalizedValue,
            valueEncrypted: null,
            valueHint: null,
            isSecret: false,
          },
      create: definition.isSecret
        ? {
            key: definition.key,
            valueText: null,
            valueEncrypted: normalizedValue ? encryptSecret(normalizedValue) : null,
            valueHint: normalizedValue ? getSecretHint(normalizedValue) : null,
            isSecret: true,
          }
        : {
            key: definition.key,
            valueText: normalizedValue,
            valueEncrypted: null,
            valueHint: null,
            isSecret: false,
          },
    });
  });

  await Promise.all(operations);
  return getAIEnvironmentSettings();
}

async function getEnvironmentConnections(): Promise<ResolvedAIConnection[]> {
  const connections: ResolvedAIConnection[] = [];
  const entries = await listResolvedAIEnvironmentEntries();
  const valueFor = (key: AIEnvironmentKey) => entries.find((entry) => entry.key === key)?.value ?? null;
  const sourceLabelFor = (keys: AIEnvironmentKey[]) => {
    const sources = new Set(
      entries
        .filter((entry) => keys.includes(entry.key) && entry.value)
        .map((entry) => entry.source),
    );

    if (sources.has('override')) return 'Provided via Settings overrides';
    if (sources.has('environment')) return 'Provided via host environment variables';
    if (sources.has('default')) return 'Using built-in defaults';
    return 'Provided via environment settings';
  };

  const openAIBaseUrl = normalizeBaseUrl(valueFor('OPENAI_BASE_URL')) ?? DEFAULT_OPENAI_BASE_URL;
  const openAIKey = valueFor('OPENAI_API_KEY');
  const openAIIsLocal = isLocalBaseUrl(openAIBaseUrl);
  const openAIChatModel =
    valueFor('OPENAI_CHAT_MODEL') ||
    valueFor('OPENAI_MODEL') ||
    (openAIKey && !openAIIsLocal ? 'gpt-4o-mini' : null);
  const openAIVisionModel =
    valueFor('OPENAI_VISION_MODEL') ||
    openAIChatModel;
  const openAIEmbeddingModel =
    valueFor('OPENAI_EMBEDDING_MODEL') ||
    (openAIKey && !openAIIsLocal ? 'text-embedding-3-small' : null);

  if (openAIKey || valueFor('OPENAI_BASE_URL') || valueFor('OPENAI_MODEL') || valueFor('OPENAI_CHAT_MODEL')) {
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
        lastHealthMessage: sourceLabelFor([
          'OPENAI_BASE_URL',
          'OPENAI_API_KEY',
          'OPENAI_CHAT_MODEL',
          'OPENAI_MODEL',
          'OPENAI_VISION_MODEL',
          'OPENAI_EMBEDDING_MODEL',
        ]),
        lastHealthCheckAt: null,
        apiKeyEncrypted: openAIKey,
        apiKeyHint: getSecretHint(openAIKey),
      }, 'environment', true),
      apiKey: openAIKey,
    });
  }

  const zaiKey = valueFor('ZAI_API_KEY');
  const zaiBaseUrl = normalizeBaseUrl(valueFor('ZAI_BASE_URL')) ?? DEFAULT_ZAI_BASE_URL;
  const zaiChatModel = valueFor('ZAI_CHAT_MODEL') || valueFor('ZAI_MODEL') || null;
  const zaiVisionModel = valueFor('ZAI_VISION_MODEL') || zaiChatModel;

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
        lastHealthMessage: sourceLabelFor([
          'ZAI_BASE_URL',
          'ZAI_API_KEY',
          'ZAI_CHAT_MODEL',
          'ZAI_MODEL',
          'ZAI_VISION_MODEL',
        ]),
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
  const [databaseConnections, environmentConnections] = await Promise.all([
    db.aIConnection.findMany({
      orderBy: { createdAt: 'asc' },
    }),
    getEnvironmentConnections(),
  ]);

  const resolvedDatabaseConnections = databaseConnections.map((connection) => ({
    ...toPublicConnection(connection, 'database', false),
    apiKey: connection.apiKeyEncrypted ? decryptSecret(connection.apiKeyEncrypted) : null,
  }));

  return [...resolvedDatabaseConnections, ...environmentConnections];
}

export async function listPublicAIConnections(): Promise<PublicAIConnection[]> {
  const connections = await listResolvedAIConnections();
  return connections.map(({ apiKey: _apiKey, ...connection }) => connection);
}

export async function getAISettings(): Promise<AISettingsResponse> {
  const [routing, connections, environment] = await Promise.all([
    ensureAppConfig(),
    listPublicAIConnections(),
    getAIEnvironmentSettings(),
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
    environment,
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
