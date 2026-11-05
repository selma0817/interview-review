import {useEffect,useRef,useState} from 'react';
import type {Bank,Progress,SessionKind,Visit} from './types';
import {keyOf} from './types';
import {loadBank} from './lib/questionBank';
import {defaults,recordOutcome,restore,STORAGE_KEY,toggleNeedsReview} from './lib/progress';
import {candidates,newSession} from './lib/session';
import {SetupScreen} from './components/SetupScreen';
import {QuestionCard} from './components/QuestionCard';
import {SessionSummary} from './components/SessionSummary';

type Load={state:'loading'}|{state:'error';message:string}|{state:'ready';bank:Bank};

export default function App(){
  const [load,setLoad]=useState<Load>({state:'loading'});
  const [progress,setProgress]=useState<Progress>();
  const [screen,setScreen]=useState<'setup'|'session'>('setup');
  const [notice,setNotice]=useState('');
  const heading=useRef<HTMLHeadingElement>(null);

  const fetchBank=()=>{
    setLoad({state:'loading'});
    loadBank().then(bank=>{const restored=restore(bank);setProgress(restored.progress);if(restored.notice)setNotice(restored.notice);setLoad({state:'ready',bank});}).catch(error=>setLoad({state:'error',message:error.message}));
  };
  useEffect(fetchBank,[]);
  useEffect(()=>{if(!progress)return;try{localStorage.setItem(STORAGE_KEY,JSON.stringify(progress));}catch{setNotice('Changes cannot be saved in this browser; this session will remain in memory.');}},[progress]);
  useEffect(()=>{if(screen==='session')heading.current?.focus();},[screen,progress?.session?.cursor]);

  if(load.state==='loading')return <main><h1>Interview Concepts Review</h1><p role="status">Loading question bank…</p></main>;
  if(load.state==='error')return <main><h1>Interview Concepts Review</h1><div className="error" role="alert"><h2>Question bank could not be loaded</h2><p>{load.message}</p><button onClick={fetchBank}>Retry</button></div></main>;
  const bank=load.bank;
  if(!bank.questions.length)return <main><h1>Interview Concepts Review</h1><p>The question bank is valid but empty. Add questions to <code>public/questions.json</code> and rebuild.</p></main>;
  if(!progress)return null;

  const update=(change:(current:Progress)=>Progress)=>setProgress(current=>current?change(current):current);
  const start=(kind:SessionKind)=>{const questions=candidates(bank,progress,kind);if(!questions.length)return;update(current=>({...current,session:newSession(questions,kind)}));setScreen('session');};
  const reset=()=>{if(confirm('Reset all Interview Concepts Review progress and the saved session? This cannot be undone.')){try{localStorage.removeItem(STORAGE_KEY);}catch{}setProgress(defaults(bank));setScreen('setup');setNotice('Progress reset.');}};
  const session=progress.session;

  if(screen==='setup'||!session)return <>{notice&&<div className="banner" role="status">{notice}</div>}<SetupScreen bank={bank} progress={progress} onSettings={settings=>update(current=>({...current,settings}))} onStart={start} onResume={()=>setScreen('session')} onReset={reset}/></>;
  if(session.finished)return <SessionSummary bank={bank} session={session} progress={progress} onNew={()=>setScreen('setup')}/>;

  const item=session.queue[session.cursor];
  const question=bank.questions.find(q=>q.id===item?.id&&q.version===item?.version);
  if(!question)return <main><h1>Saved question unavailable</h1><p>This question is no longer in the bank.</p><button onClick={()=>setScreen('setup')}>Back to progress</button></main>;
  const key=keyOf(question.id,question.version);
  const visit=session.visits[key]||{};
  const record=progress.records[key];
  const setVisit=(next:Visit)=>update(current=>({...current,session:{...current.session!,visits:{...current.session!.visits,[key]:next}}}));
  const submit=()=>{
    if(question.type!=='single_choice'||!visit.selected)return;
    update(current=>{const currentVisit=current.session!.visits[key]||{};if(currentVisit.submitted||!currentVisit.selected)return current;const outcome=currentVisit.selected===question.answer?'correct':'incorrect';return {...current,records:{...current.records,[key]:recordOutcome(current.records[key],outcome)},session:{...current.session!,visits:{...current.session!.visits,[key]:{...currentVisit,submitted:true}}}};});
  };
  const reveal=()=>update(current=>{const currentVisit=current.session!.visits[key]||{};if(currentVisit.revealed)return current;return {...current,records:{...current.records,[key]:recordOutcome(current.records[key],'revealed')},session:{...current.session!,visits:{...current.session!.visits,[key]:{...currentVisit,revealed:true}}}};});
  const toggleReview=()=>update(current=>{const existing=current.records[key];return existing?{...current,records:{...current.records,[key]:toggleNeedsReview(existing)}}:current;});
  const move=(cursor:number)=>update(current=>({...current,session:{...current.session!,cursor}}));

  return <main><div className="session-top"><button onClick={()=>setScreen('setup')}>← Back to progress</button><span>{session.kind==='new'?'New questions':'Review'} · Question {session.cursor+1} of {session.queue.length}</span></div><QuestionCard ref={heading} q={question} visit={visit} record={record} onVisit={setVisit} onSubmit={submit} onReveal={reveal} onToggleReview={toggleReview}/><nav className="session-nav" aria-label="Question navigation"><button disabled={session.cursor===0} onClick={()=>move(session.cursor-1)}>Previous</button>{session.cursor<session.queue.length-1?<button onClick={()=>move(session.cursor+1)}>Next / Skip</button>:<button className="primary" onClick={()=>update(current=>({...current,session:{...current.session!,finished:true}}))}>Finish session</button>}</nav></main>;
}
