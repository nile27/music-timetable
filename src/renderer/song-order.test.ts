import { describe, expect, it } from 'vitest';
import { moveTrack } from './song-order';

const IDS = ['a', 'b', 'c', 'd'];

describe('moveTrack', () => {
  it('moves a track above the target', () => {
    expect(moveTrack(IDS, 'd', 'b', false)).toEqual(['a', 'd', 'b', 'c']);
  });

  it('moves a track below the target', () => {
    expect(moveTrack(IDS, 'a', 'c', true)).toEqual(['b', 'c', 'a', 'd']);
  });

  it('moves to the very top and bottom', () => {
    expect(moveTrack(IDS, 'c', 'a', false)).toEqual(['c', 'a', 'b', 'd']);
    expect(moveTrack(IDS, 'b', 'd', true)).toEqual(['a', 'c', 'd', 'b']);
  });

  it('returns null when the position does not change', () => {
    expect(moveTrack(IDS, 'b', 'b', true)).toBeNull();
    expect(moveTrack(IDS, 'b', 'c', false)).toBeNull();
    expect(moveTrack(IDS, 'b', 'a', true)).toBeNull();
  });

  it('returns null for unknown tracks', () => {
    expect(moveTrack(IDS, 'x', 'a', false)).toBeNull();
    expect(moveTrack(IDS, 'a', 'x', false)).toBeNull();
  });
});
