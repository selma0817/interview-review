import {describe,expect,it} from 'vitest';import {parseBank} from '../src/lib/questionBank';
import {bankOf,flashcard,multipleChoice} from './fixtures';
describe('question bank validation (schema 2.0.0)',()=>{
  it('accepts the contract',()=>expect(parseBank(bankOf([multipleChoice('q1'),flashcard('q2')])).questions).toHaveLength(2));
  it('rejects duplicate ids',()=>expect(()=>parseBank(bankOf([flashcard('q1'),flashcard('q1')]))).toThrow(/Duplicate question ID/));
  it('rejects an invalid answer reference',()=>expect(()=>parseBank(bankOf([multipleChoice('q1',undefined,{answer:'Z'})]))).toThrow(/missing/));
  it('rejects unsupported types and leftover v1 fields',()=>{expect(()=>parseBank(bankOf([{...flashcard('q1'),type:'essay'} as any]))).toThrow();expect(()=>parseBank(bankOf([{...flashcard('q1'),grading:'self_assessment'} as any]))).toThrow();});
  it('requires every source to be stamped with a blob hash and URL',()=>expect(()=>parseBank(bankOf([flashcard('q1',undefined,{sources:[{path:'a.md',heading:'H'} as any]})]))).toThrow());
});
