
import { test, expect } from '@playwright/test';

test.describe('Maintenance Worker & Admin Features', () => {

  test.beforeEach(async ({ page }) => {
    // 1. Login as Admin
    await page.goto('/');
    
    // Ensure Demo Mode is active
    const demoCheckbox = page.getByLabel('Demo režim (lokální data)');
    if (await demoCheckbox.isVisible() && !(await demoCheckbox.isChecked())) {
        await demoCheckbox.click();
    }

    await page.getByRole('button', { name: 'Administrátor' }).click();
    await expect(page.locator('h1')).toContainText('TechMaintain Pro');
  });

  test('Worker: Create Template, Filter by S.N., and Run Generation', async ({ page }) => {
    // --- 1. Navigate to Maintenance ---
    await page.getByRole('button', { name: 'Šablony Údržby' }).click();
    
    // --- 2. Create New Maintenance Template ---
    await page.getByRole('button', { name: 'Nová šablona údržby' }).click();
    
    // Select Location & Workplace (Assuming default data exists in Demo)
    // We select first available options
    await page.locator('select').nth(0).selectOption({ index: 1 }); // Location
    await page.locator('select').nth(1).selectOption({ index: 1 }); // Workplace
    
    // Select Technology (Hydraulický Lis has SN: SN-2023-001-X)
    await page.locator('select').nth(2).selectOption({ index: 1 }); 

    const maintTitle = `AutoCheck_${Date.now()}`;
    await page.locator('input').nth(0).fill(maintTitle); // Name
    await page.locator('input[type="number"]').fill('1'); // Interval 1 day
    
    await page.getByRole('button', { name: 'Uložit' }).click();
    await expect(page.getByText(maintTitle)).toBeVisible();

    // --- 3. Test Serial Number Filter ---
    // The default tech "Hydraulický Lis" has SN "SN-2023-001-X"
    await page.getByRole('button', { name: /filter/i }).click(); // Open filter panel
    
    // Filter by non-matching SN
    await page.getByPlaceholder('S.N.').fill('NON_EXISTENT_SN');
    await expect(page.getByText(maintTitle)).toBeHidden();

    // Filter by matching SN part
    await page.getByPlaceholder('S.N.').fill('2023-001');
    await expect(page.getByText(maintTitle)).toBeVisible();

    // --- 4. Simulate Worker Execution (Run Now) ---
    // Hover over the row to see actions
    const row = page.locator('tr', { hasText: maintTitle });
    await row.hover();
    
    // Check initial count (should be 0)
    await expect(row.locator('button', { hasText: '0' })).toBeVisible();

    // Click "Run Now" (Zap icon / Bolt icon)
    await row.getByTitle('Vytvořit požadavek ihned').click();
    
    // Confirm Modal
    await expect(page.getByText('Mimořádné spuštění')).toBeVisible();
    await page.getByRole('button', { name: 'Vytvořit ihned' }).click();

    // --- 5. Verify Results in Maintenance Table ---
    // Count should increase to 1
    await expect(row.locator('button', { hasText: '1' })).toBeVisible();
    
    // Next Generation date should be moved (since interval is 1 day, it should be tomorrow or skip weekends based on allowed days)
    // We just check it's not empty and contains a date format
    await expect(row.locator('td').nth(3)).toContainText(/\d{1,2}\.\d{1,2}\.\d{4}/);

    // --- 6. Verify Link to Requests ---
    await row.locator('button', { hasText: '1' }).click();
    
    // Should navigate to Requests page
    await expect(page.getByRole('heading', { name: 'Požadavky' })).toBeVisible();
    
    // Verify filter is active (Banner "Filtrováno dle údržby")
    await expect(page.getByText('Filtrováno dle údržby')).toBeVisible();
    
    // Verify the request is listed
    await expect(page.getByText(maintTitle)).toBeVisible();
    await expect(page.getByText('Nový')).toBeVisible(); // State should be New (or Assigned if solver was set)
  });

});
