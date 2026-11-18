import {execFileSync} from 'node:child_process';
import {randomInt} from 'node:crypto';
import {readdir,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {cardSchema,checkOptions,parseBank} from '../src/lib/questionBank';
import type {Bank,Question,Source} from '../src/types';

export const RETIRED_FILE='retired-ids.txt';
// A card lives in the file of its first topic
export type BankFile={topic:string;questions:Question[]};
// Every topic file keyed by its file name, plus the IDs that may never be handed out again
export type BankDir={files:Map<string,BankFile>;retired:Set<string>};

export const slug=(topic:string)=>topic.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const fileFor=(topic:string)=>`${slug(topic)}.json`;
const allCards=(bank:BankDir)=>[...bank.files.values()].flatMap(file=>file.questions);

// Topics come from the vault folders of the cited notes, never from the LLM: the folder under the area
// (Concepts/Computer System/Database/… → "Database"), or the area itself for a note directly in it (Concepts/LLM/… → "LLM")
export function deriveTopics(sources:{path:string}[]):string[] {
  return [...new Set(sources.map(({path})=>{
    const folders=path.split('/').slice(0,-1);
    if(folders[0]==='Concepts')folders.shift();
    const topic=folders[1]??folders[0];
    if(!topic)throw new Error(`Can't derive a topic from ${path}: the note isn't inside a topic folder`);
    return topic;
  }))];
}

const sameList=(a:string[],b:string[])=>a.length===b.length&&a.every((item,index)=>item===b[index]);

export async function readBank(dir:string):Promise<BankDir> {
  const files=new Map<string,BankFile>();
  for(const name of (await readdir(dir)).filter(name=>name.endsWith('.json')).sort())files.set(name,JSON.parse(await readFile(join(dir,name),'utf8')));
  const retired=new Set((await readFile(join(dir,RETIRED_FILE),'utf8').catch(()=>'')).split('\n').map(line=>line.trim()).filter(line=>line&&!line.startsWith('#')));
  return {files,retired};
}

export async function writeBank(dir:string,bank:BankDir,changed:Iterable<string>) {
  for(const name of changed)await writeFile(join(dir,name),`${JSON.stringify(bank.files.get(name),null,2)}\n`);
  await writeFile(join(dir,RETIRED_FILE),['# Card IDs removed from the bank, one per line. bank:add never reuses them.',...bank.retired].join('\n')+'\n');
}

// Checks the rules that span files, then hands the merged bank to the same validator the site uses
export function validateBank(bank:BankDir,builtAt=new Date().toISOString()):Bank {
  const seen=new Map<string,string>();
  for(const [name,file] of bank.files){
    if(typeof file?.topic!=='string'||!Array.isArray(file.questions))throw new Error(`${name}: expected {"topic": "...", "questions": [...]}`);
    if(name!==fileFor(file.topic))throw new Error(`${name}: topic "${file.topic}" belongs in ${fileFor(file.topic)}`);
    for(const value of file.questions){
      const parsed=cardSchema.safeParse(value);
      if(!parsed.success){const issue=parsed.error.issues[0];throw new Error(`${name}: card ${(value as {id?:string})?.id??'(no id)'}: ${issue.path.join('.')||'card'}: ${issue.message}`);}
      const q=parsed.data as Question;
      const derived=deriveTopics(q.sources);
      if(!sameList(q.topics,derived))throw new Error(`${name}: card ${q.id} has topics ${JSON.stringify(q.topics)}, but its notes' folders give ${JSON.stringify(derived)}`);
      if(q.topics[0]!==file.topic)throw new Error(`${name}: card ${q.id} belongs in ${fileFor(q.topics[0])}, the file of its first topic "${q.topics[0]}"`);
      if(seen.has(q.id))throw new Error(`Card ID ${q.id} appears in both ${seen.get(q.id)} and ${name}`);
      if(bank.retired.has(q.id))throw new Error(`${name}: card ID ${q.id} is retired and can't be used again`);
      seen.set(q.id,name);
    }
  }
  return parseBank({schema_version:'2.0.0',built_at:builtAt,questions:allCards(bank)});
}

// Random suffix, so the LLM never picks IDs and a deleted card's FSRS history can't attach to a new one
export function newId(topic:string,taken:Set<string>,random:(max:number)=>number=randomInt):string {
  const alphabet='abcdefghijklmnopqrstuvwxyz0123456789';
  for(let attempt=0;attempt<100;attempt++){
    const id=`${slug(topic)}-${Array.from({length:6},()=>alphabet[random(alphabet.length)]).join('')}`;
    if(!taken.has(id))return id;
  }
  throw new Error(`Could not find an unused ID for topic "${topic}"`);
}

export interface Vault {
  commit():string;
  repoUrl():string;
  pushed():boolean;
  clean(path:string):boolean;
  blobSha(path:string):string|undefined;
  text(path:string):string|undefined;
}

export function gitVault(dir:string):Vault {
  const git=(...args:string[])=>execFileSync('git',['-C',dir,...args],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();
  const attempt=(...args:string[])=>{try{return git(...args);}catch{return undefined;}};
  return {
    commit:()=>git('rev-parse','HEAD'),
    repoUrl:()=>git('remote','get-url','origin').replace(/\.git$/,'').replace(/^git@github\.com:/,'https://github.com/'),
    pushed:()=>!!attempt('branch','-r','--contains','HEAD'),
    clean:path=>git('status','--porcelain','--',path)==='',
    blobSha:path=>attempt('rev-parse',`HEAD:${path}`),
    text:path=>attempt('show',`HEAD:${path}`)
  };
}

const headings=(markdown:string)=>markdown.split('\n').map(line=>/^#{1,6}\s+(.+?)\s*#*\s*$/.exec(line)?.[1]).filter((text):text is string=>!!text);

// Pins each cited section to the exact committed, pushed version of the note the card was checked against
export function stampSources(sources:{path:string;heading:string}[],vault:Vault):Source[] {
  if(!vault.pushed())throw new Error('The vault\'s latest commit is not pushed to GitHub yet, so source links would break. Push the vault first.');
  const commit=vault.commit(),repo=vault.repoUrl();
  return sources.map(({path,heading})=>{
    const blob=vault.blobSha(path),text=vault.text(path);
    if(!blob||text===undefined)throw new Error(`Source note not found in the vault's latest commit: ${path}`);
    if(!vault.clean(path))throw new Error(`Source note has uncommitted changes: ${path}. Commit and push it first.`);
    if(!headings(text).includes(heading))throw new Error(`Heading "${heading}" not found in ${path}`);
    return {path,heading,blob_sha:blob,url:`${repo}/blob/${commit}/${path.split('/').map(encodeURIComponent).join('/')}`};
  });
}

type Draft=Record<string,unknown>&{sources:{path:string;heading:string}[]};
function asDraft(value:unknown,index:number):Draft {
  const draft=value as Partial<Draft>;
  if(!draft||typeof draft!=='object')throw new Error(`Draft ${index+1} is not an object`);
  for(const field of ['id','topic','topics'])if(field in draft)throw new Error(`Draft ${index+1} has "${field}"; bank:add assigns IDs and derives topics from the cited notes' folders`);
  if(!Array.isArray(draft.sources)||!draft.sources.length||!draft.sources.every(s=>s&&typeof s.path==='string'&&typeof s.heading==='string'))throw new Error(`Draft ${index+1} needs sources: [{path, heading}]`);
  return draft as Draft;
}

// Same key order as every other card, so a card PR's diff reads top to bottom
const FIELD_ORDER=['id','version','type','topics','difficulty','created','question','options','answer','explanation','rubric','code_language','extension_note','sources','provenance','checks'];
// Unknown fields stay (at the end) so the strict schema still rejects them
const ordered=(card:Record<string,unknown>)=>Object.fromEntries([...FIELD_ORDER.filter(field=>field in card),...Object.keys(card).filter(field=>!FIELD_ORDER.includes(field))].map(field=>[field,card[field]]));

export function addCards(bank:BankDir,drafts:unknown[],vault:Vault,today:string,random?:(max:number)=>number):{bank:BankDir;added:{id:string;file:string}[]} {
  const files=new Map([...bank.files].map(([name,file])=>[name,{...file,questions:[...file.questions]}]));
  const taken=new Set([...allCards(bank).map(q=>q.id),...bank.retired]);
  const added:{id:string;file:string}[]=[];
  drafts.forEach((value,index)=>{
    const draft=asDraft(value,index);
    const sources=stampSources(draft.sources,vault);
    const topics=deriveTopics(sources);
    const id=newId(topics[0],taken,random);
    taken.add(id);
    const card=cardSchema.parse(ordered({...draft,id,version:draft.version??1,topics,created:draft.created??today,sources})) as Question;
    checkOptions(card);
    const name=fileFor(topics[0]);
    if(!files.has(name))files.set(name,{topic:topics[0],questions:[]});
    files.get(name)!.questions.push(card);
    added.push({id,file:name});
  });
  const next={files,retired:bank.retired};
  validateBank(next);
  return {bank:next,added};
}

export function removeCards(bank:BankDir,ids:string[]):{bank:BankDir;changed:string[]} {
  const files=new Map(bank.files),changed=new Set<string>();
  for(const id of ids){
    const entry=[...files].find(([,file])=>file.questions.some(q=>q.id===id));
    if(!entry)throw new Error(`No card with ID ${id}`);
    const [name,file]=entry;
    files.set(name,{...file,questions:file.questions.filter(q=>q.id!==id)});
    changed.add(name);
  }
  return {bank:{files,retired:new Set([...bank.retired,...ids])},changed:[...changed]};
}
