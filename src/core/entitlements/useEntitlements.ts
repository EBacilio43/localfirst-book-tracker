import { useMemo } from 'react';

export type SubscriptionTier = 'FREE' | 'PRO';

export interface EntitlementsState {
  tier: SubscriptionTier;
  isPro: boolean;
  shouldShowAds: boolean;
  canUseAiSearch: boolean;
  remainingFreeAiSearches: number;
  canUseAutoCloudSync: boolean;
  canUseAllPostcardThemes: boolean;
  planDisplayName: string;
}

export function resolveEntitlements(
  tier: SubscriptionTier = 'PRO',
  freeAiSearchesUsedThisWeek: number = 0
): EntitlementsState {
  if (tier === 'FREE') {
    const remainingFreeAiSearches = Math.max(0, 3 - (freeAiSearchesUsedThisWeek ?? 0));
    return {
      tier: 'FREE',
      isPro: false,
      shouldShowAds: true,
      canUseAiSearch: remainingFreeAiSearches > 0,
      remainingFreeAiSearches,
      canUseAutoCloudSync: false,
      canUseAllPostcardThemes: false,
      planDisplayName: 'Plan Gratuito',
    };
  }

  return {
    tier: 'PRO',
    isPro: true,
    shouldShowAds: false,
    canUseAiSearch: true,
    remainingFreeAiSearches: 999,
    canUseAutoCloudSync: true,
    canUseAllPostcardThemes: true,
    planDisplayName: 'BaciBooks Pro',
  };
}

export function useEntitlements(
  overrideTier?: SubscriptionTier,
  freeAiSearchesUsedThisWeek?: number
): EntitlementsState {
  return useMemo(
    () => resolveEntitlements(overrideTier, freeAiSearchesUsedThisWeek),
    [overrideTier, freeAiSearchesUsedThisWeek]
  );
}
