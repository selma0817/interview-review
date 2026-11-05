import type {Bank,Progress,QuestionType,SessionKind,Settings} from '../types';
import {TYPE_LABELS,candidates,topicProgress} from '../lib/session';

type Props={bank:Bank;progress:Progress;onSettings:(settings:Settings)=>void;onStart:(kind:SessionKind)=>void;onResume:()=>void;onReset:()=>void};

export function SetupScreen({bank,progress,onSettings,onStart,onResume,onReset}:Props){
  const topics=[...new Set(bank.questions.map(q=>q.topic))];
  const types=[...new Set(bank.questions.map(q=>q.type))];
  const stats=topicProgress(bank,progress);
  const completed=stats.reduce((sum,item)=>sum+item.completed,0);
  const newCount=candidates(bank,progress,'new').length;
  const reviewCount=candidates(bank,progress,'review').length;
  const set=(patch:Partial<Settings>)=>onSettings({...progress.settings,...patch});
  const toggle=(field:'topics'|'types',value:string)=>{const values=progress.settings[field] as string[];set({[field]:values.includes(value)?values.filter(x=>x!==value):[...values,value]});};
  return <main>
    <header><p className="eyebrow">TECHNICAL INTERVIEW PRACTICE</p><h1>Interview Concepts Review</h1><p>Refresh interview concepts from your question bank. {bank.questions.length} questions available.</p></header>
    <section className="panel progress-panel" aria-labelledby="progress-heading">
      <div className="progress-heading"><div><p className="eyebrow">YOUR PROGRESS</p><h2 id="progress-heading">{completed} of {bank.questions.length} completed</h2></div><strong>{Math.round(completed/bank.questions.length*100)}%</strong></div>
      <progress max={bank.questions.length} value={completed} aria-label="Overall completion"/>
      <p className="notice">Completed means submitted or revealed; it does not necessarily mean answered correctly.</p>
      <div className="topic-progress">{stats.map(item=><article key={item.topic} className="topic-row"><div className="topic-row-heading"><h3>{item.topic}</h3><strong>{item.completed}/{item.total}</strong></div><progress max={item.total} value={item.completed} aria-label={`${item.topic}: ${item.completed} of ${item.total} completed`}/><p>{item.needsReview} need review · {item.previouslyIncorrect} answered incorrectly before</p></article>)}</div>
    </section>
    <section className="panel filters" aria-labelledby="practice-heading"><h2 id="practice-heading">Choose your practice</h2>
      <fieldset><legend>Topics</legend><div className="controls"><button type="button" className="link" onClick={()=>set({topics})}>Select all</button><button type="button" className="link" onClick={()=>set({topics:[]})}>Clear</button></div><div className="checks">{topics.map(topic=><label key={topic}><input type="checkbox" checked={progress.settings.topics.includes(topic)} onChange={()=>toggle('topics',topic)}/>{topic}</label>)}</div></fieldset>
      <fieldset><legend>Question types</legend><div className="controls"><button type="button" className="link" onClick={()=>set({types})}>Select all</button><button type="button" className="link" onClick={()=>set({types:[]})}>Clear</button></div><div className="checks">{types.map((type:QuestionType)=><label key={type}><input type="checkbox" checked={progress.settings.types.includes(type)} onChange={()=>toggle('types',type)}/>{TYPE_LABELS[type]}</label>)}</div></fieldset>
      <p className="notice">Questions are shuffled when a session starts. A saved session keeps its existing order.</p>
      <div className="start-actions"><div><button className="primary" disabled={!newCount} onClick={()=>onStart('new')}>Practice new questions ({newCount})</button>{!newCount&&<p>No new questions match these filters.</p>}</div><div><button disabled={!reviewCount} onClick={()=>onStart('review')}>Review marked questions ({reviewCount})</button>{!reviewCount&&<p>No marked questions match these filters.</p>}</div>{progress.session&&<button onClick={onResume}>Resume {progress.session.finished?'summary':'saved session'}</button>}</div>
    </section>
    <p className="notice">Progress is saved in this browser and does not sync between devices.</p><button className="danger-link" onClick={onReset}>Reset progress</button>
  </main>;
}
