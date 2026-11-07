import { BackupVaultPayload, migrateAndValidateVault } from '../schemas/backupVaultSchema';

export interface GoogleDriveVaultStatus {
  isConnected: boolean;
  accountEmail: string | null;
  lastSyncedAt: number | null;
  backedUpBooksCount: number;
  backedUpCoversCount: number;
  usedBytes: number;
}

export interface GoogleDriveStorageProvider {
  saveFile(fileName: string, content: string): Promise<void>;
  readFile(fileName: string): Promise<string | null>;
  deleteFile(fileName: string): Promise<boolean>;
}

export class InMemoryGoogleDriveStorage implements GoogleDriveStorageProvider {
  private files = new Map<string, string>();

  public async saveFile(fileName: string, content: string): Promise<void> {
    this.files.set(fileName, content);
  }

  public async readFile(fileName: string): Promise<string | null> {
    return this.files.get(fileName) ?? null;
  }

  public async deleteFile(fileName: string): Promise<boolean> {
    return this.files.delete(fileName);
  }

  public clear(): void {
    this.files.clear();
  }
}

export class GoogleDriveAppDataAdapter {
  private status: GoogleDriveVaultStatus;
  private storage: GoogleDriveStorageProvider;
  private readonly defaultFileName = 'bacibooks_vault_backup.json';

  constructor(
    initialEmail: string | null = null,
    storageProvider?: GoogleDriveStorageProvider
  ) {
    this.status = {
      isConnected: Boolean(initialEmail),
      accountEmail: initialEmail,
      lastSyncedAt: null,
      backedUpBooksCount: 0,
      backedUpCoversCount: 0,
      usedBytes: 0,
    };
    this.storage = storageProvider ?? new InMemoryGoogleDriveStorage();
  }

  public getStatus(): GoogleDriveVaultStatus {
    return { ...this.status };
  }

  public connectAccount(email: string): void {
    if (!email || !email.includes('@')) {
      throw new Error('El correo electronico proporcionado no es valido.');
    }
    this.status.accountEmail = email;
    this.status.isConnected = true;
  }

  public disconnectAccount(): void {
    this.status.isConnected = false;
    this.status.accountEmail = null;
  }

  public async refreshSessionSilently(): Promise<{ ok: boolean; email: string }> {
    if (!this.status.accountEmail) {
      return {
        ok: false,
        email: '',
      };
    }

    this.status.isConnected = true;
    return {
      ok: true,
      email: this.status.accountEmail,
    };
  }

  public async uploadVaultSnapshot(
    vault: BackupVaultPayload
  ): Promise<{ syncedAt: number; fileName: string; sizeBytes: number }> {
    const session = await this.refreshSessionSilently();
    if (!session.ok) {
      throw new Error('No hay una cuenta vinculada para guardar la copia de seguridad.');
    }

    const serialized = JSON.stringify(vault, null, 2);
    const sizeBytes = new TextEncoder().encode(serialized).length;
    const syncedAt = Date.now();

    await this.storage.saveFile(this.defaultFileName, serialized);

    this.status.lastSyncedAt = syncedAt;
    this.status.backedUpBooksCount = vault.books.length;
    this.status.backedUpCoversCount = vault.coverManifest.length;
    this.status.usedBytes = sizeBytes;

    return {
      syncedAt,
      fileName: this.defaultFileName,
      sizeBytes,
    };
  }

  public async downloadLatestVaultSnapshot(): Promise<BackupVaultPayload | null> {
    const session = await this.refreshSessionSilently();
    if (!session.ok) {
      return null;
    }

    const rawContent = await this.storage.readFile(this.defaultFileName);
    if (!rawContent) {
      return null;
    }

    try {
      const parsed = JSON.parse(rawContent) as unknown;
      const validated = migrateAndValidateVault(parsed);
      this.status.backedUpBooksCount = validated.books.length;
      this.status.backedUpCoversCount = validated.coverManifest.length;
      this.status.usedBytes = new TextEncoder().encode(rawContent).length;
      return validated;
    } catch {
      throw new Error('No fue posible leer la copia de seguridad remota porque el formato esta danado.');
    }
  }

  public async deleteCloudVault(): Promise<boolean> {
    const deleted = await this.storage.deleteFile(this.defaultFileName);
    this.status.lastSyncedAt = null;
    this.status.backedUpBooksCount = 0;
    this.status.backedUpCoversCount = 0;
    this.status.usedBytes = 0;
    return deleted;
  }
}
