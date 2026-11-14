import type {Grade,Question,QuestionType,Session,SessionKind,StoredCard} from '../types';
import {learnsAhead} from './scheduler';

export const TYPE_LABELS:Record<QuestionType,string>={single_choice:'Multiple choice',flashcard:'Flashcards',code_reading:'Code reading',short_answer:'Short answer'};

export function newSession(kind:SessionKind,queue:string[]):Session {
  return {id:globalThis.crypto?.randomUUID?.()||String(Date.now()),kind,queue,cursor:0,visit:{},finished:!queue.length,counts:{1:0,2:0,3:0,4:0}};
}

// A wrong multiple-choice answer is Again with no choice; anything else waits for the user's rating
export const autoGrade=(q:Question,selected?:string):Grade|undefined=>q.type==='single_choice'&&selected!==q.answer?1:undefined;

export const countRating=(session:Session,grade:Grade):Session=>({...session,counts:{...session.counts,[grade]:session.counts[grade]+1}});

// Moves past the current card; a card still in short-term learning goes back on the end of the queue
export function advance(session:Session,stored:StoredCard|undefined,now:Date):Session {
  const key=session.queue[session.cursor];
  const repeat=learnsAhead(stored,now)&&!session.queue.slice(session.cursor+1).includes(key);
  const queue=repeat?[...session.queue,key]:session.queue;
  const cursor=session.cursor+1;
  return {...session,queue,cursor,visit:{},finished:cursor>=queue.length};
}
