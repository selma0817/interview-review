import {describe,expect,it} from 'vitest';
import type {Question} from '../src/types';
import {addCards,newId,removeCards,slug,stampSources,validateBank,type BankDir,type Vault} from '../scripts/bankLib';
import {flashcard} from './fixtures';

const notePath='Concepts/Raft Commit.md';
const note='# Raft\n\n## Why direct commitment requires the current term\n\ntext\n\n### Mistake 1: thinking a majority is enough (mine)\n';
const fakeVault=(override:Partial<Vault>={}):Vault=>({commit:()=>'c'.repeat(40),repoUrl:()=>'https://github.com/selma0817/cs-knowledge-base',pushed:()=>true,clean:()=>true,blobSha:path=>path===notePath?'b'.repeat(40):undefined,text:path=>path===notePath?note:undefined,...override});
const bankWith=(...files:[string,Question[]][]):BankDir=>({files:new Map(files.map(([topic,questions])=>[`${slug(topic)}.json`,{topic,questions}])),retired:new Set()});
// Feeds newId fixed picks from the 36-character alphabet: 0 → 'a', 1 → 'b', 2 → 'c'
const picks=(...letters:number[])=>{const sequence=letters.flatMap(letter=>Array(6).fill(letter));let index=0;return ()=>sequence[index++];};
const draft={topic:'Raft',type:'flashcard',difficulty:'hard',question:'Q?',answer:'A.',explanation:'Why.',provenance:'You said a majority is enough.',checks:{grounded:'pass',blind_answer:'n/a',code_run:'n/a'},sources:[{path:notePath,heading:'Why direct commitment requires the current term'}]};

describe('bank files',()=>{
  it('names topic files by slug',()=>expect(slug('Go concurrency')).toBe('go-concurrency'));

  it('accepts a consistent bank and rejects mistakes that span files',()=>{
    expect(validateBank(bankWith(['Go',[flashcard('go-1')]],['DB',[flashcard('db-1','DB')]])).questions).toHaveLength(2);
    expect(()=>validateBank(bankWith(['Go',[flashcard('x')]],['DB',[flashcard('x','DB')]]))).toThrow(/appears in both/);
    expect(()=>validateBank(bankWith(['Go',[flashcard('db-1','DB')]]))).toThrow(/expected "Go"/);
    expect(()=>validateBank({...bankWith(['Go',[flashcard('go-1')]]),retired:new Set(['go-1'])})).toThrow(/retired/);
  });
});

describe('IDs',()=>{
  it('never hands out a taken ID',()=>expect(newId('Raft',new Set(['raft-aaaaaa']),picks(0,1))).toBe('raft-bbbbbb'));
});

describe('stamping sources',()=>{
  it('pins the cited section to the pushed vault commit',()=>{
    expect(stampSources(draft.sources,fakeVault())).toEqual([{path:notePath,heading:'Why direct commitment requires the current term',blob_sha:'b'.repeat(40),url:`https://github.com/selma0817/cs-knowledge-base/blob/${'c'.repeat(40)}/Concepts/Raft%20Commit.md`}]);
  });

  it('rejects made-up headings, missing notes, uncommitted notes and an unpushed vault',()=>{
    expect(()=>stampSources([{path:notePath,heading:'Figure 8'}],fakeVault())).toThrow(/Heading "Figure 8" not found/);
    expect(()=>stampSources([{path:'Concepts/Nope.md',heading:'X'}],fakeVault())).toThrow(/not found in the vault/);
    expect(()=>stampSources(draft.sources,fakeVault({clean:()=>false}))).toThrow(/uncommitted/);
    expect(()=>stampSources(draft.sources,fakeVault({pushed:()=>false}))).toThrow(/not pushed/);
  });
});

describe('adding and removing cards',()=>{
  it('adds a stamped card with a fresh ID to its topic file, creating the file if needed',()=>{
    const {bank,added}=addCards(bankWith(['Go',[flashcard('go-1')]]),[draft],fakeVault(),'2026-11-18',picks(0));
    expect(added).toEqual([{id:'raft-aaaaaa',file:'raft.json'}]);
    expect(bank.files.get('raft.json')!.questions[0]).toMatchObject({id:'raft-aaaaaa',version:1,created:'2026-11-18',sources:[{blob_sha:'b'.repeat(40)}]});
  });

  it('rejects drafts that pick their own ID, carry unknown fields, or key a missing option',()=>{
    expect(()=>addCards(bankWith(),[{...draft,id:'raft-mine'}],fakeVault(),'2026-11-18')).toThrow(/assigned by bank:add/);
    expect(()=>addCards(bankWith(),[{...draft,grading:'self_assessment'}],fakeVault(),'2026-11-18')).toThrow();
    expect(()=>addCards(bankWith(),[{...draft,type:'single_choice',answer:'C',options:[{id:'A',text:'a'},{id:'B',text:'b'}],checks:{grounded:'pass',blind_answer:'pass',code_run:'n/a'}}],fakeVault(),'2026-11-18')).toThrow(/missing/);
  });

  it('retires removed IDs so a new card never inherits their FSRS history',()=>{
    const {bank}=removeCards(bankWith(['Raft',[flashcard('raft-aaaaaa','Raft')]]),['raft-aaaaaa']);
    expect(bank.retired.has('raft-aaaaaa')).toBe(true);
    expect(addCards(bank,[draft],fakeVault(),'2026-11-18',picks(0,2)).added[0].id).toBe('raft-cccccc');
    expect(()=>removeCards(bank,['nope'])).toThrow(/No card/);
  });
});
