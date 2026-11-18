import {cleanup,render,screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,describe,expect,it,vi} from 'vitest';
import type {Question,StoredCard} from '../src/types';
import {QuestionCard,type RatingOption} from '../src/components/QuestionCard';
import {flashcard,multipleChoice} from './fixtures';

const mc=multipleChoice('q',undefined,{question:'Choose `one`',answer:'B',explanation:'Because.',options:[{id:'A',text:'Wrong'},{id:'B',text:'Right'}]} as Partial<Question>);
const codeReading=flashcard('q',undefined,{type:'code_reading',question:'Choose `one`',answer:'Reference solution',explanation:'Because.'} as Partial<Question>);
const card:StoredCard={due:'2026-11-20T09:00:00.000Z',stability:5,difficulty:5,elapsed_days:0,scheduled_days:6,learning_steps:0,reps:3,lapses:1,state:2};
const all:RatingOption[]=[{grade:1,label:'Again',interval:'10m'},{grade:2,label:'Hard',interval:'2d'},{grade:3,label:'Good',interval:'4d'},{grade:4,label:'Easy',interval:'9d'}];
const handlers=()=>({onVisit:vi.fn(),onSubmit:vi.fn(),onReveal:vi.fn(),onRate:vi.fn(),onNext:vi.fn()});
afterEach(cleanup);

describe('QuestionCard',()=>{
  it('hides the answer until submission and turns a wrong answer into Again with a Next button',async()=>{
    const user=userEvent.setup();
    const actions=handlers();
    const {rerender}=render(<QuestionCard q={mc} visit={{}} ratings={all.slice(1)} {...actions}/>);
    expect(screen.queryByText('Because.')).not.toBeInTheDocument();
    await user.click(screen.getByLabelText(/Wrong/));
    expect(actions.onVisit).toHaveBeenCalledWith({selected:'A'});
    rerender(<QuestionCard q={mc} visit={{selected:'A',submitted:true,rated:1}} ratings={all.slice(1)} againIn="1m" {...actions}/>);
    expect(screen.getByRole('heading',{name:'Incorrect'})).toBeInTheDocument();
    expect(screen.getByText(/back in 1m/)).toBeInTheDocument();
    expect(screen.queryByRole('group',{name:/How well/})).not.toBeInTheDocument();
    await user.click(screen.getByRole('button',{name:'Next card'}));
    expect(actions.onNext).toHaveBeenCalledOnce();
  });

  it('offers Hard, Good and Easy after a right answer, with each next interval',async()=>{
    const user=userEvent.setup();
    const actions=handlers();
    render(<QuestionCard q={mc} visit={{selected:'B',submitted:true}} ratings={all.slice(1)} {...actions}/>);
    expect(screen.getByRole('heading',{name:'Correct'})).toBeInTheDocument();
    expect(screen.queryByRole('button',{name:/^Again/})).not.toBeInTheDocument();
    await user.click(screen.getByRole('button',{name:'Good · 4d'}));
    expect(actions.onRate).toHaveBeenCalledWith(3);
  });

  it('reveals self-assessed cards, then asks for one of the four ratings',async()=>{
    const user=userEvent.setup();
    const actions=handlers();
    const {rerender}=render(<QuestionCard q={codeReading} visit={{}} card={card} ratings={all} {...actions}/>);
    expect(screen.getByText('Reviewed 3 times · forgot 1')).toBeInTheDocument();
    await user.click(screen.getByRole('button',{name:'Show solution'}));
    expect(actions.onReveal).toHaveBeenCalledOnce();
    rerender(<QuestionCard q={codeReading} visit={{revealed:true}} card={card} ratings={all} {...actions}/>);
    expect(screen.getByText('Reference solution')).toBeInTheDocument();
    expect(screen.getAllByRole('button',{name:/·/}).map(button=>button.getAttribute('aria-label'))).toEqual(['Again · 10m','Hard · 2d','Good · 4d','Easy · 9d']);
    expect(screen.queryByRole('button',{name:/needs review/i})).not.toBeInTheDocument();
  });
});
