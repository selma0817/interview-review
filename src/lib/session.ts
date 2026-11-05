import type {Bank,Progress,Question,QuestionType,Session,SessionKind} from '../types';
import {keyOf} from '../types';

export const TYPE_LABELS:Record<QuestionType,string>={single_choice:'Multiple choice',flashcard:'Flashcards',code_reading:'Code reading',short_answer:'Short answer'};

export function matchesFilters(question:Question,progress:Progress):boolean {
  return progress.settings.topics.includes(question.topic)&&progress.settings.types.includes(question.type);
}

export function candidates(bank:Bank,progress:Progress,kind:SessionKind):Question[] {
  return bank.questions.filter(question=>{
    if(!matchesFilters(question,progress))return false;
    const record=progress.records[keyOf(question.id,question.version)];
    return kind==='new'?!record?.completed:!!record?.needsReview;
  });
}

export function shuffleQuestions(questions:Question[],random:()=>number=Math.random):Question[] {
  const result=[...questions];
  for(let index=result.length-1;index>0;index--){const swap=Math.floor(random()*(index+1));[result[index],result[swap]]=[result[swap],result[index]];}
  return result;
}

export function newSession(questions:Question[],kind:SessionKind,random:()=>number=Math.random):Session {
  return {id:globalThis.crypto?.randomUUID?.()||String(Date.now()),kind,queue:shuffleQuestions(questions,random).map(q=>({id:q.id,version:q.version})),cursor:0,visits:{},finished:false};
}

export type TopicProgress={topic:string;completed:number;total:number;needsReview:number;previouslyIncorrect:number};
export function topicProgress(bank:Bank,progress:Progress):TopicProgress[] {
  return [...new Set(bank.questions.map(q=>q.topic))].map(topic=>{
    const questions=bank.questions.filter(q=>q.topic===topic);
    const records=questions.map(q=>progress.records[keyOf(q.id,q.version)]);
    return {topic,total:questions.length,completed:records.filter(r=>r?.completed).length,needsReview:records.filter(r=>r?.needsReview).length,previouslyIncorrect:records.filter(r=>(r?.incorrect||0)>0).length};
  });
}
