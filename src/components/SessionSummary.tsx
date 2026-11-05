import type {Bank,Progress,Session} from '../types';
import {keyOf} from '../types';

export function SessionSummary({bank,session,progress,onNew}:{bank:Bank;session:Session;progress:Progress;onNew:()=>void}){
  let completed=0,correct=0,incorrect=0,revealed=0,marked=0;
  for(const item of session.queue){
    const question=bank.questions.find(q=>q.id===item.id&&q.version===item.version);
    const visit=session.visits[keyOf(item.id,item.version)];
    if(!question)continue;
    if(progress.records[keyOf(item.id,item.version)]?.needsReview)marked++;
    if(!visit)continue;
    if(question.type==='single_choice'&&visit.submitted){completed++;visit.selected===question.answer?correct++:incorrect++;}
    else if(question.type!=='single_choice'&&visit.revealed){completed++;revealed++;}
  }
  return <main><header><p className="eyebrow">SESSION COMPLETE</p><h1>Review summary</h1><p>{session.kind==='new'?'New questions':'Marked questions'} session</p></header><section className="panel summary"><div><strong>{completed}</strong><span>Completed</span></div><div><strong>{session.queue.length-completed}</strong><span>Skipped</span></div><div><strong>{correct}</strong><span>MC correct</span></div><div><strong>{incorrect}</strong><span>MC incorrect</span></div><div><strong>{revealed}</strong><span>Solutions viewed</span></div><div><strong>{marked}</strong><span>Still marked</span></div></section><button className="primary" onClick={onNew}>Back to progress</button></main>;
}
