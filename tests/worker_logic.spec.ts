
import { test, expect } from '@playwright/test';

test.describe('Maintenance Generation Logic', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    const demoCheckbox = page.getByLabel('Demo režim (lokální data)');
    if (await demoCheckbox.isVisible() && !(await demoCheckbox.isChecked())) {
        await demoCheckbox.click();
    }
    await page.getByRole('button', { name: 'Administrátor' }).click();
  });

  test('Worker: Request Deadline should equal Creation Date', async ({ page }) => {
    // 1. Create Maintenance Template
    await page.getByRole('button', { name: 'Šablony Údržby' }).click();
    await page.getByRole('button', { name: 'Nová šablona údržby' }).click();
    
    await page.locator('select').nth(0).selectOption({ index: 1 });
    await page.locator('select').nth(1).selectOption({ index: 1 });
    await page.locator('select').nth(2).selectOption({ index: 1 }); 

    const maintTitle = `DeadlineTest_${Date.now()}`;
    await page.locator('input').nth(0).fill(maintTitle);
    await page.locator('input[type="number"]').fill('1'); // Interval 1 day
    await page.getByRole('button', { name: 'Uložit' }).click();

    // 2. Force Run (Simulate Worker)
    const row = page.locator('tr', { hasText: maintTitle });
    await row.hover();
    await row.getByTitle('Vytvořit požadavek ihned').click();
    await page.getByRole('button', { name: 'Vytvořit ihned' }).click();

    // 3. Verify in Requests
    await row.locator('button', { hasText: '1' }).click();
    
    const reqRow = page.locator('tr', { hasText: maintTitle });
    await expect(reqRow).toBeVisible();

    // Get the Created Date and Deadline text
    const createdDateText = await reqRow.locator('td').nth(0).innerText(); // Format: DD.MM.YYYY \n HH:MM
    const deadlineText = await reqRow.locator('td').nth(3).innerText(); // Format: DD.MM.YYYY

    // Parse just the date part (DD.MM.YYYY)
    const createdDatePart = createdDateText.split('\n')[0].trim();
    const deadlineDatePart = deadlineText.trim();

    // Assert they are identical
    console.log(`Comparing Created: "${createdDatePart}" with Deadline: "${deadlineDatePart}"`);
    expect(createdDatePart).toBe(deadlineDatePart);
  });

});
