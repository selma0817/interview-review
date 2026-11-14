import {test,expect,type Page} from '@playwright/test';

// Answers whatever card is showing: the first option for multiple choice, Good for anything that asks
async function answerCard(page:Page){
  const radios=page.getByRole('radio');
  if(await radios.count()){
    await radios.first().check();
    await page.getByRole('button',{name:'Submit answer'}).click();
    await expect(page.getByRole('status').filter({hasText:/Correct|Incorrect/})).toBeVisible();
    if(await page.getByRole('button',{name:'Next card'}).isVisible()){
      await expect(page.getByText(/Counted as Again/)).toBeVisible();
      await page.getByRole('button',{name:'Next card'}).click();
      return;
    }
    await expect(page.getByRole('button',{name:/^Again/})).toHaveCount(0);
  } else {
    await page.getByRole('button',{name:'Show solution'}).click();
    await expect(page.getByRole('button',{name:/^Again/})).toBeVisible();
  }
  await page.getByRole('button',{name:/^Good · /}).click();
}

test('production prefix supports today\'s review, saved ratings, and topic practice',async({page})=>{
  // Fixed mid-morning clock, so learning steps (1m/10m) stay inside today
  await page.clock.setFixedTime(new Date(2026,10,14,10,0));
  await page.goto('./');
  await expect(page.getByRole('heading',{name:'Interview Concepts Review'})).toBeVisible();
  await expect(page.getByText('30 cards in your bank.')).toBeVisible();
  const today=page.getByRole('region',{name:'Today'});
  await expect(today.getByText('Due',{exact:true}).locator('..')).toHaveText(/^\s*0\s*Due\s*$/);
  await expect(today.getByText('New',{exact:true}).locator('..')).toHaveText(/^\s*10\s*New\s*$/);

  await today.getByRole('button',{name:"Start today's review (10)"}).click();
  await expect(page.getByText(/Today's review · Card 1 of 10/)).toBeVisible();
  await answerCard(page);
  await expect(page.getByText(/Today's review · Card 2 of 1[01]/)).toBeVisible();
  await expect(page.getByRole('button',{name:/needs review/i})).toHaveCount(0);

  await page.reload();
  await expect(today.getByText('Due',{exact:true}).locator('..')).toHaveText(/^\s*1\s*Due\s*$/);
  await expect(today.getByText('New',{exact:true}).locator('..')).toHaveText(/^\s*9\s*New\s*$/);
  await today.getByRole('button',{name:"Resume today's review"}).click();
  await expect(page.getByText(/Card 2 of/)).toBeVisible();
  await answerCard(page);
  await expect(page.getByText(/Card 3 of/)).toBeVisible();

  await page.getByRole('button',{name:'← Back to home'}).click();
  const practice=page.getByRole('region',{name:'Practice a topic'});
  await practice.getByRole('button',{name:'Clear'}).first().click();
  await practice.getByLabel('Raft').check();
  await practice.getByRole('button',{name:'Practice 5 cards'}).click();
  await expect(page.getByText(/Practice · Card 1 of 5/)).toBeVisible();
  await answerCard(page);
  await expect(page.getByText(/Practice · Card 2 of [56]/)).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth)).toBe(false);
});
