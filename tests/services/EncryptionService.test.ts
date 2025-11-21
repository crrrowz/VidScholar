// tests/services/EncryptionService.test.ts
import { encryptionService } from '../../src/services/EncryptionService';

describe('EncryptionService', () => {
  const testData = 'This is sensitive data';
  const testPassword = 'mySecurePassword123!';

  describe('encrypt/decrypt', () => {
    it('should encrypt and decrypt data correctly', async () => {
      const encrypted = await encryptionService.encrypt(testData, testPassword);
      expect(encrypted).not.toBe(testData);
      
      const decrypted = await encryptionService.decrypt(encrypted, testPassword);
      expect(decrypted).toBe(testData);
    });

    it('should fail decryption with wrong password', async () => {
      const encrypted = await encryptionService.encrypt(testData, testPassword);
      
      await expect(
        encryptionService.decrypt(encrypted, 'wrongPassword')
      ).rejects.toThrow('Decryption failed');
    });

    it('should produce different encrypted output each time', async () => {
      const encrypted1 = await encryptionService.encrypt(testData, testPassword);
      const encrypted2 = await encryptionService.encrypt(testData, testPassword);
      
      expect(encrypted1).not.toBe(encrypted2);
      
      const decrypted1 = await encryptionService.decrypt(encrypted1, testPassword);
      const decrypted2 = await encryptionService.decrypt(encrypted2, testPassword);
      
      expect(decrypted1).toBe(decrypted2);
    });

    it('should handle unicode characters', async () => {
      const unicodeData = 'Hello مرحبا 你好 🎉';
      const encrypted = await encryptionService.encrypt(unicodeData, testPassword);
      const decrypted = await encryptionService.decrypt(encrypted, testPassword);
      
      expect(decrypted).toBe(unicodeData);
    });

    it('should handle large data', async () => {
      const largeData = 'A'.repeat(100000);
      const encrypted = await encryptionService.encrypt(largeData, testPassword);
      const decrypted = await encryptionService.decrypt(encrypted, testPassword);
      
      expect(decrypted).toBe(largeData);
    });
  });

  describe('isEncrypted', () => {
    it('should detect encrypted data', async () => {
      const encrypted = await encryptionService.encrypt(testData, testPassword);
      expect(encryptionService.isEncrypted(encrypted)).toBe(true);
    });

    it('should detect plain text', () => {
      expect(encryptionService.isEncrypted('plain text')).toBe(false);
    });

    it('should handle invalid base64', () => {
      expect(encryptionService.isEncrypted('!!!invalid!!!')).toBe(false);
    });
  });

  describe('generatePassword', () => {
    it('should generate password of correct length', () => {
      const password = encryptionService.generatePassword(32);
      expect(password).toHaveLength(32);
    });

    it('should generate different passwords', () => {
      const password1 = encryptionService.generatePassword();
      const password2 = encryptionService.generatePassword();
      
      expect(password1).not.toBe(password2);
    });

    it('should generate passwords with special characters', () => {
      const password = encryptionService.generatePassword(100);
      expect(/[!@#$%^&*]/.test(password)).toBe(true);
    });
  });

  describe('hashPassword', () => {
    it('should hash password consistently', async () => {
      const hash1 = await encryptionService.hashPassword(testPassword);
      const hash2 = await encryptionService.hashPassword(testPassword);
      
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different passwords', async () => {
      const hash1 = await encryptionService.hashPassword('password1');
      const hash2 = await encryptionService.hashPassword('password2');
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verifyPassword', () => {
    it('should verify correct password', async () => {
      const hash = await encryptionService.hashPassword(testPassword);
      const isValid = await encryptionService.verifyPassword(testPassword, hash);
      
      expect(isValid).toBe(true);
    });

    it('should reject wrong password', async () => {
      const hash = await encryptionService.hashPassword(testPassword);
      const isValid = await encryptionService.verifyPassword('wrongPassword', hash);
      
      expect(isValid).toBe(false);
    });
  });
});