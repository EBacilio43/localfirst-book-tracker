import { renderHook } from '@testing-library/react-native';
import {
  resolveEntitlements,
  useEntitlements,
  SubscriptionTier,
} from '../../src/core/entitlements/useEntitlements';

describe('Sistema de Entitlements y Suscripciones (useEntitlements)', () => {
  it('resuelve los permisos por defecto en modo BaciBooks Pro para el piloto personal', () => {
    const entitlements = resolveEntitlements();

    expect(entitlements.tier).toBe('PRO');
    expect(entitlements.isPro).toBe(true);
    expect(entitlements.shouldShowAds).toBe(false);
    expect(entitlements.canUseAiSearch).toBe(true);
    expect(entitlements.remainingFreeAiSearches).toBe(999);
    expect(entitlements.canUseAutoCloudSync).toBe(true);
    expect(entitlements.canUseAllPostcardThemes).toBe(true);
    expect(entitlements.planDisplayName).toBe('BaciBooks Pro');
  });

  it('resuelve correctamente el plan gratuito sin busquedas consumidas', () => {
    const entitlements = resolveEntitlements('FREE', 0);

    expect(entitlements.tier).toBe('FREE');
    expect(entitlements.isPro).toBe(false);
    expect(entitlements.shouldShowAds).toBe(true);
    expect(entitlements.canUseAiSearch).toBe(true);
    expect(entitlements.remainingFreeAiSearches).toBe(3);
    expect(entitlements.canUseAutoCloudSync).toBe(false);
    expect(entitlements.canUseAllPostcardThemes).toBe(false);
    expect(entitlements.planDisplayName).toBe('Plan Gratuito');
  });

  it('calcula los intentos restantes de busqueda inteligente en el plan gratuito', () => {
    const twoUsed = resolveEntitlements('FREE', 2);
    expect(twoUsed.remainingFreeAiSearches).toBe(1);
    expect(twoUsed.canUseAiSearch).toBe(true);

    const threeUsed = resolveEntitlements('FREE', 3);
    expect(threeUsed.remainingFreeAiSearches).toBe(0);
    expect(threeUsed.canUseAiSearch).toBe(false);

    const excessUsed = resolveEntitlements('FREE', 10);
    expect(excessUsed.remainingFreeAiSearches).toBe(0);
    expect(excessUsed.canUseAiSearch).toBe(false);
  });

  it('funciona adecuadamente dentro del hook useEntitlements', () => {
    const { result, rerender } = renderHook(
      ({ tier, used }: { tier?: SubscriptionTier; used?: number }) =>
        useEntitlements(tier, used),
      {
        initialProps: { tier: 'PRO', used: 0 },
      }
    );

    expect(result.current.isPro).toBe(true);
    expect(result.current.planDisplayName).toBe('BaciBooks Pro');

    rerender({ tier: 'FREE', used: 1 });
    expect(result.current.isPro).toBe(false);
    expect(result.current.remainingFreeAiSearches).toBe(2);
    expect(result.current.planDisplayName).toBe('Plan Gratuito');
  });
});
