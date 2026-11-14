import type {Bank,Grade,LogEntry,Session,Settings,Store,StoredCard} from '../types';
import {keyOf} from '../types';

export const STORAGE_KEY='interview-review:fsrs:v1';
// v1 kept completion and "needs review" marks here; they only held test clicks, so v2 drops them
export const LEGACY_KEY='cs-review:progress:v1';

export function defaults(bank:Bank):Store {
  return {storageVersion:1,cards:{},log:[],newIntroduced:{},settings:{topics:[...new Set(bank.questions.map(q=>q.topic))],types:[...new Set(bank.questions.map(q=>q.type))]}};
}

const isObject=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object';
const isDate=(value:unknown)=>typeof value==='string'&&!Number.isNaN(Date.parse(value));
const isNumber=(value:unknown)=>typeof value==='number'&&Number.isFinite(value);
const isCount=(value:unknown)=>Number.isInteger(value)&&Number(value)>=0;
const isState=(value:unknown)=>[0,1,2,3].includes(value as number);
const isGrade=(value:unknown):value is Grade=>[1,2,3,4].includes(value as number);

function isStoredCard(value:unknown):value is StoredCard {
  if(!isObject(value))return false;
  return isDate(value.due)&&isNumber(value.stability)&&isNumber(value.difficulty)&&isNumber(value.elapsed_days)&&isNumber(value.scheduled_days)&&isCount(value.learning_steps)&&isCount(value.reps)&&isCount(value.lapses)&&isState(value.state)&&(value.last_review===undefined||isDate(value.last_review));
}

function isLogEntry(value:unknown):value is LogEntry {
  return isObject(value)&&typeof value.key==='string'&&isGrade(value.rating)&&isState(value.state)&&isDate(value.due)&&isDate(value.review);
}

function restoreSession(value:unknown,available:Set<string>):{session?:Session;notice?:string} {
  if(!isObject(value)||!Array.isArray(value.queue)||(value.kind!=='today'&&value.kind!=='practice'))return {};
  const cursor=Math.max(0,Number.isInteger(value.cursor)?Number(value.cursor):0);
  const kept=value.queue.map((key,index)=>({key,index})).filter(item=>typeof item.key==='string'&&available.has(item.key));
  if(!kept.length)return {};
  const queue=kept.map(item=>item.key as string);
  // Keep the cursor on the same card when earlier cards disappeared from the bank
  const newCursor=Math.min(kept.filter(item=>item.index<cursor).length,queue.length);
  const currentKept=kept.some(item=>item.index===cursor);
  const counts=isObject(value.counts)?value.counts:{};
  const session:Session={
    id:typeof value.id==='string'?value.id:String(Date.now()),
    kind:value.kind,
    queue,
    cursor:newCursor,
    visit:currentKept&&isObject(value.visit)?value.visit:{},
    finished:newCursor>=queue.length,
    counts:{1:isCount(counts[1])?Number(counts[1]):0,2:isCount(counts[2])?Number(counts[2]):0,3:isCount(counts[3])?Number(counts[3]):0,4:isCount(counts[4])?Number(counts[4]):0}
  };
  return {session,notice:kept.length!==value.queue.length?'Some cards are no longer in the bank and were removed from your saved session.':undefined};
}

export function restore(bank:Bank,storage:Storage=localStorage):{store:Store;notice?:string} {
  const clean=defaults(bank);
  try{storage.removeItem(LEGACY_KEY);}catch{}
  try {
    const raw=storage.getItem(STORAGE_KEY);
    if(!raw)return {store:clean};
    const saved=JSON.parse(raw) as unknown;
    if(!isObject(saved)||saved.storageVersion!==1)return {store:clean,notice:'Saved progress was incompatible and has been safely reset.'};
    const cards:Store['cards']={};
    // Cards no longer in the bank keep their state; a later version of a card starts fresh under its own key
    if(isObject(saved.cards))for(const [key,value] of Object.entries(saved.cards))if(isStoredCard(value))cards[key]=value;
    const log=Array.isArray(saved.log)?saved.log.filter(isLogEntry):[];
    const newIntroduced:Store['newIntroduced']={};
    if(isObject(saved.newIntroduced))for(const [day,count] of Object.entries(saved.newIntroduced))if(isCount(count))newIntroduced[day]=Number(count);
    const savedSettings=(isObject(saved.settings)?saved.settings:{}) as Partial<Settings>;
    const settings:Settings={
      topics:Array.isArray(savedSettings.topics)?savedSettings.topics.filter((x):x is string=>typeof x==='string'&&clean.settings.topics.includes(x)):clean.settings.topics,
      types:Array.isArray(savedSettings.types)?savedSettings.types.filter((x):x is Settings['types'][number]=>typeof x==='string'&&clean.settings.types.includes(x as Settings['types'][number])):clean.settings.types
    };
    const {session,notice}=restoreSession(saved.session,new Set(bank.questions.map(q=>keyOf(q.id,q.version))));
    return {store:{storageVersion:1,cards,log,newIntroduced,settings,session},notice};
  } catch {
    return {store:clean,notice:'Saved progress was corrupt or unavailable, so a clean start was made.'};
  }
}
