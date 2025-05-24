/**
 * Executes a batch of statements, with debug logging if DEBUG or MOCK_D1_DEBUG is set.
 * @param {Array<{run: Function}>} statements - The statements to execute.
 * @returns {Promise<Array<any>>} The results of the statements.
 */
export async function mockBatch(_statements) {
  console.warn('mockBatch() is a mock/test-only API and should not be used in production.');
  return [];
}