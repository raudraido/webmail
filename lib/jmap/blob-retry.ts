/**
 * Retry a JMAP request that references a blob uploaded just before it.
 *
 * Majutaja runs two Stalwart nodes on one FoundationDB cluster behind a load
 * balancer that picks a node per connection. Stalwart reads FoundationDB at a
 * cached read version (up to ~4 s old) and a blob upload sends no cluster
 * broadcast, so a request that lands on the other node a few milliseconds after
 * the upload answers `blobNotFound` ("Blob does not exist.") until its cached
 * version refreshes. The blob is fine, so asking again a moment later succeeds.
 * Analysis and reproduction: STALWART_UPGRADE_1.x.md in the majutaja repo.
 *
 * Total wait before giving up is ~5 s, a little over Stalwart's 4 s maximum
 * cache age. A request that fails for any other reason is returned untouched.
 */
export const BLOB_NOT_FOUND_RETRY_DELAYS_MS = [300, 700, 1500, 2500];

interface SetResultLike {
  notCreated?: Record<string, { type?: string } | undefined>;
  notUpdated?: Record<string, { type?: string } | undefined>;
}

export function isBlobNotFound(
  methodResponses: ReadonlyArray<readonly unknown[]> | undefined,
  objectKey: string,
): boolean {
  const result = methodResponses?.[0]?.[1] as SetResultLike | undefined;
  const failure = result?.notCreated?.[objectKey] ?? result?.notUpdated?.[objectKey];
  return failure?.type === 'blobNotFound';
}

export async function retryWhileBlobNotFound<R extends { methodResponses?: ReadonlyArray<readonly unknown[]> }>(
  send: () => Promise<R>,
  objectKey: string,
  delaysMs: readonly number[] = BLOB_NOT_FOUND_RETRY_DELAYS_MS,
): Promise<R> {
  let response = await send();
  for (const delay of delaysMs) {
    if (!isBlobNotFound(response.methodResponses, objectKey)) break;
    await new Promise((resolve) => setTimeout(resolve, delay));
    response = await send();
  }
  return response;
}
