import {forwardRef} from 'react';
import type {Question,QuestionRecord,Visit} from '../types';
import {TYPE_LABELS} from '../lib/session';
import {Markdown} from './Markdown';
import {AnswerFeedback} from './AnswerFeedback';

type Props={q:Question;visit:Visit;record?:QuestionRecord;onVisit:(visit:Visit)=>void;onSubmit:()=>void;onReveal:()=>void;onToggleReview:()=>void};

function ReviewToggle({marked,onToggle}:{marked:boolean;onToggle:()=>void}){
  return <div className="review-control" aria-live="polite"><button type="button" aria-pressed={marked} className={marked?'review-marked':''} onClick={onToggle}>{marked?'Remove from review':'Mark as needs review'}</button>{marked&&<span>Marked for review</span>}</div>;
}

export const QuestionCard=forwardRef<HTMLHeadingElement,Props>(({q,visit,record,onVisit,onSubmit,onReveal,onToggleReview},ref)=>{
  const correct=q.type==='single_choice'&&visit.selected===q.answer;
  return <article className="question-card">
    <div className="badges"><span>{q.topic}</span><span>{TYPE_LABELS[q.type]}</span><span>{q.difficulty}</span></div>
    {record&&<p className="question-history">History · {record.attempts} attempt{record.attempts===1?'':'s'}{record.incorrect>0?` · ${record.incorrect} incorrect`:''}{record.needsReview?' · Needs review':''}</p>}
    <h2 ref={ref} tabIndex={-1}>Question</h2><Markdown>{q.question}</Markdown>
    {q.type==='single_choice'?<>
      <fieldset disabled={visit.submitted}><legend className="sr-only">Choose one answer</legend>{q.options.map(option=>{const selected=visit.selected===option.id,answer=option.id===q.answer;const state=visit.submitted?(selected?(answer?' Correct answer, selected':' Incorrect answer, selected'):(answer?' Correct answer':'')):'';return <label className={`option ${visit.submitted&&answer?'correct':''} ${visit.submitted&&selected&&!answer?'incorrect':''}`} key={option.id}><input type="radio" name={`answer-${q.id}`} checked={selected} onChange={()=>onVisit({...visit,selected:option.id})}/><strong>{option.id}.</strong> {option.text}{state&&<span className="state">—{state}</span>}</label>;})}</fieldset>
      <button className="primary" disabled={!visit.selected||visit.submitted} onClick={onSubmit}>Submit answer</button>
      {visit.submitted&&<><div role="status" aria-live="polite"><h3 className={correct?'result-good':'result-bad'}>{correct?'Correct':'Incorrect'}</h3></div><AnswerFeedback q={q}/><ReviewToggle marked={!!record?.needsReview} onToggle={onToggleReview}/></>}
    </>:<>
      <button className="primary" disabled={visit.revealed} onClick={onReveal}>Show solution</button>
      {visit.revealed&&<><AnswerFeedback q={q}/><ReviewToggle marked={!!record?.needsReview} onToggle={onToggleReview}/></>}
    </>}
  </article>;
});
