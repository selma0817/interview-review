import {describe,expect,it} from 'vitest';
import type {Question} from '../src/types';
import {addCards,deriveTopics,newId,removeCards,slug,stampSources,validateBank,type BankDir,type Vault} from '../scripts/bankLib';
import {flashcard,sourceIn} from './fixtures';

const raftNote='Concepts/Distributed Systems/Raft/Raft Commit.md';
const mvccNote='Concepts/Computer System/Database/MVCC and Locking.md';
const casNote='Concepts/Computer System/Concurrency/Compare-and-Swap.md';
const notes:Record<string,string>={
  [raftNote]:'# Raft\n\n## Why direct commitment requires the current term\n\ntext\n\n### Mistake 1: thinking a majority is enough (mine)\n',
  [mvccNote]:'# MVCC\n\n## Lost update\n',
  [casNote]:'# CAS\n\n## Check-then-act\n'
};
const fakeVault=(override:Partial<Vault>={}):Vault=>({commit:()=>'c'.repeat(40),repoUrl:()=>'https://github.com/selma0817/cs-knowledge-base',pushed:()=>true,clean:()=>true,blobSha:path=>path in notes?'b'.repeat(40):undefined,text:path=>notes[path],...override});
const bankWith=(...files:[string,Question[]][]):BankDir=>({files:new Map(files.map(([topic,questions])=>[`${slug(topic)}.json`,{topic,questions}])),retired:new Set()});
// Feeds newId fixed picks from the 36-character alphabet: 0 → 'a', 1 → 'b', 2 → 'c'
const picks=(...letters:number[])=>{const sequence=letters.flatMap(letter=>Array(6).fill(letter));let index=0;return ()=>sequence[index++];};
const draft={type:'flashcard',difficulty:'hard',question:'Q?',answer:'A.',explanation:'Why.',provenance:'You said a majority is enough.',checks:{grounded:'pass',blind_answer:'n/a',code_run:'n/a'},sources:[{path:raftNote,heading:'Why direct commitment requires the current term'}]};

describe('topics from vault folders',()=>{
  it('uses the folder under the area, or the area for a note directly in it',()=>{
    expect(deriveTopics([{path:'Concepts/Computer System/Database/MVCC and Locking.md'}])).toEqual(['Database']);
    expect(deriveTopics([{path:'Concepts/Programming Languages/Go/Concurrency/Worker Pool.md'}])).toEqual(['Go']);
    expect(deriveTopics([{path:'Concepts/LLM/LLM Serving.md'}])).toEqual(['LLM']);
    expect(deriveTopics([{path:'Projects/GRPO DAPO Reproduction/GRPO DAPO Project Overview.md'}])).toEqual(['GRPO DAPO Reproduction']);
  });

  it('gives a card citing two folders both topics, first source first, without repeats',()=>{
    expect(deriveTopics([{path:mvccNote},{path:casNote},{path:'Concepts/Computer System/Database/B+ Tree.md'}])).toEqual(['Database','Concurrency']);
  });

  it('refuses a note that sits in no topic folder',()=>expect(()=>deriveTopics([{path:'Concepts/Interview MOC.md'}])).toThrow(/isn't inside a topic folder/));
});

describe('bank files',()=>{
  it('names topic files by slug',()=>expect(slug('GRPO DAPO Reproduction')).toBe('grpo-dapo-reproduction'));

  it('accepts a consistent bank and rejects mistakes that span files',()=>{
    expect(validateBank(bankWith(['Go',[flashcard('go-1')]],['DB',[flashcard('db-1','DB')]])).questions).toHaveLength(2);
    expect(()=>validateBank(bankWith(['Go',[flashcard('x')]],['DB',[flashcard('x','DB')]]))).toThrow(/appears in both/);
    expect(()=>validateBank(bankWith(['Go',[flashcard('db-1','DB')]]))).toThrow(/belongs in db\.json/);
    expect(()=>validateBank({...bankWith(['Go',[flashcard('go-1')]]),retired:new Set(['go-1'])})).toThrow(/retired/);
  });

  it('rejects topics that the cited notes\' folders do not give',()=>{
    expect(()=>validateBank(bankWith(['Go',[flashcard('go-1','Go',{topics:['Go','Databases']})]]))).toThrow(/notes' folders give \["Go"\]/);
  });

  it('points a malformed card to its file and field',()=>{
    expect(()=>validateBank(bankWith(['Go',[{...flashcard('go-1'),difficulty:'extreme'} as unknown as Question]]))).toThrow(/go\.json: card go-1: difficulty/);
  });
});

describe('IDs',()=>{
  it('never hands out a taken ID',()=>expect(newId('Raft',new Set(['raft-aaaaaa']),picks(0,1))).toBe('raft-bbbbbb'));
});

describe('stamping sources',()=>{
  it('pins the cited section to the pushed vault commit',()=>{
    expect(stampSources(draft.sources,fakeVault())).toEqual([{path:raftNote,heading:'Why direct commitment requires the current term',blob_sha:'b'.repeat(40),url:`https://github.com/selma0817/cs-knowledge-base/blob/${'c'.repeat(40)}/Concepts/Distributed%20Systems/Raft/Raft%20Commit.md`}]);
  });

  it('rejects made-up headings, missing notes, uncommitted notes and an unpushed vault',()=>{
    expect(()=>stampSources([{path:raftNote,heading:'Figure 8'}],fakeVault())).toThrow(/Heading "Figure 8" not found/);
    expect(()=>stampSources([{path:'Concepts/Nope.md',heading:'X'}],fakeVault())).toThrow(/not found in the vault/);
    expect(()=>stampSources(draft.sources,fakeVault({clean:()=>false}))).toThrow(/uncommitted/);
    expect(()=>stampSources(draft.sources,fakeVault({pushed:()=>false}))).toThrow(/not pushed/);
  });
});

describe('adding and removing cards',()=>{
  it('derives topics, assigns a fresh ID and adds the card to its first topic\'s file',()=>{
    const {bank,added}=addCards(bankWith(['Go',[flashcard('go-1')]]),[draft],fakeVault(),'2026-11-18',picks(0));
    expect(added).toEqual([{id:'raft-aaaaaa',file:'raft.json'}]);
    expect(bank.files.get('raft.json')!.questions[0]).toMatchObject({id:'raft-aaaaaa',version:1,topics:['Raft'],created:'2026-11-18',sources:[{blob_sha:'b'.repeat(40)}]});
  });

  it('files a two-folder card under its first topic and lists both',()=>{
    const crossTopic={...draft,sources:[{path:mvccNote,heading:'Lost update'},{path:casNote,heading:'Check-then-act'}]};
    const {bank,added}=addCards(bankWith(),[crossTopic],fakeVault(),'2026-11-18',picks(0));
    expect(added).toEqual([{id:'database-aaaaaa',file:'database.json'}]);
    expect(bank.files.get('database.json')!.questions[0].topics).toEqual(['Database','Concurrency']);
  });

  it('rejects drafts that pick their own ID or topic, carry unknown fields, or key a missing option',()=>{
    expect(()=>addCards(bankWith(),[{...draft,id:'raft-mine'}],fakeVault(),'2026-11-18')).toThrow(/has "id"/);
    expect(()=>addCards(bankWith(),[{...draft,topic:'Consensus'}],fakeVault(),'2026-11-18')).toThrow(/has "topic"/);
    expect(()=>addCards(bankWith(),[{...draft,grading:'self_assessment'}],fakeVault(),'2026-11-18')).toThrow();
    expect(()=>addCards(bankWith(),[{...draft,type:'single_choice',answer:'C',options:[{id:'A',text:'a'},{id:'B',text:'b'}],checks:{grounded:'pass',blind_answer:'pass',code_run:'n/a'}}],fakeVault(),'2026-11-18')).toThrow(/missing/);
  });

  it('retires removed IDs so a new card never inherits their FSRS history',()=>{
    const {bank}=removeCards(bankWith(['Raft',[{...flashcard('raft-aaaaaa','Raft'),sources:[sourceIn('Raft')]}]]),['raft-aaaaaa']);
    expect(bank.retired.has('raft-aaaaaa')).toBe(true);
    expect(addCards(bank,[draft],fakeVault(),'2026-11-18',picks(0,2)).added[0].id).toBe('raft-cccccc');
    expect(()=>removeCards(bank,['nope'])).toThrow(/No card/);
  });
});
