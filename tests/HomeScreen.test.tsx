import {cleanup,render,screen,within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {HomeScreen} from '../src/components/HomeScreen';
import {defaults} from '../src/lib/store';
import {rate} from '../src/lib/scheduler';
import {bankOf,flashcard,multipleChoice} from './fixtures';

const bank=bankOf([multipleChoice('go-1'),flashcard('go-2'),flashcard('db-1','DB')]);
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
