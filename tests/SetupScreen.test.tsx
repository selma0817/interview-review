import {render,screen,within} from '@testing-library/react';
import {describe,expect,it,vi} from 'vitest';
import type {Bank,Progress} from '../src/types';
import {SetupScreen} from '../src/components/SetupScreen';
import {defaults,recordOutcome,toggleNeedsReview} from '../src/lib/progress';

const common={version:1,difficulty:'easy' as const,language:'en',question:'Question',explanation:'Explanation',sources:[],review_status:'draft'};
const bank={schema_version:'1.0.0',title:'Test',created_date:'x',source_repository:'repo',source_commit:'one',generation_method:'test',review_status:'draft',questions:[
  {...common,id:'go-1',topic:'Go',type:'single_choice' as const,answer:'A',grading:'exact_option_id' as const,options:[{id:'A',text:'Yes'},{id:'B',text:'No'}]},
  {...common,id:'go-2',topic:'Go',type:'flashcard' as const,answer:'Answer',grading:'self_assessment' as const},
  {...common,id:'db-1',topic:'DB',type:'flashcard' as const,answer:'Answer',grading:'self_assessment' as const}
]} as Bank;

describe('SetupScreen progress',()=>{
  it('shows overall and per-topic completion plus independent new/review counts',()=>{
    const progress=defaults(bank);
    progress.records['go-1@1']=toggleNeedsReview(recordOutcome(undefined,'incorrect'));
    render(<SetupScreen bank={bank} progress={progress} onSettings={vi.fn()} onStart={vi.fn()} onResume={vi.fn()} onReset={vi.fn()}/>);
    expect(screen.getByRole('heading',{name:'1 of 3 completed'})).toBeInTheDocument();
    expect(screen.getByRole('progressbar',{name:'Overall completion'})).toHaveValue(1);
    expect(screen.getByRole('progressbar',{name:'Go: 1 of 2 completed'})).toHaveValue(1);
    expect(screen.getByRole('button',{name:'Practice new questions (2)'})).toBeEnabled();
    expect(screen.getByRole('button',{name:'Review marked questions (1)'})).toBeEnabled();
    expect(within(screen.getByRole('heading',{level:3,name:'Go'}).closest('article')!).getByText(/1 answered incorrectly before/)).toBeInTheDocument();
  });
});
