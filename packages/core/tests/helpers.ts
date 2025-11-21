/**
 * Test helper utilities
 */

/**
 * Sample valid email addresses for testing
 */
export const VALID_EMAILS = [
  'user@example.com',
  'test.user@example.com',
  'user+tag@example.co.uk',
  'user_name@example-domain.com',
  'user123@test123.org',
];

/**
 * Sample invalid email addresses for testing
 */
export const INVALID_EMAILS = [
  'invalid',
  '@example.com',
  'user@',
  'user @example.com',
  'user@example',
  '',
];

/**
 * Helper to create a mock email for testing
 */
export function createMockEmail(local: string, domain: string): string {
  return `${local}@${domain}`;
}

/**
 * Helper to measure execution time
 */
export async function measureTime<T>(
  fn: () => Promise<T> | T
): Promise<{ result: T; duration: number }> {
  const start = Date.now();
  const result = await fn();
  const duration = Date.now() - start;
  return { result, duration };
}
