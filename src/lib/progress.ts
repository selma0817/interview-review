import type {Bank,Progress,QuestionRecord,Session,Settings} from '../types';
import {keyOf} from '../types';

export const STORAGE_KEY='cs-review:progress:v1';
export const identity=(bank:Bank)=>`${bank.source_repository}::${bank.title}`;

export function defaults(bank:Bank):Progress {
  return {storageVersion:1,bankIdentity:identity(bank),sourceCommit:bank.source_commit,records:{},settings:{topics:[...new Set(bank.questions.map(q=>q.topic))],types:[...new Set(bank.questions.map(q=>q.type))]}};
}

function isStoredProgress(value:unknown):value is Record<string,unknown> {
  return !!value&&typeof value==='object'&&(value as {storageVersion?:unknown}).storageVersion===1;
}

function normalizeRecord(value:unknown):QuestionRecord|undefined {
  if(!value||typeof value!=='object')return undefined;
  const old=value as Record<string,unknown>;
  const attempts=Number.isInteger(old.attempts)&&Number(old.attempts)>=0?Number(old.attempts):0;
  const correct=Math.min(Number.isInteger(old.correct)&&Number(old.correct)>=0?Number(old.correct):0,attempts);
  const oldOutcome=old.latestOutcome;
  const latestOutcome:QuestionRecord['latestOutcome']=oldOutcome==='correct'||oldOutcome==='incorrect'||oldOutcome==='revealed'?oldOutcome:'revealed';
  const inferredIncorrect=Math.max(0,attempts-correct-(oldOutcome==='got_it'||oldOutcome==='needs_review'?attempts:0));
  return {
    attempts,
    correct,
    incorrect:Math.min(Number.isInteger(old.incorrect)&&Number(old.incorrect)>=0?Number(old.incorrect):inferredIncorrect,Math.max(0,attempts-correct)),
    completed:typeof old.completed==='boolean'?old.completed:attempts>0,
    needsReview:typeof old.needsReview==='boolean'?old.needsReview:oldOutcome==='needs_review',
    latestTimestamp:typeof old.latestTimestamp==='string'?old.latestTimestamp:new Date(0).toISOString(),
    latestOutcome
  };
}

export function restore(bank:Bank,storage:Storage=localStorage):{progress:Progress;notice?:string} {
  const clean=defaults(bank);
  try {
    const raw=storage.getItem(STORAGE_KEY);
    if(!raw)return {progress:clean};
    const saved=JSON.parse(raw) as Record<string,unknown>;
    if(!isStoredProgress(saved)||saved.bankIdentity!==identity(bank))return {progress:clean,notice:'Saved progress was incompatible and has been safely reset.'};
    const available=new Set(bank.questions.map(q=>keyOf(q.id,q.version)));
    const savedSettings=(saved.settings&&typeof saved.settings==='object'?saved.settings:{}) as Partial<Settings>;
    const settings:Settings={
      topics:Array.isArray(savedSettings.topics)?savedSettings.topics.filter((x):x is string=>typeof x==='string'&&clean.settings.topics.includes(x)):clean.settings.topics,
      types:Array.isArray(savedSettings.types)?savedSettings.types.filter((x):x is Settings['types'][number]=>typeof x==='string'&&clean.settings.types.includes(x as Settings['types'][number])):clean.settings.types
    };
    const records:Progress['records']={};
    if(saved.records&&typeof saved.records==='object')for(const [key,value] of Object.entries(saved.records)){const normalized=normalizeRecord(value);if(normalized)records[key]=normalized;}
    let session=saved.session as Session|undefined;
    let notice:string|undefined;
    if(session&&Array.isArray(session.queue)){
      const queue=session.queue.filter(item=>item&&typeof item.id==='string'&&Number.isInteger(item.version)&&available.has(keyOf(item.id,item.version)));
      if(queue.length!==session.queue.length)notice='Some unavailable questions were removed from your saved session.';
      const oldMode=(saved.settings&&typeof saved.settings==='object'?(saved.settings as {mode?:unknown}).mode:undefined);
      session=queue.length?{...session,kind:session.kind==='review'||oldMode==='needs_review'?'review':'new',queue,cursor:Math.min(Math.max(Number(session.cursor)||0,0),queue.length-1),visits:session.visits&&typeof session.visits==='object'?session.visits:{},finished:!!session.finished}:undefined;
    } else session=undefined;
    return {progress:{storageVersion:1,bankIdentity:identity(bank),sourceCommit:bank.source_commit,records,settings,session},notice};
  } catch {
    return {progress:clean,notice:'Saved progress was corrupt or unavailable, so a clean session was started.'};
  }
}

export function recordOutcome(previous:QuestionRecord|undefined,outcome:QuestionRecord['latestOutcome']):QuestionRecord {
  return {attempts:(previous?.attempts||0)+1,correct:(previous?.correct||0)+(outcome==='correct'?1:0),incorrect:(previous?.incorrect||0)+(outcome==='incorrect'?1:0),completed:true,needsReview:previous?.needsReview||false,latestTimestamp:new Date().toISOString(),latestOutcome:outcome};
}

export function toggleNeedsReview(previous:QuestionRecord):QuestionRecord {
  return {...previous,needsReview:!previous.needsReview,latestTimestamp:new Date().toISOString()};
}
