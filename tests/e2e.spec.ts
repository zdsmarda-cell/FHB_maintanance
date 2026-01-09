
import { test, expect } from '@playwright/test';

test.describe('TechMaintain Pro E2E - Full Admin Suite', () => {

  test.beforeEach(async ({ page }) => {
    // Navigate and login as Admin
    await page.goto('/');
    await page.getByRole('button', { name: 'Administrátor' }).click();
    await expect(page.locator('h1')).toContainText('TechMaintain Pro');
  });

  // --- 1. Locations Tab ---
  test('Admin: Locations & Workplaces CRUD', async ({ page }) => {
    await page.getByRole('button', { name: 'Lokality' }).click();

    // Create Location
    const locName = `Loc_${Date.now()}`;
    await page.getByRole('button', { name: 'Nová Lokalita' }).click();
    await page.locator('input').nth(0).fill(locName);
    await page.locator('input').nth(1).fill('Street');
    await page.locator('input').nth(2).fill('1');
    await page.locator('input').nth(3).fill('12345'); // ZIP
    await page.locator('input').nth(4).fill('City');
    await page.getByRole('button', { name: 'Vytvořit' }).click();
    await expect(page.getByText(locName)).toBeVisible();

    // Create Workplace
    const wpName = `WP_${Date.now()}`;
    const locCard = page.locator('div', { hasText: locName }).last();
    await locCard.getByRole('button', { name: 'Přidat pracoviště' }).click();
    
    // In Modal
    await page.getByPlaceholder('Název').last().fill(wpName); // Last because modal is on top
    await page.locator('div[role="dialog"]').getByRole('button', { name: 'Vytvořit' }).click();
    
    await expect(page.getByText(wpName)).toBeVisible();

    // Edit Workplace
    const wpRow = page.locator('div').filter({ hasText: wpName }).last();
    await wpRow.locator('button').first().click(); // Edit icon
    await page.getByPlaceholder('Název').last().fill(wpName + '_Edited');
    await page.locator('div[role="dialog"]').getByRole('button', { name: 'Uložit' }).click();
    await expect(page.getByText(wpName + '_Edited')).toBeVisible();
  });

  // --- 2. Suppliers Tab ---
  test('Admin: Suppliers CRUD & Validation', async ({ page }) => {
    await page.getByRole('button', { name: 'Dodavatelé' }).click();

    // Try Create Empty (Validation Check)
    await page.getByRole('button', { name: 'Nový Dodavatel' }).click();
    await page.locator('div[role="dialog"]').getByRole('button', { name: 'Vytvořit' }).click();
    // Expect error
    await expect(page.locator('text=Název musí mít alespoň 2 znaky')).toBeVisible();
    await page.locator('button').filter({ hasText: 'Zrušit' }).click();

    // Create Valid
    const supName = `Sup_${Date.now()}`;
    await page.getByRole('button', { name: 'Nový Dodavatel' }).click();
    await page.locator('input').nth(0).fill(supName);
    await page.locator('input').nth(1).fill('12345678'); // IČ
    await page.locator('input').nth(2).fill('999888777'); // Phone
    // Skip DIC
    await page.locator('input').nth(4).fill('sup@test.com'); // Email
    
    // Address
    await page.locator('input').nth(5).fill('Sup Street');
    await page.locator('input').nth(7).fill('90000');
    await page.locator('input').nth(8).fill('Sup City');

    await page.locator('div[role="dialog"]').getByRole('button', { name: 'Vytvořit' }).click();
    await expect(page.getByText(supName)).toBeVisible();
  });

  // --- 3. Tech Config Tab ---
  test('Admin: Tech Types & States', async ({ page }) => {
    await page.getByRole('button', { name: 'Nastavení Technologií' }).click();

    const typeName = `Type_${Date.now()}`;
    await page.locator('button:has(.lucide-plus)').first().click();
    await page.getByPlaceholder('Název').fill(typeName);
    await page.getByRole('button', { name: 'Vytvořit' }).click();
    await expect(page.getByText(typeName)).toBeVisible();

    const stateName = `State_${Date.now()}`;
    await page.locator('button:has(.lucide-plus)').nth(1).click();
    await page.getByPlaceholder('Název').fill(stateName);
    await page.getByRole('button', { name: 'Vytvořit' }).click();
    await expect(page.getByText(stateName)).toBeVisible();
  });

  // --- 4. Users Tab & Approval Logic ---
  test('Admin: Users & Dynamic Approval Limit Logic', async ({ page }) => {
    // 1. Create a Test User (Maintenance) with 0 Limit
    await page.getByRole('button', { name: 'Uživatelé' }).click();
    const userName = `Maint_${Date.now()}`;
    await page.getByRole('button', { name: 'Nový Uživatel' }).click();
    await page.locator('input').nth(0).fill(userName);
    await page.locator('input').nth(1).fill(`${userName}@test.com`);
    await page.locator('input').nth(2).fill('+420111222333');
    await page.locator('select').selectOption('maintenance');
    await page.getByRole('button', { name: 'Vytvořit' }).click();
    
    // Assign Location to User and Set Limit 0
    // We assume 'Hlavní Sklad' exists from seed
    const userRow = page.locator('div', { hasText: userName }).last();
    await userRow.getByRole('button', { name: 'Spravovat' }).click();
    
    await page.getByText('Hlavní Sklad').first().click(); // Check location
    // Wait for limit input to appear
    await expect(page.locator('input[type="number"]')).toBeVisible();
    await page.locator('input[type="number"]').fill('0');
    await page.getByRole('button', { name: 'Uložit změny' }).click();

    // 2. Create a Request with Cost 100
    await page.getByRole('button', { name: 'Požadavky' }).click();
    await page.getByRole('button', { name: 'Nový Požadavek' }).click();
    
    await page.getByText('Technologie *').click(); // Dropdown focus
    // Select first technology (Hydraulický Lis...)
    await page.locator('select').nth(2).selectOption({ index: 1 }); 

    await page.locator('input[placeholder="0"]').fill('100'); // Cost
    await page.getByPlaceholder('Název').fill('Expensive Fix');
    await page.getByPlaceholder('Popis').fill('Needs money');
    await page.getByRole('button', { name: 'Vytvořit' }).click();
    
    // Logout Admin
    await page.getByRole('button', { name: 'LogOut' }).click();

    // 3. Login as the New Maintenance User (using mocked auth logic in e2e?)
    // Note: E2E usually runs against the served app. The app has mocked login buttons.
    // We can't easily login as the *dynamic* user via the buttons unless we modify the app code or use the API.
    // ALTERNATIVE: Test the logic as Admin (since Admin now enforces limits too in the new code).
    
    // Log back in as Admin
    await page.getByRole('button', { name: 'Administrátor' }).click();
    
    // Find Admin in Users and set limit to 50 (lower than 100)
    await page.getByRole('button', { name: 'Uživatelé' }).click();
    const adminRow = page.locator('div', { hasText: 'Admin User' }).last();
    await adminRow.getByRole('button', { name: 'Spravovat' }).click();
    
    // Ensure Admin has Hlavní Sklad assigned
    const locCheckbox = page.locator('input[type="checkbox"]').nth(1); // Assuming first loc
    if (!(await locCheckbox.isChecked())) {
        await locCheckbox.click();
    }
    await page.locator('input[type="number"]').fill('50');
    await page.getByRole('button', { name: 'Uložit změny' }).click();

    // 4. Try to Approve
    await page.getByRole('button', { name: 'Požadavky' }).click();
    const reqRow = page.locator('tr', { hasText: 'Expensive Fix' }).last();
    
    // Click "Ke schválení" badge (amber)
    await reqRow.getByText('Ke schválení').click();
    
    // Verify Rejection/Alert
    // Note: The click might open the modal, but the modal logic should check limits OR the logic prevents modal opening.
    // In RequestsPage.tsx: openApprovalModal checks limit. If fail -> setAlertMsg.
    await expect(page.locator('text=Zamítnuto: Cena (100 €) překračuje')).toBeVisible();
    await page.getByRole('button', { name: 'OK' }).click();

    // 5. Update Admin Limit to 150
    await page.getByRole('button', { name: 'Uživatelé' }).click();
    await adminRow.getByRole('button', { name: 'Spravovat' }).click();
    await page.locator('input[type="number"]').fill('150');
    await page.getByRole('button', { name: 'Uložit změny' }).click();

    // 6. Try to Approve Again
    await page.getByRole('button', { name: 'Požadavky' }).click();
    await reqRow.getByText('Ke schválení').click();
    
    // Expect Modal
    await expect(page.getByText('Přejete si změnit stav schválení')).toBeVisible();
    await page.getByRole('button', { name: 'Schválit' }).click();
    
    // Verify Green Badge
    await expect(reqRow.getByText('Schváleno')).toBeVisible();
  });

});
