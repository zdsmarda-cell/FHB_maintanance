
import { test, expect } from '@playwright/test';

test.describe('TechMaintain Pro E2E - Admin Administration', () => {

  test.beforeEach(async ({ page }) => {
    // Navigate to app and login as Admin before each test
    await page.goto('/');
    await page.getByRole('button', { name: 'Administrátor' }).click();
    await expect(page.locator('h1')).toContainText('TechMaintain Pro');
  });

  test('Locations & Workplaces: Create, Add Workplace, Edit', async ({ page }) => {
    await page.getByRole('button', { name: 'Lokality' }).click();

    // 1. Create Location
    const locName = `Auto Loc ${Date.now()}`;
    await page.getByRole('button', { name: 'Nová Lokalita' }).click();
    
    // Fill Location Form
    await page.locator('input').nth(0).fill(locName); // Name
    await page.locator('input').nth(1).fill('Main St'); // Street
    await page.locator('input').nth(2).fill('10'); // Number
    await page.locator('input').nth(3).fill('10000'); // ZIP
    await page.locator('input').nth(4).fill('Test City'); // City
    
    await page.getByRole('button', { name: 'Vytvořit' }).click();
    await expect(page.getByText(locName)).toBeVisible();

    // 2. Add Workplace to the new Location
    // We scope to the location card to avoid interacting with other elements
    const locCard = page.locator('div', { hasText: locName }).last();
    
    const wpName = `WP ${Date.now()}`;
    await locCard.getByPlaceholder('Název pracoviště').fill(wpName);
    await locCard.getByPlaceholder('Popis').fill('Assembly Line');
    await locCard.getByRole('button', { name: 'Přidat' }).click();

    await expect(locCard.getByText(wpName)).toBeVisible();

    // 3. Edit Workplace
    const wpRow = locCard.locator('div').filter({ hasText: wpName }).last();
    await wpRow.locator('button').filter({ has: page.locator('.lucide-edit') }).click();

    await expect(page.getByText('Upravit Pracoviště')).toBeVisible();
    await page.locator('input[placeholder="Název"]').fill(wpName + ' Edited');
    await page.getByRole('button', { name: 'Uložit' }).click();

    await expect(page.getByText(wpName + ' Edited')).toBeVisible();
  });

  test('Suppliers: Create & Edit', async ({ page }) => {
    await page.getByRole('button', { name: 'Dodavatelé' }).click();

    // 1. Create Supplier
    const supName = `Supplier ${Date.now()}`;
    await page.getByRole('button', { name: 'Nový Dodavatel' }).click();

    await page.locator('input').nth(0).fill(supName); // Name
    await page.getByPlaceholder('IČ').fill('12345678');
    await page.getByPlaceholder('Telefon').fill('999888777');
    await page.getByPlaceholder('Email').fill('sup@test.com');
    
    // Address (fill mandatory fields)
    await page.locator('input').nth(4).fill('Supply St'); // Street
    await page.locator('input').nth(6).fill('90000'); // Zip
    await page.locator('input').nth(7).fill('Supply City'); // City
    
    await page.getByRole('button', { name: 'Vytvořit' }).click();
    await expect(page.getByText(supName)).toBeVisible();

    // 2. Edit Supplier
    const supCard = page.locator('div', { hasText: supName }).last();
    await supCard.locator('button').filter({ has: page.locator('.lucide-edit') }).click();

    await expect(page.getByText('Upravit Dodavatele')).toBeVisible();
    await page.getByPlaceholder('Email').fill('edited@test.com');
    await page.getByRole('button', { name: 'Uložit' }).click();
    
    await expect(page.getByText('edited@test.com')).toBeVisible();
  });

  test('Tech Config: Create & Edit Types and States', async ({ page }) => {
    await page.getByRole('button', { name: 'Nastavení Technologií' }).click();

    // --- Types ---
    const typeName = `Type ${Date.now()}`;
    // Click the first "Plus" button
    await page.locator('button:has(.lucide-plus)').first().click();
    
    await page.getByPlaceholder('Název').fill(typeName);
    await page.getByPlaceholder('Popis').fill('Desc');
    await page.getByRole('button', { name: 'Vytvořit' }).click();

    await expect(page.getByText(typeName)).toBeVisible();

    // Edit Type
    const typeRow = page.locator('div').filter({ hasText: typeName }).last();
    // Use force click because buttons might be hidden by group-hover
    await typeRow.locator('button').filter({ has: page.locator('.lucide-edit') }).click({ force: true });
    
    await page.locator('input').first().fill(typeName + 'X');
    await page.getByRole('button', { name: 'Uložit' }).click();
    await expect(page.getByText(typeName + 'X')).toBeVisible();

    // --- States ---
    const stateName = `State ${Date.now()}`;
    // Click the second "Plus" button
    await page.locator('button:has(.lucide-plus)').nth(1).click();
    
    await page.getByPlaceholder('Název').fill(stateName);
    await page.getByRole('button', { name: 'Vytvořit' }).click();

    await expect(page.getByText(stateName)).toBeVisible();
  });

  test('Users: Create & Edit', async ({ page }) => {
    await page.getByRole('button', { name: 'Uživatelé' }).click();

    // 1. Create User
    const userName = `User ${Date.now()}`;
    await page.getByRole('button', { name: 'Nový Uživatel' }).click();
    
    await page.locator('input').nth(0).fill(userName);
    await page.locator('input').nth(1).fill('user@test.com');
    await page.locator('select').selectOption('maintenance'); 
    await page.getByRole('button', { name: 'Vytvořit' }).click();

    await expect(page.getByText(userName)).toBeVisible();

    // 2. Edit User
    const userRow = page.locator('div', { hasText: userName }).last();
    await userRow.getByRole('button', { name: 'Spravovat' }).click();

    await expect(page.getByText(`Editace: ${userName}`)).toBeVisible();
    
    // Change Name
    await page.locator('input').first().fill(userName + ' Edited');
    
    // Block User
    await page.getByText('Blokovat přístup').click();

    await page.getByRole('button', { name: 'Uložit změny' }).click();

    // Verify
    await expect(page.getByText(userName + ' Edited')).toBeVisible();
    await expect(page.locator('.lucide-lock')).toBeVisible();
  });

});
