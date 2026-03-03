/**
 * AI Provider Registry (Project Omni P4)
 *
 * Singleton registry that manages AI provider selection and fallback.
 * Resolves the best available provider at runtime based on environment config.
 *
 * Priority order:
 * 1. ZAI (if ZAI_API_KEY set)
 * 2. Mock (always available, used for dev/testing/graceful degradation)
 *
 * Future: Add OpenAI, Anthropic, local model providers.
 */

import type { AIProvider, ProviderName } from './types';
import { MockProvider } from './providers/mock';
import { ZAIProvider } from './providers/zai';

// ============================================================================
// Registry State
// ============================================================================

const providers = new Map<ProviderName, AIProvider>();
let defaultProvider: AIProvider | null = null;
let initialized = false;

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialize the provider registry.
 * Call once during server startup.
 */
export function initializeProviders(): void {
  if (initialized) return;

  // Always register mock provider
  const mock = new MockProvider();
  providers.set('mock', mock);

  // Register ZAI if configured
  const zai = new ZAIProvider();
  if (zai.isAvailable()) {
    providers.set('zai', zai);
    defaultProvider = zai;
    console.log('[AI] ZAI provider registered as default');
  } else {
    defaultProvider = mock;
    console.log('[AI] No API key configured — using mock provider (graceful degradation)');
  }

  initialized = true;
}

// ============================================================================
// Provider Access
// ============================================================================

/**
 * Get the default (best available) AI provider.
 * Auto-initializes if not yet initialized.
 */
export function getProvider(): AIProvider {
  if (!initialized) initializeProviders();
  return defaultProvider!;
}

/**
 * Get a specific provider by name.
 */
export function getProviderByName(name: ProviderName): AIProvider | null {
  if (!initialized) initializeProviders();
  return providers.get(name) || null;
}

/**
 * Get the mock provider (guaranteed available).
 */
export function getMockProvider(): AIProvider {
  if (!initialized) initializeProviders();
  return providers.get('mock')!;
}

/**
 * Check if a real (non-mock) AI provider is available.
 */
export function isAIAvailable(): boolean {
  if (!initialized) initializeProviders();
  return defaultProvider?.name !== 'mock';
}

/**
 * Get registry status for health checks.
 */
export function getProviderStatus(): {
  initialized: boolean;
  defaultProvider: string;
  availableProviders: string[];
  aiAvailable: boolean;
} {
  if (!initialized) initializeProviders();
  return {
    initialized,
    defaultProvider: defaultProvider?.name || 'none',
    availableProviders: Array.from(providers.keys()),
    aiAvailable: isAIAvailable(),
  };
}

/**
 * Reset the registry (for testing).
 */
export function resetProviders(): void {
  providers.clear();
  defaultProvider = null;
  initialized = false;
}
