import { describe, it, expect, vi } from 'vitest';
import { isBlobNotFound, retryWhileBlobNotFound } from '../blob-retry';

const notFound = (key: string, field: 'notCreated' | 'notUpdated' = 'notCreated') => ({
  methodResponses: [['SieveScript/set', { [field]: { [key]: { type: 'blobNotFound', description: 'Blob does not exist.' } } }, '0']] as const,
});
const ok = { methodResponses: [['SieveScript/set', { created: { s: { id: 'b' } } }, '0']] as const };

describe('retryWhileBlobNotFound', () => {
  it('returns the first response untouched when there is no blobNotFound', async () => {
    const send = vi.fn().mockResolvedValue(ok);
    expect(await retryWhileBlobNotFound(send, 's', [0, 0])).toBe(ok);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('retries blobNotFound (create and update) until the blob is visible', async () => {
    for (const field of ['notCreated', 'notUpdated'] as const) {
      const send = vi.fn().mockResolvedValueOnce(notFound('s', field)).mockResolvedValueOnce(notFound('s', field)).mockResolvedValueOnce(ok);
      expect(await retryWhileBlobNotFound(send, 's', [0, 0, 0])).toBe(ok);
      expect(send).toHaveBeenCalledTimes(3);
    }
  });

  it('gives up after the last delay and returns the failing response', async () => {
    const failing = notFound('s');
    const send = vi.fn().mockResolvedValue(failing);
    expect(await retryWhileBlobNotFound(send, 's', [0, 0])).toBe(failing);
    expect(send).toHaveBeenCalledTimes(3);
  });

  it('does not retry other errors or another object key', async () => {
    const other = { methodResponses: [['SieveScript/set', { notCreated: { s: { type: 'invalidScript' } } }, '0']] as const };
    const send = vi.fn().mockResolvedValue(other);
    expect(await retryWhileBlobNotFound(send, 's', [0, 0])).toBe(other);
    expect(send).toHaveBeenCalledTimes(1);
    expect(isBlobNotFound(notFound('x').methodResponses, 's')).toBe(false);
  });
});
