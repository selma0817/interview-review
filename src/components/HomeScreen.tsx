import type {Bank,QuestionType,SessionKind,Settings,Store} from '../types';
import {TYPE_LABELS} from '../lib/session';
import {dueToday,matchesFilters,newKeys,newSlots,topicStats} from '../lib/scheduler';

type Props={bank:Bank;store:Store;now:Date;onSettings:(settings:Settings)=>void;onStart:(kind:SessionKind)=>void;onResume:()=>void;onReset:()=>void};

export function HomeScreen({bank,store,now,onSettings,onStart,onResume,onReset}:Props){
  const topics=[...new Set(bank.questions.map(q=>q.topic))];
  const types=[...new Set(bank.questions.map(q=>q.type))];
  const due=dueToday(bank,store,now).length;
  const fresh=Math.min(newKeys(bank,store).length,newSlots(store,now));
  const practiceCount=bank.questions.filter(q=>matchesFilters(q,store.settings)).length;
  const session=store.session;
  const set=(patch:Partial<Settings>)=>onSettings({...store.settings,...patch});
  const toggle=(field:'topics'|'types',value:string)=>{const values=store.settings[field] as string[];set({[field]:values.includes(value)?values.filter(x=>x!==value):[...values,value]});};
  return <main>
    <header><p className="eyebrow">TECHNICAL INTERVIEW PRACTICE</p><h1>Interview Concepts Review</h1><p>Daily spaced-repetition review of your interview concepts. {bank.questions.length} cards in your bank.</p></header>
    <section className="panel today" aria-labelledby="today-heading">
      <h2 id="today-heading">Today</h2>
      <div className="today-counts"><div><strong>{due}</strong><span>Due</span></div><div><strong>{fresh}</strong><span>New</span></div></div>
      <div className="start-actions"><button className="primary" disabled={!due&&!fresh} onClick={()=>onStart('today')}>Start today's review ({due+fresh})</button>{session&&!session.finished&&<button onClick={onResume}>Resume {session.kind==='today'?"today's review":'practice'}</button>}</div>
      {!due&&!fresh&&<p className="notice">Nothing is due right now. Come back tomorrow, or practice a topic below.</p>}
      <div className="topic-progress">{topicStats(bank,store,now).map(item=><article key={item.topic} className="topic-row"><div className="topic-row-heading"><h3>{item.topic}</h3><strong>{item.due} due</strong></div><p>{item.total} card{item.total===1?'':'s'}</p></article>)}</div>
    </section>
    <section className="panel filters" aria-labelledby="practice-heading"><h2 id="practice-heading">Practice a topic</h2>
      <fieldset><legend>Topics</legend><div className="controls"><button type="button" className="link" onClick={()=>set({topics})}>Select all</button><button type="button" className="link" onClick={()=>set({topics:[]})}>Clear</button></div><div className="checks">{topics.map(topic=><label key={topic}><input type="checkbox" checked={store.settings.topics.includes(topic)} onChange={()=>toggle('topics',topic)}/>{topic}</label>)}</div></fieldset>
      <fieldset><legend>Question types</legend><div className="controls"><button type="button" className="link" onClick={()=>set({types})}>Select all</button><button type="button" className="link" onClick={()=>set({types:[]})}>Clear</button></div><div className="checks">{types.map((type:QuestionType)=><label key={type}><input type="checkbox" checked={store.settings.types.includes(type)} onChange={()=>toggle('types',type)}/>{TYPE_LABELS[type]}</label>)}</div></fieldset>
      <p className="notice">Practice ignores the schedule, but your ratings still count. FSRS adjusts for reviewing a card early.</p>
      <div className="start-actions"><div><button disabled={!practiceCount} onClick={()=>onStart('practice')}>Practice {practiceCount} card{practiceCount===1?'':'s'}</button>{!practiceCount&&<p>No cards match these filters.</p>}</div></div>
    </section>
    <p className="notice">Progress is saved in this browser and does not sync between devices.</p><button className="danger-link" onClick={onReset}>Reset progress</button>
  </main>;
}
