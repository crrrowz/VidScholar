// src/services/EncryptionService.ts
class EncryptionService {
  private readonly ALGORITHM = 'AES-GCM';
  private readonly KEY_LENGTH = 256;
  private readonly IV_LENGTH = 12;
  private readonly SALT_LENGTH = 16;
  private readonly ITERATIONS = 100000;

  /**
   * Generate encryption key from password
   */
  private async deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);

    // Import password as key material
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    // Derive key using PBKDF2
    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: this.ITERATIONS,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: this.ALGORITHM, length: this.KEY_LENGTH },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypt data with password
   */
  async encrypt(data: string, password: string): Promise<string> {
    try {
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(data);

      // Generate random salt and IV
      const salt = crypto.getRandomValues(new Uint8Array(this.SALT_LENGTH));
      const iv = crypto.getRandomValues(new Uint8Array(this.IV_LENGTH));

      // Derive key
      const key = await this.deriveKey(password, salt);

      // Encrypt
      const encryptedBuffer = await crypto.subtle.encrypt(
        { name: this.ALGORITHM, iv },
        key,
        dataBuffer
      );

      // Combine salt + iv + encrypted data
      const combined = new Uint8Array(
        salt.length + iv.length + encryptedBuffer.byteLength
      );
      combined.set(salt, 0);
      combined.set(iv, salt.length);
      combined.set(new Uint8Array(encryptedBuffer), salt.length + iv.length);

      // Convert to base64
      return this.arrayBufferToBase64(combined);
    } catch (error) {
      throw new Error('Encryption failed: ' + (error as Error).message);
    }
  }

  /**
   * Decrypt data with password
   */
  async decrypt(encryptedData: string, password: string): Promise<string> {
    try {
      // Decode from base64
      const combined = this.base64ToArrayBuffer(encryptedData);

      // Extract salt, iv, and encrypted data
      const salt = combined.slice(0, this.SALT_LENGTH);
      const iv = combined.slice(this.SALT_LENGTH, this.SALT_LENGTH + this.IV_LENGTH);
      const data = combined.slice(this.SALT_LENGTH + this.IV_LENGTH);

      // Derive key
      const key = await this.deriveKey(password, salt);

      // Decrypt
      const decryptedBuffer = await crypto.subtle.decrypt(
        { name: this.ALGORITHM, iv },
        key,
        data
      );

      // Convert to string
      const decoder = new TextDecoder();
      return decoder.decode(decryptedBuffer);
    } catch (error) {
      throw new Error('Decryption failed: Invalid password or corrupted data');
    }
  }

  /**
   * Check if data is encrypted
   */
  isEncrypted(data: string): boolean {
    try {
      // Try to decode as base64
      const decoded = this.base64ToArrayBuffer(data);
      // Encrypted data should be at least salt + iv + some data
      return decoded.length > (this.SALT_LENGTH + this.IV_LENGTH);
    } catch {
      return false;
    }
  }

  /**
   * Generate random password
   */
  generatePassword(length: number = 32): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    const randomValues = crypto.getRandomValues(new Uint8Array(length));
    return Array.from(randomValues)
      .map(val => chars[val % chars.length])
      .join('');
  }

  /**
   * Hash password for storage
   */
  async hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return this.arrayBufferToBase64(new Uint8Array(hashBuffer));
  }

  /**
   * Verify password against hash
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    const computedHash = await this.hashPassword(password);
    return computedHash === hash;
  }

  private arrayBufferToBase64(buffer: Uint8Array): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]!);
    }
    return btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
}

export const encryptionService = new EncryptionService();