import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ENV_KEYS = [
  'NODE_ENV',
  'ALLOWED_ORIGINS',
  'APP_URL',
  'NEXT_PUBLIC_APP_URL',
  'CSRF_DEV_BYPASS',
] as const;

const ORIGINAL_ENV = Object.fromEntries(
  ENV_KEYS.map((key) => [key, process.env[key]])
) as Record<(typeof ENV_KEYS)[number], string | undefined>;

function restoreEnv() {
  for (const key of ENV_KEYS) {
    const value = ORIGINAL_ENV[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

async function loadCsrfModule() {
  vi.resetModules();
  return import('./csrf');
}

function createRequest(url: string, method: string, headers: Record<string, string>): Request {
  return {
    method,
    url,
    headers: new Headers(headers),
  } as Request;
}

describe('csrf origin validation', () => {
  beforeEach(() => {
    restoreEnv();
    delete process.env.ALLOWED_ORIGINS;
    delete process.env.APP_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.CSRF_DEV_BYPASS;
    process.env.NODE_ENV = 'production';
  });

  afterEach(() => {
    restoreEnv();
    vi.resetModules();
  });

  it('allows same-origin write requests without an explicit allowlist', async () => {
    const { validateCsrf } = await loadCsrfModule();

    const request = createRequest(
      'https://capturehub.sustainablegrowthlabs.com/api/settings/ai/routing',
      'PATCH',
      {
        origin: 'https://capturehub.sustainablegrowthlabs.com',
      },
    );

    expect(validateCsrf(request)).toMatchObject({
      valid: true,
      origin: 'https://capturehub.sustainablegrowthlabs.com',
    });
  });

  it('allows proxied same-origin requests using forwarded host headers', async () => {
    const { validateCsrf } = await loadCsrfModule();

    const request = createRequest(
      'http://127.0.0.1:3000/api/settings/ai/routing',
      'PATCH',
      {
        origin: 'https://capturehub.sustainablegrowthlabs.com',
        'x-forwarded-proto': 'https',
        'x-forwarded-host': 'capturehub.sustainablegrowthlabs.com',
      },
    );

    expect(validateCsrf(request)).toMatchObject({
      valid: true,
      origin: 'https://capturehub.sustainablegrowthlabs.com',
    });
  });

  it('accepts NEXT_PUBLIC_APP_URL as a fallback allowlist source', async () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://capturehub.sustainablegrowthlabs.com/';

    const { isAllowedOrigin } = await loadCsrfModule();

    expect(isAllowedOrigin('https://capturehub.sustainablegrowthlabs.com')).toBe(true);
  });

  it('rejects cross-origin write requests when the origin does not match the request host', async () => {
    const { validateCsrf } = await loadCsrfModule();

    const request = createRequest(
      'https://capturehub.sustainablegrowthlabs.com/api/settings/ai/routing',
      'PATCH',
      {
        origin: 'https://evil.example.com',
      },
    );

    expect(validateCsrf(request)).toMatchObject({
      valid: false,
      origin: 'https://evil.example.com',
      error: 'Origin not allowed: https://evil.example.com',
    });
  });
});
