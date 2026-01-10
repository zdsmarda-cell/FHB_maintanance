
import { test, expect } from '@playwright/test';

test.describe('Admin Full CRUD & Logic Tests', () => {

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

  // 1. LOCATIONS & WORKPLACES CRUD
  test('CRUD: Locations and Workplaces', async ({ page }) => {
    await page.getByRole('button', { name: 'Lokality' }).click();

    // Create Location
    const locName = `TestLoc_${Date.now()}`;
    await page.getByRole('button', { name: 'Nová Lokalita' }).click();
    await page.locator('input').nth(0).fill(locName);
    await page.locator('input').nth(1).fill('Main St'); // Street
    await page.locator('input').nth(2).fill('10'); // Number
    await page.locator('input').nth(3).fill('10000'); // Zip
    await page.locator('input').nth(4).fill('Test City'); // City
    await page.getByRole('button', { name: 'Vytvořit' }).click();
    await expect(page.getByText(locName)).toBeVisible();

    // Edit Location
    const locCard = page.locator('div', { hasText: locName }).last();
    await locCard.locator('button').first().click(); // Edit icon is first button in header
    await page.locator('input').nth(0).fill(locName + '_Edited');
    await page.getByRole('button', { name: 'Uložit' }).click();
    await expect(page.getByText(locName + '_Edited')).toBeVisible();

    // Create Workplace
    const wpName = `WP_${Date.now()}`;
    await locCard.getByRole('button', { name: 'Přidat pracoviště' }).click();
    await page.getByPlaceholder('Název').last().fill(wpName);
    await page.getByRole('button', { name: 'Vytvořit' }).click();
    await expect(page.getByText(wpName)).toBeVisible();

    // Edit Workplace
    const wpRow = page.locator('div').filter({ hasText: wpName }).last();
    await wpRow.locator('button').first().click(); // Edit icon
    await page.getByPlaceholder('Název').last().fill(wpName + '_Edited');
    await page.getByRole('button', { name: 'Uložit' }).click();
    await expect(page.getByText(wpName + '_Edited')).toBeVisible();

    // Delete Workplace
    // Note: Mock DB allows delete if not used. Newly created WP is not used.
    page.on('dialog', dialog => dialog.accept());
    await wpRow.locator('button').nth(1).click(); // Delete icon
    await expect(page.getByText(wpName + '_Edited')).toBeHidden();
  });

  // 2. SUPPLIERS CRUD
  test('CRUD: Suppliers', async ({ page }) => {
    await page.getByRole('button', { name: 'Dodavatelé' }).click();

    // Create
    const supName = `Supplier_${Date.now()}`;
    await page.getByRole('button', { name: 'Nový Dodavatel' }).click();
    await page.locator('input').nth(0).fill(supName);
    await page.locator('input').nth(1).fill('12345678');
    await page.locator('input').nth(2).fill('999888777');
    await page.locator('input').nth(4).fill('test@sup.com');
    await page.locator('input').nth(5).fill('Sup St');
    await page.locator('input').nth(7).fill('90000');
    await page.locator('input').nth(8).fill('City');
    await page.getByRole('button', { name: 'Vytvořit' }).click();
    await expect(page.getByText(supName)).toBeVisible();

    // Edit
    const row = page.locator('div', { hasText: supName }).last();
    await row.locator('button').nth(1).click(); // Edit icon is second (Contacts is first)
    await page.locator('input').nth(0).fill(supName + '_Edited');
    await page.getByRole('button', { name: 'Uložit' }).click();
    await expect(page.getByText(supName + '_Edited')).toBeVisible();
  });

  // 3. TECH CONFIG CRUD
  test('CRUD: Tech Config (Types/States)', async ({ page }) => {
    await page.getByRole('button', { name: 'Nastavení Technologií' }).click();

    // Create Type
    const typeName = `Type_${Date.now()}`;
    await page.locator('button:has(.lucide-plus)').first().click();
    await page.getByPlaceholder('Název').fill(typeName);
    await page.getByRole('button', { name: 'Vytvořit' }).click();
    await expect(page.getByText(typeName)).toBeVisible();

    // Delete Type
    page.on('dialog', dialog => dialog.accept());
    const typeRow = page.locator('div', { hasText: typeName }).last();
    await typeRow.hover(); // Actions appear on hover
    await typeRow.locator('button').nth(1).click(); // Delete icon
    await expect(page.getByText(typeName)).toBeHidden();
  });

  // 4. USERS CRUD
  test('CRUD: Users', async ({ page }) => {
    await page.getByRole('button', { name: 'Uživatelé' }).click();

    // Create User
    const userName = `User_${Date.now()}`;
    await page.getByRole('button', { name: 'Nový Uživatel' }).click();
    await page.locator('input').nth(0).fill(userName);
    await page.locator('input').nth(1).fill(`${userName}@test.com`);
    await page.locator('input').nth(2).fill('+420111222333');
    await page.getByRole('button', { name: 'Vytvořit' }).click();
    await expect(page.getByText(userName)).toBeVisible();

    // Edit User (Block)
    const row = page.locator('tr', { hasText: userName }).last();
    await row.getByRole('button', { name: 'Spravovat' }).click();
    await page.getByLabel('Blokovat přístup').check();
    await page.getByRole('button', { name: 'Uložit změny' }).click();
    
    // Verify Blocked Status
    await expect(row.getByText('Blokován')).toBeVisible();
  });

  // 5. REQUEST TAKEOVER & DATE VALIDATION (Fix Validation)
  test('Request: Create and Takeover with Date Validation', async ({ page }) => {
    // A. Create Request
    await page.getByRole('button', { name: 'Požadavky' }).click();
    await page.getByRole('button', { name: 'Nový Požadavek' }).click();
    
    const reqTitle = `FixCheck_${Date.now()}`;
    // Select first technology
    await page.getByText('Technologie *').click();
    await page.locator('select').nth(2).selectOption({ index: 1 });
    
    await page.getByPlaceholder('Název').fill(reqTitle);
    await page.getByPlaceholder('Popis').fill('Checking date save');
    await page.getByRole('button', { name: 'Vytvořit' }).click();
    
    await expect(page.getByText(reqTitle)).toBeVisible();

    // B. Takeover Request (Admin is also maintenance role effectively)
    const row = page.locator('tr', { hasText: reqTitle }).last();
    
    // Click "Převzít"
    await row.getByRole('button', { name: 'Převzít' }).click();
    
    // Check Modal appears
    await expect(page.getByText('Přiřazení / Plánování')).toBeVisible();
    
    // Verify Button disabled if date empty
    const confirmBtn = page.getByRole('button', { name: 'Převzít / Přiřadit' });
    await expect(confirmBtn).toBeDisabled();

    // Fill Date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];
    
    await page.locator('input[type="date"]').fill(dateStr);
    
    // Button should be enabled
    await expect(confirmBtn).toBeEnabled();
    await confirmBtn.click();

    // C. Verify Data Saved
    // The row should now show the date
    // Date formatting in table is localized (e.g. 25.02.2025 or 2/25/2025). 
    // We check partial match or open detail.
    
    await expect(row.getByText('V řešení')).toBeVisible();
    await expect(row.locator('td').nth(3)).not.toHaveText('-'); // Date column shouldn't be empty
    
    // Open Detail to confirm exact date match
    await row.getByRole('button', { name: 'Detail požadavku' }).click();
    await expect(page.getByText(new Date(dateStr).toLocaleDateString())).toBeVisible();
  });

  // 6. PDF Generation Test
  test('PDF Export should start download', async ({ page }) => {
    await page.getByRole('button', { name: 'Požadavky' }).click();
    
    // Ensure there is at least one request by creating one if empty, or just rely on existing
    // We already created a request in the previous step, so table shouldn't be empty.
    
    const downloadPromise = page.waitForEvent('download');
    await page.getByTitle('Exportovat seznam do PDF').click();
    const download = await downloadPromise;
    
    // Check filename pattern
    expect(download.suggestedFilename()).toMatch(/worklist_.*\.pdf/);
  });

});
