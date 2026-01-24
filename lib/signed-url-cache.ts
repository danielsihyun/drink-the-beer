// lib/signed-url-cache.ts

type CacheEntry = {
    url: string
    expires: number
  }
  
  // In-memory cache - persists for the lifetime of the server process
  const cache = new Map<string, CacheEntry>()
  
  /**
   * Get a signed URL with caching.
   * Returns cached URL if still valid, otherwise generates a new one.
   */
  export async function getCachedSignedUrl(
    supabase: any,
    bucket: string,
    path: string | null,
    expiresInSeconds = 3600
  ): Promise<string | null> {
    if (!path) return null
  
    const key = `${bucket}:${path}`
    const cached = cache.get(key)
    const now = Date.now()
  
    // Return cached URL if it won't expire in the next 5 minutes
    if (cached && cached.expires > now + 5 * 60 * 1000) {
      return cached.url
    }
  
    // Generate new signed URL
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresInSeconds)
  
    if (error || !data?.signedUrl) {
      return null
    }
  
    // Cache it
    cache.set(key, {
      url: data.signedUrl,
      expires: now + expiresInSeconds * 1000,
    })
  
    return data.signedUrl
  }
  
  /**
   * Batch get signed URLs - more efficient for multiple files.
   * Uses cache and parallelizes uncached requests.
   */
  export async function getBatchSignedUrls(
    supabase: any,
    bucket: string,
    paths: (string | null)[],
    expiresInSeconds = 3600
  ): Promise<(string | null)[]> {
    const now = Date.now()
    const results: (string | null)[] = new Array(paths.length).fill(null)
    const uncachedIndexes: number[] = []
    const uncachedPaths: string[] = []
  
    // Check cache first
    for (let i = 0; i < paths.length; i++) {
      const path = paths[i]
      if (!path) {
        results[i] = null
        continue
      }
  
      const key = `${bucket}:${path}`
      const cached = cache.get(key)
  
      if (cached && cached.expires > now + 5 * 60 * 1000) {
        results[i] = cached.url
      } else {
        uncachedIndexes.push(i)
        uncachedPaths.push(path)
      }
    }
  
    // Fetch uncached URLs in parallel
    if (uncachedPaths.length > 0) {
      const fetchPromises = uncachedPaths.map(async (path) => {
        const { data } = await supabase.storage
          .from(bucket)
          .createSignedUrl(path, expiresInSeconds)
        return data?.signedUrl ?? null
      })
  
      const fetchedUrls = await Promise.all(fetchPromises)
  
      // Store in cache and results
      for (let i = 0; i < uncachedIndexes.length; i++) {
        const resultIndex = uncachedIndexes[i]
        const path = uncachedPaths[i]
        const url = fetchedUrls[i]
  
        results[resultIndex] = url
  
        if (url) {
          cache.set(`${bucket}:${path}`, {
            url,
            expires: now + expiresInSeconds * 1000,
          })
        }
      }
    }
  
    return results
  }
  
  /**
   * Clear expired entries from cache (optional cleanup)
   */
  export function cleanupCache() {
    const now = Date.now()
    for (const [key, entry] of cache.entries()) {
      if (entry.expires < now) {
        cache.delete(key)
      }
    }
  }