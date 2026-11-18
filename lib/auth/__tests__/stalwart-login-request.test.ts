import { describe, it, expect } from 'vitest';
import { STALWART_LOGIN_SCOPE, loginScopeWithExtras, stalwartLoginBody } from '../stalwart-login-request';

const base = { username: 'a@b.c', password: 'pw', clientId: 'jmap-webmail', redirectUri: 'https://x/cb', codeChallenge: 'chal', state: 'st' };

describe('loginScopeWithExtras', () => {
  it('is the default scope without extras', () => {
    expect(loginScopeWithExtras()).toBe(STALWART_LOGIN_SCOPE);
    expect(loginScopeWithExtras('')).toBe(STALWART_LOGIN_SCOPE);
    expect(loginScopeWithExtras('   ')).toBe(STALWART_LOGIN_SCOPE);
  });

  it('appends extra scopes once', () => {
    const scope = loginScopeWithExtras('urn:stalwart:oauth:scope:full  urn:ietf:params:oauth:scope:mail');
    expect(scope).toBe(`${STALWART_LOGIN_SCOPE} urn:stalwart:oauth:scope:full`);
  });
});

describe('stalwartLoginBody scope', () => {
  const queryScope = (body: Record<string, unknown>) => new URLSearchParams(body.query as string).get('scope');

  it('uses the default scope', () => {
    expect(queryScope(stalwartLoginBody(base))).toBe(STALWART_LOGIN_SCOPE);
  });

  it('uses an explicit scope in the 1.x query and keeps the 0.16 fields', () => {
    const body = stalwartLoginBody({ ...base, scope: loginScopeWithExtras('urn:stalwart:oauth:scope:full') });
    expect(queryScope(body)).toContain('urn:stalwart:oauth:scope:full');
    expect(body.clientId).toBe('jmap-webmail');
    expect(body.consent).toBe(true);
  });
});
