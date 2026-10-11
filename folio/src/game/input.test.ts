import { describe, expect, it } from 'vitest';
import { keyCommand } from './input';

describe('keyCommand', () => {
  it('reconnaît les touches de marche sur AZERTY et QWERTY', () => {
    expect(keyCommand('ArrowRight')).toEqual({ kind: 'walk', direction: 1 });
    expect(keyCommand('D')).toEqual({ kind: 'walk', direction: 1 });
    expect(keyCommand('q')).toEqual({ kind: 'walk', direction: -1 });
    expect(keyCommand('a')).toEqual({ kind: 'walk', direction: -1 });
  });

  it('reconnaît l’accroupi, la parade, le saut et l’attaque', () => {
    expect(keyCommand('ArrowDown')?.kind).toBe('crouch');
    expect(keyCommand('s')?.kind).toBe('crouch');
    expect(keyCommand(' ')?.kind).toBe('block');
    expect(keyCommand('ArrowUp')?.kind).toBe('jump');
    expect(keyCommand('z')?.kind).toBe('jump');
    expect(keyCommand('W')?.kind).toBe('jump');
    expect(keyCommand('j')?.kind).toBe('attack');
  });

  it('ignore les autres touches', () => {
    expect(keyCommand('Enter')).toBeNull();
    expect(keyCommand('Tab')).toBeNull();
    expect(keyCommand('k')).toBeNull();
  });
});
