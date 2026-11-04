export function assertVariantRemovalAllowed(
  actorRole: string,
  existingVariants: ReadonlyArray<{ id: string }>,
  incomingVariants: ReadonlyArray<{ id?: string }>
): void {
  if (actorRole !== 'STAFF') return;

  const incomingIds = new Set(incomingVariants.map((variant) => variant.id).filter(Boolean));
  if (existingVariants.some((variant) => !incomingIds.has(variant.id))) {
    throw new Error('Unauthorized: STAFF cannot remove product variants');
  }
}
