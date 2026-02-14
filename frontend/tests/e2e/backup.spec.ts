import { test, expect } from '@playwright/test';

test.describe('Backup/Restore UI', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to profile page
    await page.goto('/profile');
  });

  test('should display backup section with export button', async ({ page }) => {
    // Look for the backup section
    await expect(page.getByText('Data Backup')).toBeVisible();
    await expect(page.getByText('Export your data as JSON')).toBeVisible();
    
    // Check for export button
    const exportButton = page.getByRole('button', { name: /export backup/i });
    await expect(exportButton).toBeVisible();
  });

  test('should display import section with file input', async ({ page }) => {
    // Look for the import section
    await expect(page.getByText('Restore Data')).toBeVisible();
    await expect(page.getByText('Import from a backup file')).toBeVisible();
    
    // Check for file input (it's a label styled as button)
    const importButton = page.getByRole('button', { name: /choose file/i });
    await expect(importButton).toBeVisible();
  });

  test('should show exporting state when export clicked', async ({ page }) => {
    // Mock the export endpoint to not actually download
    await page.route('**/api/backup/export', async (route) => {
      route.abort('failed');
    });
    
    const exportButton = page.getByRole('button', { name: /export backup/i });
    await exportButton.click();
    
    // Should show exporting state
    await expect(page.getByText(/exporting/i)).toBeVisible();
  });
});
