import { SUITE } from '../src/runner/suite.js';
import { runTest } from '../src/runner/kane.js';

const footer = SUITE.find((t) => t.id === 't-5')!;
const { result } = await runTest(footer, { author: true });
console.log(JSON.stringify(result, null, 2));
