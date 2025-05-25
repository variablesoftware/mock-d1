import { describe, it, expect } from 'vitest';
import { validateBindArgs } from '../../src/engine/bindUtils.js';

describe('validateBindArgs', () => {
  it('does not throw if all required parameters are present', () => {
    expect(() => validateBindArgs(['foo', 'bar'], { foo: 1, bar: 2 })).not.toThrow();
  });

  it('throws if a required parameter is missing', () => {
    expect(() => validateBindArgs(['foo', 'bar'], { foo: 1 })).toThrow(/Missing bind argument/);
    expect(() => validateBindArgs(['foo'], {})).toThrow(/Missing bind argument/);
  });

  it('throws with the missing parameter name in the error message', () => {
    try {
      validateBindArgs(['foo', 'bar'], { foo: 1 });
    } catch (e: any) {
      expect(e.message).toMatch(/bar/);
    }
  });

  it('does not mutate the input arguments', () => {
    const required = ['foo'];
    const args = { foo: 1 };
    const requiredCopy = [...required];
    const argsCopy = { ...args };
    try { validateBindArgs(required, args); } catch {};
    expect(required).toEqual(requiredCopy);
    expect(args).toEqual(argsCopy);
  });
});
