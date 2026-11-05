import {test,expect} from '@playwright/test';

test('production prefix supports new, marked review, progress, and reveal questions',async({page})=>{
  await page.goto('./');
  await expect(page.getByRole('heading',{name:'Interview Concepts Review'})).toBeVisible();
  await expect(page.getByText('30 questions available.')).toBeVisible();
  await expect(page.getByRole('progressbar',{name:'Overall completion'})).toHaveAttribute('value','0');

  const filters=page.getByRole('region',{name:'Choose your practice'});
  await filters.getByRole('button',{name:'Clear'}).first().click();
  await filters.getByLabel('Go concurrency').check();
  await filters.getByRole('button',{name:'Clear'}).nth(1).click();
  await filters.getByLabel('Multiple choice').check();
  await expect(filters.getByRole('button',{name:'Practice new questions (3)'})).toBeEnabled();
  await filters.getByRole('button',{name:'Practice new questions (3)'}).click();

  await page.getByRole('radio').first().check();
  await page.getByRole('button',{name:'Submit answer'}).click();
  await expect(page.getByRole('status').filter({hasText:/Correct|Incorrect/})).toBeVisible();
  await page.getByRole('button',{name:'Mark as needs review'}).click();
  await expect(page.getByText('Marked for review')).toBeVisible();

  await page.reload();
  await page.getByRole('button',{name:'Resume saved session'}).click();
  await expect(page.getByRole('button',{name:'Remove from review'})).toBeVisible();
  await page.getByRole('button',{name:'Back to progress'}).click();
  await expect(page.getByRole('progressbar',{name:'Overall completion'})).toHaveAttribute('value','1');
  await expect(page.getByRole('button',{name:'Review marked questions (1)'})).toBeEnabled();
  await page.getByRole('button',{name:'Review marked questions (1)'}).click();
  await expect(page.getByText(/Review · Question 1 of 1/)).toBeVisible();

  await page.getByRole('button',{name:'Back to progress'}).click();
  await filters.getByRole('button',{name:'Select all'}).first().click();
  await filters.getByRole('button',{name:'Clear'}).nth(1).click();
  await filters.getByLabel('Flashcards').check();
  await filters.getByRole('button',{name:/Practice new questions/}).click();
  await expect(page.getByRole('textbox')).toHaveCount(0);
  await page.getByRole('button',{name:'Show solution'}).click();
  await expect(page.getByRole('button',{name:'Mark as needs review'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth)).toBe(false);
});
