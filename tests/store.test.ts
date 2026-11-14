import {describe,expect,it,vi} from 'vitest';
import type {Bank,Question} from '../src/types';
import {defaults,LEGACY_KEY,restore,STORAGE_KEY} from '../src/lib/store';
import {rate} from '../src/lib/scheduler';
import {advance,countRating,newSession} from '../src/lib/session';

const flashcard=(id:string):Question=>({id,version:1,type:'flashcard',topic:'Go',difficulty:'easy',language:'en',question:'?',answer:'x',explanation:'',sources:[],review_status:'draft',grading:'self_assessment'});
const bank:Bank={schema_version:'1.0.0',title:'T',created_date:'x',source_repository:'repo',source_commit:'one',generation_method:'x',review_status:'draft',questions:[flashcard('a'),flashcard('b'),flashcard('c')]};
const storageWith=(value:string|null):Storage=>({getItem:()=>value,setItem:vi.fn(),removeItem:vi.fn(),clear:vi.fn(),key:vi.fn(),length:1});
const now=new Date(2026,10,14,9,0);

describe('saved progress',()=>{
  it('starts clean and removes the v1 progress key',()=>{
    const storage=storageWith(null);
    expect(restore(bank,storage)).toEqual({store:defaults(bank)});
    expect(storage.removeItem).toHaveBeenCalledWith(LEGACY_KEY);
    expect(STORAGE_KEY).toBe('interview-review:fsrs:v1');
  });

  it('round-trips card states, the review log, new-card counts and the session',()=>{
    let store=rate(defaults(bank),'a@1',1,now);
    store={...store,session:advance(countRating(newSession('today',['a@1','b@1']),1),store.cards['a@1'],now)};
    expect(restore(bank,storageWith(JSON.stringify(store))).store).toEqual(store);
  });

  it('drops malformed entries and keeps the session on the same card when earlier cards are gone',()=>{
    const store=rate(defaults(bank),'a@1',3,now);
    const saved={...store,cards:{...store.cards,'b@1':{due:'not a date'}},log:[...store.log,{key:'b@1',rating:9}],session:{...newSession('today',['gone@1','a@1','b@1']),cursor:2,visit:{revealed:true}}};
    const restored=restore(bank,storageWith(JSON.stringify(saved)));
    expect(Object.keys(restored.store.cards)).toEqual(['a@1']);
    expect(restored.store.log).toHaveLength(1);
    expect(restored.store.session).toMatchObject({queue:['a@1','b@1'],cursor:1,visit:{revealed:true}});
    expect(restored.notice).toMatch(/no longer in the bank/);
  });

  it('recovers from corrupt, incompatible or blocked storage',()=>{
    expect(restore(bank,storageWith('{')).notice).toMatch(/corrupt/);
    expect(restore(bank,storageWith(JSON.stringify({storageVersion:2}))).notice).toMatch(/incompatible/);
    const blocked={...storageWith(''),getItem:()=>{throw Error('blocked');}};
    expect(restore(bank,blocked).store).toEqual(defaults(bank));
  });
});
