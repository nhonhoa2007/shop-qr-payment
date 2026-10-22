export type PetAnimation = 'idle' | 'cooking' | 'finished';
export type PetAnimationEvent = 'start' | 'success' | 'failure' | 'timeout';

export function transitionPetAnimation(
  current: PetAnimation,
  event: PetAnimationEvent
): PetAnimation {
  if (event === 'start') return 'cooking';
  if (event === 'success') return 'finished';
  if (event === 'failure') return 'idle';
  return current === 'finished' ? 'idle' : current;
}
