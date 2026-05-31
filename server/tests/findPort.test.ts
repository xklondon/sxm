import { describe, expect, it } from 'vitest';
import { findAvailablePort } from '../src/findPort.js';

describe('findAvailablePort', () => {
  it('returns first free port from candidates', async () => {
    const port = await findAvailablePort([3017, 5180]);
    expect(port).toBeGreaterThan(0);
    expect(port).toBeLessThan(65536);
  });
});
