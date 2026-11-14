import {useEffect,useRef,useState} from 'react';
import type {Bank,Grade,SessionKind,Store,Visit} from './types';
import {keyOf} from './types';
import {loadBank} from './lib/questionBank';
import {defaults,restore,STORAGE_KEY} from './lib/store';
import {formatInterval,GRADE_LABELS,practiceQueue,preview,rate,todayQueue} from './lib/scheduler';
import {advance,autoGrade,countRating,newSession} from './lib/session';
import {HomeScreen} from './components/HomeScreen';
import {QuestionCard} from './components/QuestionCard';
import {SessionSummary} from './components/SessionSummary';

type Load={state:'loading'}|{state:'error';message:string}|{state:'ready';bank:Bank};

export default function App(){
  const [load,setLoad]=useState<Load>({state:'loading'});
  const [store,setStore]=useState<Store>();
  const [screen,setScreen]=useState<'home'|'session'>('home');
  const [notice,setNotice]=useState('');
  const heading=useRef<HTMLHeadingElement>(null);

  const fetchBank=()=>{
    setLoad({state:'loading'});
    loadBank().then(bank=>{const restored=restore(bank);setStore(restored.store);if(restored.notice)setNotice(restored.notice);setLoad({state:'ready',bank});}).catch(error=>setLoad({state:'error',message:error.message}));
  };
  useEffect(fetchBank,[]);
  useEffect(()=>{if(!store)return;try{localStorage.setItem(STORAGE_KEY,JSON.stringify(store));}catch{setNotice('Changes cannot be saved in this browser; this session will remain in memory.');}},[store]);
  useEffect(()=>{if(screen==='session')heading.current?.focus();},[screen,store?.session?.cursor]);

  if(load.state==='loading')return <main><h1>Interview Concepts Review</h1><p role="status">Loading question bank…</p></main>;
  if(load.state==='error')return <main><h1>Interview Concepts Review</h1><div className="error" role="alert"><h2>Question bank could not be loaded</h2><p>{load.message}</p><button onClick={fetchBank}>Retry</button></div></main>;
  const bank=load.bank;
  if(!bank.questions.length)return <main><h1>Interview Concepts Review</h1><p>The question bank is valid but empty. Add questions to <code>public/questions.json</code> and rebuild.</p></main>;
  if(!store)return null;

  const now=new Date();
  const update=(change:(current:Store)=>Store)=>setStore(current=>current?change(current):current);
  const start=(kind:SessionKind)=>{const queue=kind==='today'?todayQueue(bank,store,now):practiceQueue(bank,store,store.settings,now);if(!queue.length)return;update(current=>({...current,session:newSession(kind,queue)}));setScreen('session');};
  const reset=()=>{if(confirm('Reset all Interview Concepts Review progress, including every card\'s review schedule? This cannot be undone.')){try{localStorage.removeItem(STORAGE_KEY);}catch{}setStore(defaults(bank));setScreen('home');setNotice('Progress reset.');}};
  const session=store.session;

  if(screen==='home'||!session)return <>{notice&&<div className="banner" role="status">{notice}</div>}<HomeScreen bank={bank} store={store} now={now} onSettings={settings=>update(current=>({...current,settings}))} onStart={start} onResume={()=>setScreen('session')} onReset={reset}/></>;
  if(session.finished)return <SessionSummary bank={bank} session={session} store={store} now={now} onHome={()=>setScreen('home')}/>;

  const key=session.queue[session.cursor];
  const question=bank.questions.find(q=>keyOf(q.id,q.version)===key);
  if(!question)return <main><h1>Saved card unavailable</h1><p>This card is no longer in the bank.</p><button onClick={()=>setScreen('home')}>Back to home</button></main>;
  const {cursor,visit}=session;
  // Each change re-checks the cursor, so a double click can't rate the next card by accident
  const atThisCard=(current:Store)=>current.session?.cursor===cursor&&!current.session.finished;
  const setVisit=(next:Visit)=>update(current=>atThisCard(current)?{...current,session:{...current.session!,visit:next}}:current);
  const submit=()=>update(current=>{
    if(!atThisCard(current))return current;
    const currentVisit=current.session!.visit;
    if(currentVisit.submitted||!currentVisit.selected)return current;
    const grade=autoGrade(question,currentVisit.selected);
    if(!grade)return {...current,session:{...current.session!,visit:{...currentVisit,submitted:true}}};
    const rated=rate(current,key,grade,new Date());
    return {...rated,session:{...countRating(current.session!,grade),visit:{...currentVisit,submitted:true,rated:grade}}};
  });
  const rateCard=(grade:Grade)=>update(current=>{
    if(!atThisCard(current)||current.session!.visit.rated)return current;
    const at=new Date();
    const rated=rate(current,key,grade,at);
    return {...rated,session:advance(countRating(current.session!,grade),rated.cards[key],at)};
  });
  const next=()=>update(current=>atThisCard(current)?{...current,session:advance(current.session!,current.cards[key],new Date())}:current);
  const dueBy=preview(store,key,now);
  const grades:Grade[]=question.type==='single_choice'?[2,3,4]:[1,2,3,4];
  const ratings=grades.map(grade=>({grade,label:GRADE_LABELS[grade],interval:formatInterval(now,dueBy[grade])}));
  const againIn=visit.rated&&store.cards[key]?formatInterval(now,new Date(store.cards[key].due)):undefined;

  return <main><div className="session-top"><button onClick={()=>setScreen('home')}>← Back to home</button><span>{session.kind==='today'?"Today's review":'Practice'} · Card {cursor+1} of {session.queue.length}</span></div><QuestionCard ref={heading} q={question} visit={visit} card={store.cards[key]} ratings={ratings} againIn={againIn} onVisit={setVisit} onSubmit={submit} onReveal={()=>setVisit({...visit,revealed:true})} onRate={rateCard} onNext={next}/></main>;
}
