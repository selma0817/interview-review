import type {State} from 'ts-fsrs';
export type QuestionType = 'single_choice'|'flashcard'|'code_reading'|'short_answer';
export type Source = {path:string;heading:string;blob_sha:string;url:string};
// 'not_run' only appears on cards migrated from v1; new cards pass every check that applies before they reach the bank
export type CheckResult = 'pass'|'n/a'|'not_run';
export type Checks = {grounded:CheckResult;blind_answer:CheckResult;code_run:CheckResult};
export type CommonQuestion = {id:string;version:number;topics:string[];difficulty:'easy'|'medium'|'hard';created:string;question:string;answer:string;explanation:string;sources:Source[];provenance:string;checks:Checks;rubric?:string[];extension_note?:string;code_language?:string};
export type Question = CommonQuestion & ({type:'single_choice';options:{id:string;text:string}[]}|{type:'flashcard'|'code_reading'|'short_answer'});
export type Bank = {schema_version:'2.0.0';built_at:string;questions:Question[]};
// 1 Again · 2 Hard · 3 Good · 4 Easy, the same numbers as ts-fsrs Rating
export type Grade = 1|2|3|4;
// ts-fsrs Card and ReviewLog, with dates kept as ISO strings so they survive JSON
export type StoredCard = {due:string;stability:number;difficulty:number;elapsed_days:number;scheduled_days:number;learning_steps:number;reps:number;lapses:number;state:State;last_review?:string};
export type LogEntry = {key:string;rating:Grade;state:State;due:string;stability:number;difficulty:number;elapsed_days:number;last_elapsed_days:number;scheduled_days:number;learning_steps:number;review:string};
export type Visit = {selected?:string;submitted?:boolean;revealed?:boolean;rated?:Grade};
export type SessionKind = 'today'|'practice';
export type Session = {id:string;kind:SessionKind;queue:string[];cursor:number;visit:Visit;finished:boolean;counts:Record<Grade,number>};
export type Settings = {topics:string[];types:QuestionType[]};
export type Store = {storageVersion:1;cards:Record<string,StoredCard>;log:LogEntry[];newIntroduced:Record<string,number>;settings:Settings;session?:Session};
export const keyOf=(id:string,version:number)=>`${id}@${version}`;
