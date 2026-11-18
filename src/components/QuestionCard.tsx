import {forwardRef} from 'react';
import type {Grade,Question,StoredCard,Visit} from '../types';
import {TYPE_LABELS} from '../lib/session';
import {Markdown} from './Markdown';
import {AnswerFeedback} from './AnswerFeedback';

export type RatingOption={grade:Grade;label:string;interval:string};
type Props={q:Question;visit:Visit;card?:StoredCard;ratings:RatingOption[];againIn?:string;onVisit:(visit:Visit)=>void;onSubmit:()=>void;onReveal:()=>void;onRate:(grade:Grade)=>void;onNext:()=>void};

function RatingButtons({ratings,onRate}:{ratings:RatingOption[];onRate:(grade:Grade)=>void}){
  return <div className="rating-area"><p className="rating-prompt" id="rating-prompt">How well did you remember it?</p><div className={`rating rating-${ratings.length}`} role="group" aria-labelledby="rating-prompt">{ratings.map(option=><button key={option.grade} className={option.grade===3?'primary':''} aria-label={`${option.label} · ${option.interval}`} onClick={()=>onRate(option.grade)}><span>{option.label}</span><small>{option.interval}</small></button>)}</div></div>;
}

export const QuestionCard=forwardRef<HTMLHeadingElement,Props>(({q,visit,card,ratings,againIn,onVisit,onSubmit,onReveal,onRate,onNext},ref)=>{
  const correct=q.type==='single_choice'&&visit.selected===q.answer;
  return <article className="question-card">
    <div className="badges">{q.topics.map(topic=><span key={topic}>{topic}</span>)}<span>{TYPE_LABELS[q.type]}</span><span>{q.difficulty}</span></div>
    {card&&card.reps>0&&<p className="question-history">Reviewed {card.reps} time{card.reps===1?'':'s'} · forgot {card.lapses}</p>}
    <h2 ref={ref} tabIndex={-1}>Question</h2><Markdown>{q.question}</Markdown>
    {q.type==='single_choice'?<>
      <fieldset disabled={visit.submitted}><legend className="sr-only">Choose one answer</legend>{q.options.map(option=>{const selected=visit.selected===option.id,answer=option.id===q.answer;const state=visit.submitted?(selected?(answer?' Correct answer, selected':' Incorrect answer, selected'):(answer?' Correct answer':'')):'';return <label className={`option ${visit.submitted&&answer?'correct':''} ${visit.submitted&&selected&&!answer?'incorrect':''}`} key={option.id}><input type="radio" name={`answer-${q.id}`} checked={selected} onChange={()=>onVisit({...visit,selected:option.id})}/><strong>{option.id}.</strong> {option.text}{state&&<span className="state">—{state}</span>}</label>;})}</fieldset>
      <button className="primary" disabled={!visit.selected||visit.submitted} onClick={onSubmit}>Submit answer</button>
      {visit.submitted&&<><div role="status" aria-live="polite"><h3 className={correct?'result-good':'result-bad'}>{correct?'Correct':'Incorrect'}</h3></div><AnswerFeedback q={q}/>
        {visit.rated?<div className="rating-done"><p>Counted as <strong>Again</strong>{againIn&&<> · back in {againIn}</>}</p><button className="primary" onClick={onNext}>Next card</button></div>:<RatingButtons ratings={ratings} onRate={onRate}/>}
      </>}
    </>:<>
      <button className="primary" disabled={visit.revealed} onClick={onReveal}>Show solution</button>
      {visit.revealed&&<><AnswerFeedback q={q}/><RatingButtons ratings={ratings} onRate={onRate}/></>}
    </>}
  </article>;
});
