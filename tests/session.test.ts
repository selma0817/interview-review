import {describe,expect,it,vi} from 'vitest';
import type {Bank,Question,QuestionRecord} from '../src/types';
import {defaults,recordOutcome,restore,STORAGE_KEY,toggleNeedsReview} from '../src/lib/progress';
import {candidates,newSession,shuffleQuestions,topicProgress} from '../src/lib/session';

const mc:Question={id:'a',version:1,type:'single_choice',topic:'Go',difficulty:'easy',language:'en',question:'?',answer:'A',explanation:'',sources:[],review_status:'draft',grading:'exact_option_id',options:[{id:'A',text:'a'},{id:'B',text:'b'}]};
const flashcard:Question={id:'b',version:1,type:'flashcard',topic:'DB',difficulty:'easy',language:'en',question:'?',answer:'x',explanation:'',sources:[],review_status:'draft',grading:'self_assessment'};
const secondGo:Question={...flashcard,id:'c',topic:'Go'};
const bank:Bank={schema_version:'1.0.0',title:'T',created_date:'x',source_repository:'repo',source_commit:'one',generation_method:'x',review_status:'draft',questions:[mc,flashcard,secondGo]};
const storageWith=(value:string):Storage=>({getItem:()=>value,setItem:vi.fn(),removeItem:vi.fn(),clear:vi.fn(),key:vi.fn(),length:1});

describe('completion, review selection and sessions',()=>{
  it('intersects topic/type filters independently for new and marked questions',()=>{
    const progress=defaults(bank);
    progress.settings={topics:['Go'],types:['single_choice']};
    progress.records['a@1']={...recordOutcome(undefined,'incorrect'),needsReview:true};
    expect(candidates(bank,progress,'new')).toEqual([]);
    expect(candidates(bank,progress,'review').map(q=>q.id)).toEqual(['a']);
    progress.settings.types=['flashcard'];
    expect(candidates(bank,progress,'new').map(q=>q.id)).toEqual(['c']);
    expect(candidates(bank,progress,'review')).toEqual([]);
  });

  it('tracks a wrong answer as completed without automatically marking it for review',()=>{
    const wrong=recordOutcome(undefined,'incorrect');
    expect(wrong).toMatchObject({attempts:1,correct:0,incorrect:1,completed:true,needsReview:false,latestOutcome:'incorrect'});
    const laterCorrect=recordOutcome(wrong,'correct');
    expect(laterCorrect).toMatchObject({attempts:2,correct:1,incorrect:1,completed:true,needsReview:false});
  });

  it('toggles review without changing attempts or incorrect history',()=>{
    const wrong=recordOutcome(undefined,'incorrect');
    const marked=toggleNeedsReview(wrong);
    const removed=toggleNeedsReview(marked);
    expect(marked).toMatchObject({needsReview:true,attempts:1,incorrect:1});
    expect(removed).toMatchObject({needsReview:false,attempts:1,incorrect:1});
  });

  it('shuffles once at creation and keeps the queue snapshot after review status changes',()=>{
    const questions=[mc,flashcard,secondGo];
    expect(shuffleQuestions(questions,()=>0).map(q=>q.id)).toEqual(['b','c','a']);
    const session=newSession(questions,'review',()=>0);
    const record:QuestionRecord={...recordOutcome(undefined,'revealed'),needsReview:true};
    const removed=toggleNeedsReview(record);
    expect(removed.needsReview).toBe(false);
    expect(session.queue.map(q=>q.id)).toEqual(['b','c','a']);
    expect(session.kind).toBe('review');
  });

  it('computes per-topic completion, marked, and previously-incorrect question counts',()=>{
    const progress=defaults(bank);
    progress.records['a@1']={...recordOutcome(undefined,'incorrect'),needsReview:true};
    progress.records['c@1']=recordOutcome(undefined,'revealed');
    expect(topicProgress(bank,progress)).toContainEqual({topic:'Go',completed:2,total:2,needsReview:1,previouslyIncorrect:1});
  });

  it('treats a changed version as new while retaining obsolete history',()=>{
    const progress=defaults(bank);
    progress.records['a@1']=recordOutcome(undefined,'correct');
    const updated={...bank,source_commit:'two',questions:[{...mc,version:2},flashcard,secondGo]} as Bank;
    const restored=restore(updated,storageWith(JSON.stringify(progress))).progress;
    expect(restored.records['a@1'].completed).toBe(true);
    expect(candidates(updated,restored,'new').map(q=>`${q.id}@${q.version}`)).toContain('a@2');
  });

  it('migrates old outcomes without treating an automatic wrong status as an explicit review mark',()=>{
    const old={...defaults(bank),records:{'a@1':{attempts:1,correct:0,status:'needs_review',latestTimestamp:'2026-01-01T00:00:00.000Z',latestOutcome:'incorrect'},'b@1':{attempts:1,correct:0,status:'needs_review',latestTimestamp:'2026-01-01T00:00:00.000Z',latestOutcome:'needs_review'}}};
    const restored=restore(bank,storageWith(JSON.stringify(old))).progress;
    expect(restored.records['a@1']).toMatchObject({completed:true,incorrect:1,needsReview:false});
    expect(restored.records['b@1']).toMatchObject({completed:true,incorrect:0,needsReview:true,latestOutcome:'revealed'});
  });

  it('recovers from malformed or blocked storage and owns only its app key',()=>{
    expect(restore(bank,storageWith('{')).notice).toMatch(/corrupt/);
    const blocked={...storageWith(''),getItem:()=>{throw Error('blocked');}};
    expect(restore(bank,blocked).progress.records).toEqual({});
    expect(STORAGE_KEY).toBe('cs-review:progress:v1');
  });
});
