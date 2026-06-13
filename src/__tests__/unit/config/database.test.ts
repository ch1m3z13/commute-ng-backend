import { describe, it, expect } from 'vitest';

describe('buildParameterizedQuery', () => {
  it('converts positional params (?, ?, ?) to ($1, $2, $3)', async () => {
    const { buildParameterizedQuery } = await import('../../../config/database.js');
    const result = buildParameterizedQuery('SELECT * FROM users WHERE id = ? AND name = ?', ['user1', 'test']);
    expect(result.text).toBe('SELECT * FROM users WHERE id = $1 AND name = $2');
    expect(result.values).toEqual(['user1', 'test']);
  });

  it('converts named params (@name) to ($1) with correct values', async () => {
    const { buildParameterizedQuery } = await import('../../../config/database.js');
    const result = buildParameterizedQuery('SELECT * FROM users WHERE id = @uid AND name = @name', { uid: 'user1', name: 'test' });
    expect(result.text).toBe('SELECT * FROM users WHERE id = $1 AND name = $2');
    expect(result.values).toEqual(['user1', 'test']);
  });

  it('throws on missing named parameter', async () => {
    const { buildParameterizedQuery } = await import('../../../config/database.js');
    expect(() => buildParameterizedQuery('SELECT * FROM users WHERE id = @uid', { name: 'test' })).toThrow('Missing parameter: uid');
  });
});
