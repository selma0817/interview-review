import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join,resolve} from 'node:path';
import {addCards,gitVault,readBank,removeCards,validateBank,writeBank} from './bankLib';

const root=fileURLToPath(new URL('..',import.meta.url));
const bankDir=join(root,'bank');
const usage=`Usage:
  npm run bank:validate
  npm run bank:build
  npm run bank:add -- <drafts.json> [--vault <dir>] [--dry-run]
  npm run bank:remove -- <id> [<id>…]`;

async function main([command,...args]:string[]) {
  const bank=await readBank(bankDir);
  if(command==='validate'){
    const built=validateBank(bank);
    console.log(`Valid bank: ${built.questions.length} cards in ${bank.files.size} topic files, ${new Set(built.questions.map(q=>q.type)).size} types, ${bank.retired.size} retired IDs.`);
  } else if(command==='build'){
    const built=validateBank(bank);
    await writeFile(join(root,'public','questions.json'),`${JSON.stringify(built)}\n`);
    console.log(`Built public/questions.json: ${built.questions.length} cards.`);
  } else if(command==='add'){
    const draftsPath=args.find(arg=>!arg.startsWith('--')&&args[args.indexOf(arg)-1]!=='--vault');
    if(!draftsPath)throw new Error(usage);
    const vaultIndex=args.indexOf('--vault');
    const vaultDir=resolve(vaultIndex>=0?args[vaultIndex+1]:join(root,'..','knowledge_base'));
    const parsed=JSON.parse(await readFile(resolve(draftsPath),'utf8'));
    const drafts=Array.isArray(parsed)?parsed:parsed.questions;
    if(!Array.isArray(drafts)||!drafts.length)throw new Error('The drafts file must be a non-empty array, or {"questions": [...]}');
    const today=new Date().toLocaleDateString('en-CA');
    const {bank:next,added}=addCards(bank,drafts,gitVault(vaultDir),today);
    for(const {id,file} of added)console.log(`${args.includes('--dry-run')?'Would add':'Added'} ${id} → bank/${file}`);
    if(args.includes('--dry-run')){console.log(JSON.stringify(added.map(({id,file})=>next.files.get(file)!.questions.find(q=>q.id===id)),null,2));return;}
    await writeBank(bankDir,next,new Set(added.map(item=>item.file)));
  } else if(command==='remove'){
    if(!args.length)throw new Error(usage);
    const {bank:next,changed}=removeCards(bank,args);
    validateBank(next);
    await writeBank(bankDir,next,changed);
    console.log(`Removed and retired: ${args.join(', ')}`);
  } else throw new Error(usage);
}

main(process.argv.slice(2)).catch(error=>{console.error(error instanceof Error?error.message:error);process.exitCode=1;});
