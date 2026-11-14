import type {Bank,Grade,Session,Store} from '../types';
import {formatInterval,GRADE_LABELS,nextDue} from '../lib/scheduler';

export function SessionSummary({bank,session,store,now,onHome}:{bank:Bank;session:Session;store:Store;now:Date;onHome:()=>void}){
  const grades:Grade[]=[1,2,3,4];
  const reviewed=grades.reduce((sum,grade)=>sum+session.counts[grade],0);
  const next=nextDue(bank,store);
  return <main><header><p className="eyebrow">SESSION COMPLETE</p><h1>Review summary</h1><p>{session.kind==='today'?"Today's review":'Topic practice'} · {reviewed} rating{reviewed===1?'':'s'}</p></header>
    <section className="panel summary" aria-label="Ratings this session">{grades.map(grade=><div key={grade}><strong>{session.counts[grade]}</strong><span>{GRADE_LABELS[grade]}</span></div>)}</section>
    {next&&<p className="notice">Next card due {next<=now?'now':`in ${formatInterval(now,next)}`}.</p>}
    <button className="primary" onClick={onHome}>Back to home</button></main>;
}
