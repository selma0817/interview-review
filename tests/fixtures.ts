import type {Bank,Question,Source} from '../src/types';

// A stamped source; card topics come from note tags (bank:add), so the path is only for realism
export const sourceIn=(topic:string,note='Note'):Source=>({path:`Concepts/Area/${topic}/${note}.md`,heading:'Heading',blob_sha:'0'.repeat(40),url:`https://github.com/owner/vault/blob/abc/Concepts/Area/${topic}/${note}.md`});
const base={version:1,difficulty:'easy' as const,created:'2026-11-05',question:'?',answer:'x',explanation:'',provenance:'test',checks:{grounded:'pass' as const,blind_answer:'n/a' as const,code_run:'n/a' as const}};

export const flashcard=(id:string,topic='go',extra:Partial<Question>={}):Question=>({...base,id,topics:[topic],sources:[sourceIn(topic)],type:'flashcard',...extra} as Question);
export const multipleChoice=(id:string,topic='go',extra:Partial<Question>={}):Question=>({...base,id,topics:[topic],sources:[sourceIn(topic)],type:'single_choice',answer:'A',options:[{id:'A',text:'a'},{id:'B',text:'b'}],checks:{...base.checks,blind_answer:'pass'},...extra} as Question);
export const bankOf=(questions:Question[]):Bank=>({schema_version:'2.0.0',built_at:'2026-11-18T00:00:00.000Z',questions});
