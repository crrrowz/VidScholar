// tests/e2e/sidebar.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Sidebar Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to YouTube video with extension loaded
    await page.goto('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    await page.waitForSelector('#memoSidebar', { timeout: 5000 });
  });

  test('should display sidebar on YouTube video page', async ({ page }) => {
    const sidebar = await page.locator('#memoSidebar');
    await expect(sidebar).toBeVisible();
  });

  test('should add new note', async ({ page }) => {
    const addButton = page.locator('#addNoteButton');
    await addButton.click();
    
    const notes = await page.locator('.note').count();
    expect(notes).toBeGreaterThan(0);
  });

  test('should edit note text', async ({ page }) => {
    // Add note
    await page.locator('#addNoteButton').click();
    
    // Edit text
    const textarea = page.locator('.note textarea').first();
    await textarea.fill('Test note content');
    
    // Wait for auto-save
    await page.waitForTimeout(1000);
    
    // Verify
    await expect(textarea).toHaveValue('Test note content');
  });

  test('should delete note', async ({ page }) => {
    // Add note
    await page.locator('#addNoteButton').click();
    const initialCount = await page.locator('.note').count();
    
    // Delete
    await page.locator('.note .delete-button').first().click();
    
    // Verify
    const finalCount = await page.locator('.note').count();
    expect(finalCount).toBe(initialCount - 1);
  });

  test('should jump to timestamp', async ({ page }) => {
    // Add note at specific time
    await page.evaluate(() => {
      const video = document.querySelector('video') as HTMLVideoElement;
      video.currentTime = 30;
    });
    
    await page.locator('#addNoteButton').click();
    await page.waitForTimeout(500);
    
    // Jump to another time
    await page.evaluate(() => {
      const video = document.querySelector('video') as HTMLVideoElement;
      video.currentTime = 60;
    });
    
    // Click timestamp
    await page.locator('[data-timestamp="true"]').first().click();
    
    // Verify video jumped back
    const currentTime = await page.evaluate(() => {
      const video = document.querySelector('video') as HTMLVideoElement;
      return video.currentTime;
    });
    
    expect(currentTime).toBeCloseTo(30, 0);
  });

  test('should switch between presets', async ({ page }) => {
    const preset1 = page.locator('#preset-btn-1');
    const preset2 = page.locator('#preset-btn-2');
    
    // Switch to preset 2
    await preset2.click();
    await expect(preset2).toHaveClass(/active/);
    
    // Switch back to preset 1
    await preset1.click();
    await expect(preset1).toHaveClass(/active/);
  });

  test('should insert template', async ({ page }) => {
    // Add note
    await page.locator('#addNoteButton').click();
    const textarea = page.locator('.note textarea').first();
    await textarea.focus();
    
    // Select template
    const templateSelect = page.locator('#templateSelect');
    await templateSelect.selectOption({ index: 1 });
    
    // Insert
    await page.locator('#insertTemplateButton').click();
    
    // Verify
    const value = await textarea.inputValue();
    expect(value.length).toBeGreaterThan(0);
  });

  test('should export notes', async ({ page }) => {
    // Add note
    await page.locator('#addNoteButton').click();
    
    // Start download
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#downloadNotesButton').click();
    const download = await downloadPromise;
    
    // Verify
    expect(download.suggestedFilename()).toMatch(/\.json$/);
  });

  test('should toggle theme', async ({ page }) => {
    const themeButton = page.locator('#toggleThemeButton');
    
    // Get initial theme
    const initialBg = await page.locator('#memoSidebar').evaluate(
      el => window.getComputedStyle(el).backgroundColor
    );
    
    // Toggle
    await themeButton.click();
    await page.waitForTimeout(200);
    
    // Verify changed
    const newBg = await page.locator('#memoSidebar').evaluate(
      el => window.getComputedStyle(el).backgroundColor
    );
    
    expect(initialBg).not.toBe(newBg);
  });

  test('should persist notes after navigation', async ({ page }) => {
    // Add note
    await page.locator('#addNoteButton').click();
    const textarea = page.locator('.note textarea').first();
    await textarea.fill('Persistent note');
    await page.waitForTimeout(1000);
    
    // Navigate away and back
    await page.goto('https://www.youtube.com');
    await page.goto('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    await page.waitForSelector('#memoSidebar');
    
    // Verify note persists
    await expect(textarea).toHaveValue('Persistent note');
  });
});