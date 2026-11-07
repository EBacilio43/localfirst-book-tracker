export interface IsbnContributionProposal {
  isbn13: string;
  title: string;
  publisher: string;
  pageCount: number;
  confirmationsCount: number;
}

export function evaluateConsensusProtection(
  existingConfirmations: number,
  incomingConfirmations: number
): { canOverwriteVerifiedRecord: boolean; statusLabel: string } {
  const isExistingVerified = existingConfirmations >= 3;
  const isIncomingVerified = incomingConfirmations >= 3;

  if (isExistingVerified) {
    return {
      canOverwriteVerifiedRecord: isIncomingVerified,
      statusLabel: 'Confirmada por la comunidad',
    };
  }

  return {
    canOverwriteVerifiedRecord: true,
    statusLabel: isIncomingVerified ? 'Confirmada por la comunidad' : 'En revisión',
  };
}

export async function hydratePendingOfflineBooks(
  pendingBooks: Array<{ id: string; isbn13: string | null; title: string }>,
  resolverFn: (
    isbn13: string
  ) => Promise<{
    title: string;
    publisher?: string | null;
    pageCount?: number | null;
    coverUrl?: string | null;
  } | null>
): Promise<{ hydratedCount: number; remainingCount: number; updatedIds: string[] }> {
  let hydratedCount = 0;
  let remainingCount = 0;
  const updatedIds: string[] = [];

  for (const book of pendingBooks) {
    const rawIsbn = book.isbn13 ? book.isbn13.trim() : '';
    if (!rawIsbn) {
      remainingCount += 1;
      continue;
    }

    try {
      const resolved = await resolverFn(rawIsbn);
      if (resolved && resolved.title) {
        hydratedCount += 1;
        updatedIds.push(book.id);
      } else {
        remainingCount += 1;
      }
    } catch {
      remainingCount += 1;
    }
  }

  return {
    hydratedCount,
    remainingCount,
    updatedIds,
  };
}

export class SupabaseCommunityCatalogService {
  private catalog = new Map<string, IsbnContributionProposal>();

  public getRecord(isbn13: string): IsbnContributionProposal | null {
    return this.catalog.get(isbn13) ?? null;
  }

  public submitContribution(
    proposal: IsbnContributionProposal
  ): { ok: boolean; statusLabel: string; record: IsbnContributionProposal } {
    const existing = this.catalog.get(proposal.isbn13);
    if (existing) {
      const consensus = evaluateConsensusProtection(
        existing.confirmationsCount,
        proposal.confirmationsCount
      );

      if (!consensus.canOverwriteVerifiedRecord) {
        return {
          ok: false,
          statusLabel: consensus.statusLabel,
          record: existing,
        };
      }

      const mergedConfirmations = Math.max(
        existing.confirmationsCount + 1,
        proposal.confirmationsCount
      );
      const updatedRecord: IsbnContributionProposal = {
        ...proposal,
        confirmationsCount: mergedConfirmations,
      };
      this.catalog.set(proposal.isbn13, updatedRecord);

      return {
        ok: true,
        statusLabel: consensus.statusLabel,
        record: updatedRecord,
      };
    }

    const consensus = evaluateConsensusProtection(0, proposal.confirmationsCount);
    this.catalog.set(proposal.isbn13, proposal);

    return {
      ok: true,
      statusLabel: consensus.statusLabel,
      record: proposal,
    };
  }

  public async hydratePendingQueue(
    pendingBooks: Array<{ id: string; isbn13: string | null; title: string }>,
    resolverFn: (
      isbn13: string
    ) => Promise<{
      title: string;
      publisher?: string | null;
      pageCount?: number | null;
      coverUrl?: string | null;
    } | null>
  ): Promise<{ hydratedCount: number; remainingCount: number; updatedIds: string[] }> {
    return hydratePendingOfflineBooks(pendingBooks, resolverFn);
  }
}
