
import { test, expect } from '@playwright/test';

test.describe('Push Notifications Admin', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Force Demo/Mock Mode
    const demoCheckbox = page.getByLabel('Demo režim (lokální data)');
    if (await demoCheckbox.isVisible() && !(await demoCheckbox.isChecked())) {
        await demoCheckbox.click();
    }
    await page.getByRole('button', { name: 'Administrátor' }).click();
    await expect(page.locator('h1')).toContainText('TechMaintain Pro');
  });

  test('Navigate to Push Notifications and verify layout', async ({ page }) => {
    // 1. Click on Push Notifications in sidebar
    await page.getByRole('button', { name: 'Mobilní notifikace' }).click();
    
    // 2. Verify Header
    await expect(page.getByRole('heading', { name: 'Log Mobilních Notifikací' })).toBeVisible();
    
    // 3. Verify Filter Button
    await expect(page.locator('button').filter({ has: page.locator('svg.lucide-filter') })).toBeVisible();
    
    // 4. Verify Table Headers
    await expect(page.getByText('Vytvořeno')).toBeVisible();
    await expect(page.getByText('Příjemce')).toBeVisible();
    await expect(page.getByText('Předmět')).toBeVisible();
    await expect(page.getByText('Stav')).toBeVisible();
  });

  test('Filter toggling works', async ({ page }) => {
    await page.getByRole('button', { name: 'Mobilní notifikace' }).click();
    
    // Open Filters
    await page.locator('button').filter({ has: page.locator('svg.lucide-filter') }).click();
    
    // Verify Filter Inputs appear
    await expect(page.getByText('Příjemce')).toBeVisible();
    await expect(page.getByText('Datum (Od)')).toBeVisible();
    
    // Close Filters
    await page.locator('button').filter({ has: page.locator('svg.lucide-filter') }).click();
    await expect(page.getByText('Datum (Od)')).toBeHidden();
  });

});
