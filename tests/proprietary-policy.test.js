import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');

test('repository keeps proprietary all-rights-reserved policy',async()=>{
  const [license,agents,copilot,readme,notice]=await Promise.all([
    read('LICENSE'),
    read('AGENTS.md'),
    read('.github/copilot-instructions.md'),
    read('README.md'),
    read('NOTICE'),
  ]);

  assert.match(license,/PROPRIETARY LICENSE/i);
  assert.match(license,/ALL RIGHTS RESERVED/i);
  assert.match(license,/NO LICENSE GRANT/i);
  assert.match(license,/COPYING AND REDISTRIBUTION PROHIBITED/i);
  assert.doesNotMatch(license,/Permission is hereby granted, free of charge/i);

  assert.match(agents,/applies recursively to the entire repository/i);
  assert.match(agents,/must not:/i);
  assert.match(agents,/unauthorized fork, mirror, clone, duplicate repository/i);
  assert.match(agents,/temporary local or ephemeral technical checkouts/i);

  assert.match(copilot,/Read and follow the root `AGENTS\.md` and `LICENSE`/i);
  assert.match(copilot,/do not create or assist with unauthorized forks, mirrors, clones/i);

  assert.match(readme,/PROPRIETARY PROJECT — ALL RIGHTS RESERVED/i);
  assert.match(readme,/Career Eleven is not open-source/i);
  assert.match(notice,/PROPRIETARY PROJECT NOTICE/i);
  assert.match(notice,/ALL RIGHTS RESERVED/i);
});
