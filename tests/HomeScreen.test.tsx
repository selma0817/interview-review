import {cleanup,render,screen,within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,describe,expect,it,vi} from 'vitest';
import type {Bank} from '../src/types';
import {HomeScreen} from '../src/components/HomeScreen';
import {defaults} from '../src/lib/store';
import {rate} from '../src/lib/scheduler';

const common={version:1,difficulty:'easy' as const,language:'en',question:'Question',explanation:'Explanation',sources:[],review_status:'draft'};
const bank={schema_version:'1.0.0',title:'Test',created_date:'x',source_repository:'repo',source_commit:'one',generation_method:'test',review_status:'draft',questions:[
  {...common,id:'go-1',topic:'Go',type:'single_choice' as const,answer:'A',grading:'exact_option_id' as const,options:[{id:'A',text:'Yes'},{id:'B',text:'No'}]},
  {...common,id:'go-2',topic:'Go',type:'flashcard' as const,answer:'Answer',grading:'self_assessment' as const},
  {...common,id:'db-1',topic:'DB',type:'flashcard' as const,answer:'Answer',grading:'self_assessment' as const}
]} as Bank;
afterEach(cleanup);

describe('HomeScreen',()=>{
  it('shows due and new counts, per-topic due counts, and the practice size',async()=>{
    const user=userEvent.setup();
    const store=rate(defaults(bank),'go-1@1',1,new Date(2026,10,14,9,0));
    const actions={onSettings:vi.fn(),onStart:vi.fn(),onResume:vi.fn(),onReset:vi.fn()};
    render(<HomeScreen bank={bank} store={store} now={new Date(2026,10,14,9,5)} {...actions}/>);
    const today=screen.getByRole('region',{name:'Today'});
    expect(within(today).getByText('Due').previousSibling).toHaveTextContent('1');
    expect(within(today).getByText('New').previousSibling).toHaveTextContent('2');
    expect(within(screen.getByRole('heading',{level:3,name:'Go'}).closest('article')!).getByText('1 due')).toBeInTheDocument();
    await user.click(screen.getByRole('button',{name:"Start today's review (3)"}));
    expect(actions.onStart).toHaveBeenCalledWith('today');
    expect(screen.getByRole('button',{name:'Practice 3 cards'})).toBeEnabled();
    expect(screen.queryByRole('button',{name:/marked/i})).not.toBeInTheDocument();
  });

  it('disables practice when the filters match nothing',()=>{
    const store={...defaults(bank),settings:{topics:['Go'],types:[]}};
    render(<HomeScreen bank={bank} store={store} now={new Date(2026,10,14,9,0)} onSettings={vi.fn()} onStart={vi.fn()} onResume={vi.fn()} onReset={vi.fn()}/>);
    expect(screen.getByRole('button',{name:'Practice 0 cards'})).toBeDisabled();
    expect(screen.getByText('No cards match these filters.')).toBeInTheDocument();
  });
});
