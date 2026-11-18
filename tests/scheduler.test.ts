import {describe,expect,it} from 'vitest';
import {defaults} from '../src/lib/store';
import {dueToday,formatInterval,isNew,NEW_PER_DAY,newKeys,newSlots,practiceQueue,preview,rate,todayQueue} from '../src/lib/scheduler';
import {advance,autoGrade,countRating,newSession} from '../src/lib/session';
import {bankOf,flashcard,multipleChoice} from './fixtures';

const mc=multipleChoice('mc');
// Local time, so day boundaries follow the machine's time zone like the app does
const at=(day:number,hour=9,minute=0)=>new Date(2026,10,day,hour,minute);

describe('grading',()=>{
  it('makes a wrong multiple-choice answer Again and leaves everything else to the user',()=>{
    expect(autoGrade(mc,'B')).toBe(1);
    expect(autoGrade(mc,'A')).toBeUndefined();
    expect(autoGrade(flashcard('f'),undefined)).toBeUndefined();
  });

  it('previews later intervals for better ratings and logs every review',()=>{
    const bank=bankOf([flashcard('a')]);
    const next=preview(defaults(bank),'a@1',at(14));
    expect(next[1].getTime()).toBeLessThan(next[3].getTime());
    expect(next[3].getTime()).toBeLessThan(next[4].getTime());
    const store=rate(rate(defaults(bank),'a@1',1,at(14)),'a@1',3,at(14,9,2));
    expect(store.log.map(entry=>[entry.key,entry.rating])).toEqual([['a@1',1],['a@1',3]]);
    expect(store.cards['a@1'].reps).toBe(2);
  });
});

describe('daily queue',()=>{
  it('caps new cards per local day and resets the cap at midnight',()=>{
    const bank=bankOf(Array.from({length:12},(_,index)=>flashcard(`c${index}`)));
    let store=defaults(bank);
    for(const key of todayQueue(bank,store,at(14)))store=rate(store,key,3,at(14));
    expect(newSlots(store,at(14))).toBe(0);
    expect(todayQueue(bank,store,at(14,9,30)).filter(key=>isNew(store,key))).toEqual([]);
    expect(newKeys(bank,store)).toHaveLength(2);
    expect(newSlots(store,at(14,23,59))).toBe(0);
    expect(newSlots(store,at(15,0,1))).toBe(NEW_PER_DAY);
  });

  it('lists started cards due before the end of the local day, earliest first',()=>{
    const bank=bankOf([flashcard('a'),flashcard('b'),flashcard('c')]);
    let store=rate(defaults(bank),'b@1',3,at(14));
    store=rate(store,'a@1',1,at(14));
    store=rate(store,'c@1',4,at(14));
    expect(dueToday(bank,store,at(14,9,30))).toEqual(['a@1','b@1']);
    const easyDue=new Date(store.cards['c@1'].due);
    expect(easyDue.getTime()).toBeGreaterThan(at(15).getTime());
    expect(dueToday(bank,store,easyDue)).toContain('c@1');
  });

  it('introduces older cards first, whatever their order in the bank',()=>{
    const bank=bankOf([flashcard('newest',undefined,{created:'2026-11-20'}),flashcard('oldest',undefined,{created:'2026-11-01'}),flashcard('middle',undefined,{created:'2026-11-10'})]);
    expect(newKeys(bank,defaults(bank))).toEqual(['oldest@1','middle@1','newest@1']);
  });

  it('treats a new version of a card as a fresh card',()=>{
    const store=rate(defaults(bankOf([flashcard('a')])),'a@1',4,at(14));
    const updated=bankOf([{...flashcard('a'),version:2}]);
    expect(isNew(store,'a@2')).toBe(true);
    expect(newKeys(updated,store)).toEqual(['a@2']);
  });
});

describe('sessions',()=>{
  it('brings a card in short-term learning back at the end of the same session',()=>{
    const bank=bankOf([flashcard('a'),flashcard('b')]);
    let session=newSession('today',['a@1','b@1']);
    let store=rate(defaults(bank),'a@1',1,at(14));
    session=advance(countRating(session,1),store.cards['a@1'],at(14));
    expect(session).toMatchObject({queue:['a@1','b@1','a@1'],cursor:1,finished:false});
    store=rate(store,'b@1',4,at(14,9,1));
    session=advance(countRating(session,4),store.cards['b@1'],at(14,9,1));
    expect(session.queue).toHaveLength(3);
    store=rate(store,'a@1',4,at(14,9,2));
    session=advance(countRating(session,4),store.cards['a@1'],at(14,9,2));
    expect(session).toMatchObject({cursor:3,finished:true,counts:{1:1,2:0,3:0,4:2}});
  });

  it('does not queue a card twice when it is already coming up',()=>{
    const store=rate(defaults(bankOf([flashcard('a'),flashcard('b')])),'a@1',1,at(14));
    const session=advance(newSession('practice',['a@1','b@1','a@1']),store.cards['a@1'],at(14));
    expect(session.queue).toEqual(['a@1','b@1','a@1']);
  });

  it('lets a card with two topics match a filter on either one',()=>{
    const crossTopic=flashcard('mvcc','transactions',{topics:['transactions','concurrency']});
    const bank=bankOf([crossTopic,flashcard('go-1')]);
    expect(practiceQueue(bank,defaults(bank),{topics:['concurrency'],types:['flashcard']},at(14))).toEqual(['mvcc@1']);
  });

  it('orders practice by lowest recall first, new cards last, within the filters',()=>{
    const bank=bankOf([flashcard('old'),flashcard('recent'),flashcard('fresh'),flashcard('db','storage-indexing')]);
    let store=rate(defaults(bank),'old@1',4,at(1));
    store=rate(store,'recent@1',4,at(13));
    expect(practiceQueue(bank,store,{topics:['go'],types:['flashcard']},at(14))).toEqual(['old@1','recent@1','fresh@1']);
  });
});

describe('formatInterval',()=>{
  it('uses the largest sensible unit',()=>{
    const now=at(14);
    const later=(minutes:number)=>new Date(now.getTime()+minutes*60_000);
    expect([0.5,10,180,4*1440,60*1440,400*1440].map(minutes=>formatInterval(now,later(minutes)))).toEqual(['1m','10m','3h','4d','2mo','1.1y']);
  });
});
