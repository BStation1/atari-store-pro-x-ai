let pendingRepairPartMutations = 0;

export function isRepairPartMutationPending(): boolean {
  return pendingRepairPartMutations > 0;
}

function notifyRepairPartUsagesChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('atari_db_changed', {
    detail: { key: 'atari_repair_part_usages', optimistic: pendingRepairPartMutations > 0 }
  }));
}

export function beginRepairPartMutation(): void {
  pendingRepairPartMutations += 1;
  notifyRepairPartUsagesChanged();
}

export function endRepairPartMutation(): void {
  pendingRepairPartMutations = Math.max(0, pendingRepairPartMutations - 1);
  notifyRepairPartUsagesChanged();
}
