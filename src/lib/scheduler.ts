import {createEmptyCard,fsrs,generatorParameters,Rating,State,type Card,type Grade as FsrsGrade,type ReviewLog} from 'ts-fsrs';
import type {Bank,Grade,LogEntry,Question,Settings,Store,StoredCard} from '../types';
import {keyOf} from '../types';

export const NEW_PER_DAY=10;
export const LEARN_AHEAD_MS=20*60_000;
export const GRADE_LABELS:Record<Grade,string>={1:'Again',2:'Hard',3:'Good',4:'Easy'};
const FSRS_GRADE:Record<Grade,FsrsGrade>={1:Rating.Again,2:Rating.Hard,3:Rating.Good,4:Rating.Easy};
const scheduler=fsrs(generatorParameters({request_retention:0.9,maximum_interval:180,enable_fuzz:true,enable_short_term:true}));

export const localDay=(now:Date)=>`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
const endOfLocalDay=(now:Date)=>new Date(now.getFullYear(),now.getMonth(),now.getDate()+1);
const keyOfQuestion=(q:Question)=>keyOf(q.id,q.version);

const toCard=(stored:StoredCard):Card=>({...stored,due:new Date(stored.due),last_review:stored.last_review?new Date(stored.last_review):undefined});
const toStored=(card:Card):StoredCard=>({due:card.due.toISOString(),stability:card.stability,difficulty:card.difficulty,elapsed_days:card.elapsed_days,scheduled_days:card.scheduled_days,learning_steps:card.learning_steps,reps:card.reps,lapses:card.lapses,state:card.state,...(card.last_review?{last_review:card.last_review.toISOString()}:{})});
const toEntry=(key:string,grade:Grade,log:ReviewLog):LogEntry=>({key,rating:grade,state:log.state,due:log.due.toISOString(),stability:log.stability,difficulty:log.difficulty,elapsed_days:log.elapsed_days,last_elapsed_days:log.last_elapsed_days,scheduled_days:log.scheduled_days,learning_steps:log.learning_steps,review:log.review.toISOString()});

export const isNew=(store:Store,key:string)=>!store.cards[key]||store.cards[key].state===State.New;
const cardFor=(store:Store,key:string,now:Date):Card=>store.cards[key]?toCard(store.cards[key]):createEmptyCard(now);

export function preview(store:Store,key:string,now:Date):Record<Grade,Date> {
  const options=scheduler.repeat(cardFor(store,key,now),now);
  return {1:options[Rating.Again].card.due,2:options[Rating.Hard].card.due,3:options[Rating.Good].card.due,4:options[Rating.Easy].card.due};
}

export function rate(store:Store,key:string,grade:Grade,now:Date):Store {
  const {card,log}=scheduler.next(cardFor(store,key,now),now,FSRS_GRADE[grade]);
  const day=localDay(now);
  const newIntroduced=isNew(store,key)?{...store.newIntroduced,[day]:(store.newIntroduced[day]||0)+1}:store.newIntroduced;
  return {...store,cards:{...store.cards,[key]:toStored(card)},log:[...store.log,toEntry(key,grade,log)],newIntroduced};
}

// A card still in its 1m/10m learning steps comes back in the same session if it falls due soon
export function learnsAhead(stored:StoredCard|undefined,now:Date):boolean {
  return !!stored&&(stored.state===State.Learning||stored.state===State.Relearning)&&Date.parse(stored.due)-now.getTime()<=LEARN_AHEAD_MS;
}

export const matchesFilters=(q:Question,settings:Settings)=>settings.topics.includes(q.topic)&&settings.types.includes(q.type);

export function dueToday(bank:Bank,store:Store,now:Date):string[] {
  const end=endOfLocalDay(now).getTime();
  return bank.questions.map(keyOfQuestion).filter(key=>!isNew(store,key)&&Date.parse(store.cards[key].due)<end).sort((a,b)=>Date.parse(store.cards[a].due)-Date.parse(store.cards[b].due));
}

// Stable mixed order (FNV-1a of the key), so one day's new cards aren't all one topic or type
const mixOrder=(key:string)=>{let hash=0x811c9dc5;for(let index=0;index<key.length;index++){hash^=key.charCodeAt(index);hash=Math.imul(hash,0x01000193)>>>0;}return hash;};
const newIn=(keys:string[],store:Store)=>keys.filter(key=>isNew(store,key)).sort((a,b)=>mixOrder(a)-mixOrder(b));

export const newKeys=(bank:Bank,store:Store)=>newIn(bank.questions.map(keyOfQuestion),store);
export const newSlots=(store:Store,now:Date)=>Math.max(0,NEW_PER_DAY-(store.newIntroduced[localDay(now)]||0));
export const todayQueue=(bank:Bank,store:Store,now:Date)=>[...dueToday(bank,store,now),...newKeys(bank,store).slice(0,newSlots(store,now))];

export function practiceQueue(bank:Bank,store:Store,settings:Settings,now:Date):string[] {
  const keys=bank.questions.filter(q=>matchesFilters(q,settings)).map(keyOfQuestion);
  const recall=(key:string)=>scheduler.get_retrievability(cardFor(store,key,now),now,false);
  return [...keys.filter(key=>!isNew(store,key)).sort((a,b)=>recall(a)-recall(b)),...newIn(keys,store)];
}

export type TopicStats={topic:string;due:number;total:number};
export function topicStats(bank:Bank,store:Store,now:Date):TopicStats[] {
  const due=new Set(dueToday(bank,store,now));
  return [...new Set(bank.questions.map(q=>q.topic))].map(topic=>{
    const keys=bank.questions.filter(q=>q.topic===topic).map(keyOfQuestion);
    return {topic,due:keys.filter(key=>due.has(key)).length,total:keys.length};
  });
}

export function nextDue(bank:Bank,store:Store):Date|undefined {
  const times=bank.questions.map(keyOfQuestion).filter(key=>!isNew(store,key)).map(key=>Date.parse(store.cards[key].due));
  return times.length?new Date(Math.min(...times)):undefined;
}

export function formatInterval(now:Date,due:Date):string {
  const minutes=Math.max(0,(due.getTime()-now.getTime())/60_000);
  if(minutes<60)return `${Math.max(1,Math.round(minutes))}m`;
  if(minutes<24*60)return `${Math.round(minutes/60)}h`;
  const days=Math.round(minutes/(24*60));
  if(days<30)return `${days}d`;
  if(days<365)return `${Math.round(days/30)}mo`;
  return `${(days/365).toFixed(1)}y`;
}
