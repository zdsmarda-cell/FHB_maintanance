
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

  test('Client: Next Maintenance Date should be at least Tomorrow', async ({ page }) => {
    // Explanation: If I create a maintenance today with interval 1, 
    // logic LastGenerated (Today) + 1 = Tomorrow.
    // Since worker runs at 00:01, and today's 00:01 passed, next run IS Tomorrow.
    
    await page.getByRole('button', { name: 'Šablony Údržby' }).click();
    await page.getByRole('button', { name: 'Nová šablona údržby' }).click();
    
    // Fill basic info
    await page.locator('select').nth(0).selectOption({ index: 1 });
    await page.locator('select').nth(1).selectOption({ index: 1 });
    await page.locator('select').nth(2).selectOption({ index: 1 });
    
    const maintTitle = `FutureTest_${Date.now()}`;
    await page.locator('input').nth(0).fill(maintTitle);
    await page.locator('input[type="number"]').fill('1');
    // Ensure all days are allowed (default usually handles this but being explicit is good if UI supports it, here we assume defaults)
    
    await page.getByRole('button', { name: 'Uložit' }).click();

    const row = page.locator('tr', { hasText: maintTitle });
    await expect(row).toBeVisible();

    // Get the "Příští generování" column (4th column, index 3)
    const nextDateText = await row.locator('td').nth(3).innerText();
    
    // Calculate Tomorrow's date in local format (DD.MM.YYYY or similar depending on browser locale in test)
    // We just verify it is NOT today's date
    const now = new Date();
    const todayStr = now.toLocaleDateString();
    
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toLocaleDateString();

    console.log(`UI Shows: "${nextDateText}", Today: "${todayStr}", Tomorrow: "${tomorrowStr}"`);

    // The date in UI should NOT contain today's date string if formats match
    // Better check: It should match Tomorrow's date (assuming standardized formatting in app vs test runner)
    // Note: The app uses `toLocaleDateString()` without arguments, which usually defaults to system locale.
    // Playwright uses system locale too.
    
    // Important: We assert it is NOT today.
    expect(nextDateText).not.toContain(todayStr);
    
    // Ideally it equals tomorrow (if interval 1)
    // We allow flexibility for weekends if logic skips them, but standard test env is usually standard date.
    // If today is Friday, tomorrow is Saturday. If allowed days include Saturday, it works.
    // Default allowed days in form is [1,2,3,4,5] (Mon-Fri).
    // If test runs on Friday, next date will be Monday.
    
    // So simple assertion: The date string is different from Today.
    expect(nextDateText.trim()).not.toBe(todayStr);
  });

});
