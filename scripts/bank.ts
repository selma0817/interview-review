import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join,resolve} from 'node:path';
import {addCards,gitVault,readBank,removeCards,retopicCards,validateBank,writeBank} from './bankLib';

const root=fileURLToPath(new URL('..',import.meta.url));
const bankDir=join(root,'bank');
const usage=`Usage:
  npm run bank:validate
  npm run bank:build
  npm run bank:add -- <drafts.json> [--vault <dir>] [--dry-run]
  npm run bank:retopic -- [--vault <dir>] [--dry-run]
  npm run bank:remove -- <id> [<id>…]`;

const vaultDir=(args:string[])=>{const index=args.indexOf('--vault');return resolve(index>=0?args[index+1]:join(root,'..','knowledge_base'));};

async function main([command,...args]:string[]) {
  const bank=await readBank(bankDir);
  const dryRun=args.includes('--dry-run');
  if(command==='validate'){
    const built=validateBank(bank);
    console.log(`Valid bank: ${built.questions.length} cards in ${bank.files.size} topic files, ${new Set(built.questions.map(q=>q.type)).size} types, ${bank.topics.length} allowed topics, ${bank.retired.size} retired IDs.`);
  } else if(command==='build'){
    const built=validateBank(bank);
    // public/ only holds this generated file, so a fresh checkout (CI) doesn't have the folder yet
    await mkdir(join(root,'public'),{recursive:true});
    await writeFile(join(root,'public','questions.json'),`${JSON.stringify(built)}\n`);
    console.log(`Built public/questions.json: ${built.questions.length} cards.`);
  } else if(command==='add'){
    const draftsPath=args.find(arg=>!arg.startsWith('--')&&args[args.indexOf(arg)-1]!=='--vault');
    if(!draftsPath)throw new Error(usage);
    const parsed=JSON.parse(await readFile(resolve(draftsPath),'utf8'));
    const drafts=Array.isArray(parsed)?parsed:parsed.questions;
    if(!Array.isArray(drafts)||!drafts.length)throw new Error('The drafts file must be a non-empty array, or {"questions": [...]}');
    const today=new Date().toLocaleDateString('en-CA');
    const {bank:next,added}=addCards(bank,drafts,gitVault(vaultDir(args)),today);
    for(const {id,file} of added)console.log(`${dryRun?'Would add':'Added'} ${id} → bank/${file}`);
    if(dryRun){console.log(JSON.stringify(added.map(({id,file})=>next.files.get(file)!.questions.find(q=>q.id===id)),null,2));return;}
    await writeBank(bankDir,next,new Set(added.map(item=>item.file)));
  } else if(command==='retopic'){
    const {bank:next,changes}=retopicCards(bank,gitVault(vaultDir(args)));
    for(const {id,from,to} of changes)console.log(`${id}: ${from.join(', ')} → ${to.join(', ')}`);
    console.log(`${changes.length} of ${[...next.files.values()].reduce((sum,file)=>sum+file.questions.length,0)} cards ${dryRun?'would change':'changed'} topics; files: ${[...next.files.keys()].join(', ')}`);
    if(!dryRun)await writeBank(bankDir,next,next.files.keys());
  } else if(command==='remove'){
    if(!args.length)throw new Error(usage);
    const {bank:next,changed}=removeCards(bank,args);
    validateBank(next);
    await writeBank(bankDir,next,changed);
    console.log(`Removed and retired: ${args.join(', ')}`);
  } else throw new Error(usage);
}

main(process.argv.slice(2)).catch(error=>{console.error(error instanceof Error?error.message:error);process.exitCode=1;});
