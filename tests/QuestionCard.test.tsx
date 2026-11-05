import {cleanup,render,screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,describe,expect,it,vi} from 'vitest';
import type {QuestionRecord} from '../src/types';
import {QuestionCard} from '../src/components/QuestionCard';

const mc:any={id:'q',version:1,type:'single_choice',topic:'Go',difficulty:'easy',language:'en',question:'Choose `one`',answer:'B',explanation:'Because.',sources:[],review_status:'draft',grading:'exact_option_id',options:[{id:'A',text:'Wrong'},{id:'B',text:'Right'}]};
const record:QuestionRecord={attempts:1,correct:0,incorrect:1,completed:true,needsReview:false,latestTimestamp:'2026-01-01T00:00:00.000Z',latestOutcome:'incorrect'};
const handlers=()=>({onVisit:vi.fn(),onSubmit:vi.fn(),onReveal:vi.fn(),onToggleReview:vi.fn()});
afterEach(cleanup);

describe('QuestionCard',()=>{
  it('reveals nothing until MC submission, then shows feedback and the one review control',async()=>{
    const user=userEvent.setup();
    const actions=handlers();
    const {rerender}=render(<QuestionCard q={mc} visit={{}} {...actions}/>);
    expect(screen.queryByText('Because.')).not.toBeInTheDocument();
    expect(screen.queryByRole('button',{name:/needs review/i})).not.toBeInTheDocument();
    await user.click(screen.getByLabelText(/Wrong/));
    expect(actions.onVisit).toHaveBeenCalledWith({selected:'A'});
    rerender(<QuestionCard q={mc} visit={{selected:'A',submitted:true}} record={record} {...actions}/>);
    expect(screen.getByRole('heading',{name:'Incorrect'})).toBeInTheDocument();
    expect(screen.getByText(/Correct answer/)).toBeInTheDocument();
    const review=screen.getByRole('button',{name:'Mark as needs review'});
    expect(review).toHaveAttribute('aria-pressed','false');
    await user.click(review);
    expect(actions.onToggleReview).toHaveBeenCalledOnce();
  });

  it('renders every non-MC type as reveal-only without a draft or Got it control',async()=>{
    const user=userEvent.setup();
    const actions=handlers();
    const codeReading={...mc,type:'code_reading',grading:'self_assessment',answer:'Reference solution',options:undefined};
    const {rerender}=render(<QuestionCard q={codeReading} visit={{}} {...actions}/>);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button',{name:'Got it'})).not.toBeInTheDocument();
    await user.click(screen.getByRole('button',{name:'Show solution'}));
    expect(actions.onReveal).toHaveBeenCalledOnce();
    rerender(<QuestionCard q={codeReading} visit={{revealed:true}} record={{...record,latestOutcome:'revealed'}} {...actions}/>);
    expect(screen.getByText('Reference solution')).toBeInTheDocument();
    expect(screen.getByRole('button',{name:'Mark as needs review'})).toBeEnabled();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('offers removal through the same review toggle when a question is marked',()=>{
    const actions=handlers();
    render(<QuestionCard q={mc} visit={{selected:'A',submitted:true}} record={{...record,needsReview:true}} {...actions}/>);
    expect(screen.getByRole('button',{name:'Remove from review'})).toHaveAttribute('aria-pressed','true');
    expect(screen.getByText('Marked for review')).toBeInTheDocument();
  });
});
