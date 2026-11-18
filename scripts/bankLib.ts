import {execFileSync} from 'node:child_process';
import {randomInt} from 'node:crypto';
import {readdir,readFile,unlink,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {cardSchema,checkOptions,parseBank} from '../src/lib/questionBank';
import type {Bank,Question,Source} from '../src/types';

export const RETIRED_FILE='retired-ids.txt';
export const TOPICS_FILE='topics.json';
// The topic list lives in the vault; the bank keeps a copy so CI can check topics without the vault
export const VAULT_TOPICS='Topics.md';
export type Topic={name:string;area:string;description:string};
// A card lives in the file of its first topic
export type BankFile={topic:string;questions:Question[]};
// Every topic file keyed by its file name, the IDs that may never be handed out again, and the allowed topics
export type BankDir={files:Map<string,BankFile>;retired:Set<string>;topics:Topic[]};

export const slug=(topic:string)=>topic.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const fileFor=(topic:string)=>`${slug(topic)}.json`;
const allCards=(bank:BankDir)=>[...bank.files.values()].flatMap(file=>file.questions);

// Rows like "| `topic/consensus` | Raft, Paxos, … |" under "### <area>" headings in the vault's Topics.md
export function parseTopicList(markdown:string):Topic[] {
  const topics:Topic[]=[];
  let area='';
  for(const line of markdown.split('\n')){
    const heading=/^###\s+(.+?)\s*$/.exec(line);
    if(heading){area=heading[1];continue;}
    const row=/^\|\s*`topic\/([a-z0-9-]+)`\s*\|\s*(.+?)\s*\|\s*$/.exec(line);
    if(row)topics.push({name:row[1],area,description:row[2]});
  }
  return topics;
}

// The `topic/…` entries of a note's frontmatter `tags:` (block or inline list), in order, without the prefix
export function noteTopics(markdown:string):string[] {
  const frontmatter=/^---\n([\s\S]*?)\n---/.exec(markdown)?.[1]??'';
  const inline=/^tags:\s*\[(.*)\]\s*$/m.exec(frontmatter)?.[1];
  const block=/^tags:\s*\n((?:[ \t]+-[^\n]*\n?)*)/m.exec(frontmatter)?.[1];
  const tags=inline!==undefined?inline.split(','):(block??'').split('\n').map(line=>line.replace(/^\s*-\s*/,''));
  return tags.map(tag=>tag.trim().replace(/^["']|["']$/g,'')).filter(tag=>tag.startsWith('topic/')).map(tag=>tag.slice('topic/'.length));
}

// A card's topics are the union of its cited notes' topic/ tags, first note first; the LLM never names topics
export function deriveTopics(sources:{path:string}[],vault:Vault,topics:Topic[]):string[] {
  const allowed=new Set(topics.map(topic=>topic.name));
  return [...new Set(sources.flatMap(({path})=>{
    const text=vault.text(path);
    if(text===undefined)throw new Error(`Source note not found in the vault's latest commit: ${path}`);
    const found=noteTopics(text);
    if(!found.length)throw new Error(`${path} has no topic/ tags yet. Tag the note first (see ${VAULT_TOPICS} in the vault), then commit and push it.`);
    for(const topic of found)if(!allowed.has(topic))throw new Error(`${path} has topic/${topic}, which isn't defined in ${VAULT_TOPICS}`);
    return found;
  }))];
}

export function vaultTopics(vault:Vault):Topic[] {
  const text=vault.text(VAULT_TOPICS);
  if(text===undefined)throw new Error(`${VAULT_TOPICS} not found in the vault's latest commit`);
  const topics=parseTopicList(text);
  if(!topics.length)throw new Error(`${VAULT_TOPICS} defines no topic/ tags`);
  return topics;
}

export async function readBank(dir:string):Promise<BankDir> {
  const files=new Map<string,BankFile>();
  for(const name of (await readdir(dir)).filter(name=>name.endsWith('.json')&&name!==TOPICS_FILE).sort())files.set(name,JSON.parse(await readFile(join(dir,name),'utf8')));
  const retired=new Set((await readFile(join(dir,RETIRED_FILE),'utf8').catch(()=>'')).split('\n').map(line=>line.trim()).filter(line=>line&&!line.startsWith('#')));
  const topics=JSON.parse(await readFile(join(dir,TOPICS_FILE),'utf8').catch(()=>'{"topics":[]}')).topics as Topic[];
  return {files,retired,topics};
}

// Writes the changed topic files, deletes topic files that no longer hold cards, and refreshes the retired list and topic copy
export async function writeBank(dir:string,bank:BankDir,changed:Iterable<string>) {
  for(const name of changed)await writeFile(join(dir,name),`${JSON.stringify(bank.files.get(name),null,2)}\n`);
  for(const name of (await readdir(dir)).filter(name=>name.endsWith('.json')&&name!==TOPICS_FILE&&!bank.files.has(name)))await unlink(join(dir,name));
  await writeFile(join(dir,RETIRED_FILE),['# Card IDs removed from the bank, one per line. bank:add never reuses them.',...bank.retired].join('\n')+'\n');
  await writeFile(join(dir,TOPICS_FILE),`${JSON.stringify({source:`${VAULT_TOPICS} in the vault, copied by bank:add and bank:retopic`,topics:bank.topics},null,2)}\n`);
}

// Checks the rules that span files, then hands the merged bank to the same validator the site uses
export function validateBank(bank:BankDir,builtAt=new Date().toISOString()):Bank {
  const allowed=new Set(bank.topics.map(topic=>topic.name));
  const seen=new Map<string,string>();
  for(const [name,file] of bank.files){
    if(typeof file?.topic!=='string'||!Array.isArray(file.questions))throw new Error(`${name}: expected {"topic": "...", "questions": [...]}`);
    if(name!==fileFor(file.topic))throw new Error(`${name}: topic "${file.topic}" belongs in ${fileFor(file.topic)}`);
    for(const value of file.questions){
      const parsed=cardSchema.safeParse(value);
      if(!parsed.success){const issue=parsed.error.issues[0];throw new Error(`${name}: card ${(value as {id?:string})?.id??'(no id)'}: ${issue.path.join('.')||'card'}: ${issue.message}`);}
      const q=parsed.data as Question;
      if(new Set(q.topics).size!==q.topics.length)throw new Error(`${name}: card ${q.id} lists a topic twice`);
      for(const topic of q.topics)if(!allowed.has(topic))throw new Error(`${name}: card ${q.id} has topic "${topic}", which isn't in bank/${TOPICS_FILE}. If ${VAULT_TOPICS} renamed or removed it, retag the notes and run npm run bank:retopic`);
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
  for(const field of ['id','topic','topics'])if(field in draft)throw new Error(`Draft ${index+1} has "${field}"; bank:add assigns IDs and copies topics from the cited notes' topic/ tags`);
  if(!Array.isArray(draft.sources)||!draft.sources.length||!draft.sources.every(s=>s&&typeof s.path==='string'&&typeof s.heading==='string'))throw new Error(`Draft ${index+1} needs sources: [{path, heading}]`);
  return draft as Draft;
}

// Same key order as every other card, so a card PR's diff reads top to bottom
const FIELD_ORDER=['id','version','type','topics','difficulty','created','question','options','answer','explanation','rubric','code_language','extension_note','sources','provenance','checks'];
// Unknown fields stay (at the end) so the strict schema still rejects them
const ordered=(card:Record<string,unknown>)=>Object.fromEntries([...FIELD_ORDER.filter(field=>field in card),...Object.keys(card).filter(field=>!FIELD_ORDER.includes(field))].map(field=>[field,card[field]]));

const fileCard=(files:Map<string,BankFile>,card:Question)=>{
  const name=fileFor(card.topics[0]);
  if(!files.has(name))files.set(name,{topic:card.topics[0],questions:[]});
  files.get(name)!.questions.push(card);
  return name;
};

export function addCards(bank:BankDir,drafts:unknown[],vault:Vault,today:string,random?:(max:number)=>number):{bank:BankDir;added:{id:string;file:string}[]} {
  const topics=vaultTopics(vault);
  const files=new Map([...bank.files].map(([name,file])=>[name,{...file,questions:[...file.questions]}]));
  const taken=new Set([...allCards(bank).map(q=>q.id),...bank.retired]);
  const added:{id:string;file:string}[]=[];
  drafts.forEach((value,index)=>{
    const draft=asDraft(value,index);
    const sources=stampSources(draft.sources,vault);
    const cardTopics=deriveTopics(sources,vault,topics);
    const id=newId(cardTopics[0],taken,random);
    taken.add(id);
    const card=cardSchema.parse(ordered({...draft,id,version:draft.version??1,topics:cardTopics,created:draft.created??today,sources})) as Question;
    checkOptions(card);
    added.push({id,file:fileCard(files,card)});
  });
  const next={files,retired:bank.retired,topics};
  validateBank(next);
  return {bank:next,added};
}

// Re-copies every card's topics from the cited notes' current topic/ tags, e.g. after retagging or renaming a topic.
// A bank-side edit: card content and IDs stay, so review progress is untouched
export function retopicCards(bank:BankDir,vault:Vault):{bank:BankDir;changes:{id:string;from:string[];to:string[]}[]} {
  const topics=vaultTopics(vault);
  const files=new Map<string,BankFile>();
  const changes:{id:string;from:string[];to:string[]}[]=[];
  for(const card of allCards(bank)){
    const to=deriveTopics(card.sources,vault,topics);
    if(to.join()!==card.topics.join())changes.push({id:card.id,from:card.topics,to});
    fileCard(files,ordered({...card,topics:to}) as Question);
  }
  const next={files,retired:bank.retired,topics};
  validateBank(next);
  return {bank:next,changes};
}

export function removeCards(bank:BankDir,ids:string[]):{bank:BankDir;changed:string[]} {
  const files=new Map(bank.files),changed=new Set<string>();
  for(const id of ids){
    const entry=[...files].find(([,file])=>file.questions.some(q=>q.id===id));
    if(!entry)throw new Error(`No card with ID ${id}`);
    const [name,file]=entry;
    const questions=file.questions.filter(q=>q.id!==id);
    // An emptied topic file is dropped; writeBank deletes it from disk
    if(questions.length)files.set(name,{...file,questions});else files.delete(name);
    changed.add(name);
  }
  return {bank:{...bank,files,retired:new Set([...bank.retired,...ids])},changed:[...changed].filter(name=>files.has(name))};
}
