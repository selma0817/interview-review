import {describe,expect,it} from 'vitest';
import type {Question} from '../src/types';
import {addCards,deriveTopics,newId,noteTopics,parseTopicList,removeCards,retopicCards,slug,stampSources,validateBank,type BankDir,type Topic,type Vault} from '../scripts/bankLib';
import {flashcard} from './fixtures';

const topicsMd=`# Topics

### Data and storage

| Tag | Covers |
|---|---|
| \`topic/transactions\` | ACID, isolation levels, MVCC |

### Computer systems

| Tag | Covers |
|---|---|
| \`topic/concurrency\` | locks, CAS and atomics |

### Distributed systems

| Tag | Covers |
|---|---|
| \`topic/consensus\` | Raft, Paxos |

## Considered, not added yet

- \`topic/cpp\`: C/C++ systems programming
`;
const raftNote='Concepts/Distributed Systems/Raft/Raft Commit.md';
const mvccNote='Concepts/Computer System/Database/MVCC and Locking.md';
const casNote='Concepts/Computer System/Concurrency/Compare-and-Swap.md';
const notes:Record<string,string>={
  'Topics.md':topicsMd,
  [raftNote]:'---\ntags:\n  - topic/consensus\n  - raft\n---\n# Raft\n\n## Why direct commitment requires the current term\n',
  [mvccNote]:'---\ndate: 2026-09-15\ntags: [topic/transactions, topic/concurrency, mvcc]\n---\n# MVCC\n\n## Lost update\n',
  [casNote]:'---\ntags:\n  - topic/concurrency\n  - cas\n---\n# CAS\n\n## Check-then-act\n',
  'Concepts/Untagged.md':'# Untagged\n\n## Something\n',
  'Concepts/Typo.md':'---\ntags:\n  - topic/consensous\n---\n# Typo\n\n## Something\n'
};
const fakeVault=(override:Partial<Vault>={}):Vault=>({commit:()=>'c'.repeat(40),repoUrl:()=>'https://github.com/selma0817/cs-knowledge-base',pushed:()=>true,clean:()=>true,blobSha:path=>path in notes?'b'.repeat(40):undefined,text:path=>notes[path],...override});
const allowed=parseTopicList(topicsMd);
// Allows every topic its cards use, so each test isolates one rule
const bankWith=(...files:[string,Question[]][]):BankDir=>{
  const used=[...new Set(files.flatMap(([topic,questions])=>[topic,...questions.flatMap(q=>q.topics)]))].filter(name=>!allowed.some(topic=>topic.name===name));
  return {files:new Map(files.map(([topic,questions])=>[`${slug(topic)}.json`,{topic,questions}])),retired:new Set(),topics:[...allowed,...used.map((name):Topic=>({name,area:'Test',description:'test topic'}))]};
};
// Feeds newId fixed picks from the 36-character alphabet: 0 → 'a', 1 → 'b', 2 → 'c'
const picks=(...letters:number[])=>{const sequence=letters.flatMap(letter=>Array(6).fill(letter));let index=0;return ()=>sequence[index++];};
const draft={type:'flashcard',difficulty:'hard',question:'Q?',answer:'A.',explanation:'Why.',provenance:'You said a majority is enough.',checks:{grounded:'pass',blind_answer:'n/a',code_run:'n/a'},sources:[{path:raftNote,heading:'Why direct commitment requires the current term'}]};

describe('the topic list and note tags',()=>{
  it('reads tags, areas and descriptions from the table rows of Topics.md, skipping "considered" ones',()=>{
    expect(allowed).toEqual([
      {name:'transactions',area:'Data and storage',description:'ACID, isolation levels, MVCC'},
      {name:'concurrency',area:'Computer systems',description:'locks, CAS and atomics'},
      {name:'consensus',area:'Distributed systems',description:'Raft, Paxos'}
    ]);
  });

  it('reads topic/ tags from block or inline frontmatter lists, ignoring free-form tags',()=>{
    expect(noteTopics(notes[raftNote])).toEqual(['consensus']);
    expect(noteTopics(notes[mvccNote])).toEqual(['transactions','concurrency']);
    expect(noteTopics('# No frontmatter')).toEqual([]);
  });

  it('gives a card the union of its notes\' topics, first note first, without repeats',()=>{
    expect(deriveTopics([{path:mvccNote},{path:casNote}],fakeVault(),allowed)).toEqual(['transactions','concurrency']);
  });

  it('refuses an untagged note or a topic missing from Topics.md',()=>{
    expect(()=>deriveTopics([{path:'Concepts/Untagged.md'}],fakeVault(),allowed)).toThrow(/has no topic\/ tags yet\. Tag the note first/);
    expect(()=>deriveTopics([{path:'Concepts/Typo.md'}],fakeVault(),allowed)).toThrow(/topic\/consensous, which isn't defined in Topics\.md/);
  });
});

describe('bank files',()=>{
  it('accepts a consistent bank and rejects mistakes that span files',()=>{
    expect(validateBank(bankWith(['go',[flashcard('go-1')]],['db',[flashcard('db-1','db')]])).questions).toHaveLength(2);
    expect(()=>validateBank(bankWith(['go',[flashcard('x')]],['db',[flashcard('x','db')]]))).toThrow(/appears in both/);
    expect(()=>validateBank(bankWith(['go',[flashcard('db-1','db')]]))).toThrow(/belongs in db\.json/);
    expect(()=>validateBank({...bankWith(['go',[flashcard('go-1')]]),retired:new Set(['go-1'])})).toThrow(/retired/);
  });

  it('rejects topics missing from bank/topics.json, or listed twice',()=>{
    expect(()=>validateBank({...bankWith(['go',[flashcard('go-1')]]),topics:allowed})).toThrow(/"go", which isn't in bank\/topics\.json\. If Topics\.md renamed or removed it, .*bank:retopic/);
    expect(()=>validateBank(bankWith(['go',[flashcard('go-1','go',{topics:['go','go']})]]))).toThrow(/lists a topic twice/);
  });

  it('points a malformed card to its file and field',()=>{
    expect(()=>validateBank(bankWith(['go',[{...flashcard('go-1'),difficulty:'extreme'} as unknown as Question]]))).toThrow(/go\.json: card go-1: difficulty/);
  });
});

describe('IDs',()=>{
  it('never hands out a taken ID',()=>expect(newId('consensus',new Set(['consensus-aaaaaa']),picks(0,1))).toBe('consensus-bbbbbb'));
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

describe('adding, retopicking and removing cards',()=>{
  it('copies topics from the note\'s tags, assigns a fresh ID, files the card, and refreshes the topic list',()=>{
    const {bank,added}=addCards(bankWith(['concurrency',[flashcard('c-1','concurrency')]]),[draft],fakeVault(),'2026-11-18',picks(0));
    expect(added).toEqual([{id:'consensus-aaaaaa',file:'consensus.json'}]);
    expect(bank.files.get('consensus.json')!.questions[0]).toMatchObject({id:'consensus-aaaaaa',version:1,topics:['consensus'],created:'2026-11-18',sources:[{blob_sha:'b'.repeat(40)}]});
    expect(bank.topics).toEqual(allowed);
  });

  it('refuses to add while existing cards use a topic Topics.md no longer has',()=>{
    expect(()=>addCards(bankWith(['go',[flashcard('go-1')]]),[draft],fakeVault(),'2026-11-18')).toThrow(/run npm run bank:retopic/);
  });

  it('files a card citing two tagged notes under its first topic and lists both',()=>{
    const crossTopic={...draft,sources:[{path:mvccNote,heading:'Lost update'},{path:casNote,heading:'Check-then-act'}]};
    const {bank}=addCards(bankWith(),[crossTopic],fakeVault(),'2026-11-18',picks(0));
    expect(bank.files.get('transactions.json')!.questions[0].topics).toEqual(['transactions','concurrency']);
  });

  it('rejects drafts that pick their own ID or topic, carry unknown fields, or key a missing option',()=>{
    expect(()=>addCards(bankWith(),[{...draft,id:'raft-mine'}],fakeVault(),'2026-11-18')).toThrow(/has "id"/);
    expect(()=>addCards(bankWith(),[{...draft,topics:['consensus']}],fakeVault(),'2026-11-18')).toThrow(/has "topics"/);
    expect(()=>addCards(bankWith(),[{...draft,grading:'self_assessment'}],fakeVault(),'2026-11-18')).toThrow();
    expect(()=>addCards(bankWith(),[{...draft,type:'single_choice',answer:'C',options:[{id:'A',text:'a'},{id:'B',text:'b'}],checks:{grounded:'pass',blind_answer:'pass',code_run:'n/a'}}],fakeVault(),'2026-11-18')).toThrow(/missing/);
  });

  it('re-copies topics from current note tags and moves cards to their new first topic\'s file',()=>{
    const stale=flashcard('mvcc-1','storage-indexing',{sources:[{path:mvccNote,heading:'Lost update',blob_sha:'b'.repeat(40),url:'https://github.com/o/v/blob/c/x.md'}]});
    const {bank,changes}=retopicCards(bankWith(['storage-indexing',[stale]]),fakeVault());
    expect(changes).toEqual([{id:'mvcc-1',from:['storage-indexing'],to:['transactions','concurrency']}]);
    expect([...bank.files.keys()]).toEqual(['transactions.json']);
  });

  it('retires removed IDs, drops emptied files, and never reuses the ID',()=>{
    const {bank,changed}=removeCards(bankWith(['consensus',[flashcard('consensus-aaaaaa','consensus')]]),['consensus-aaaaaa']);
    expect(bank.retired.has('consensus-aaaaaa')).toBe(true);
    expect(bank.files.has('consensus.json')).toBe(false);
    expect(changed).toEqual([]);
    expect(addCards(bank,[draft],fakeVault(),'2026-11-18',picks(0,2)).added[0].id).toBe('consensus-cccccc');
    expect(()=>removeCards(bank,['nope'])).toThrow(/No card/);
  });
});
