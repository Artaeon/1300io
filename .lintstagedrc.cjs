const path = require('path');

// lint-staged passes absolute file paths. Each subpackage has its own
// eslint config and ESLint 9 resolves config relative to cwd, so we
// cd into the subpackage and pass paths relative to it.
function runEslint(subdir, files) {
  if (!files.length) return [];
  const abs = path.resolve(subdir);
  const relFiles = files.map(f => path.relative(abs, f)).join(' ');
  // Single-quote the whole shell command so the file list survives
  // lint-staged's parsing.
  return `sh -c 'cd ${subdir} && ./node_modules/.bin/eslint --fix --max-warnings=20 ${relFiles}'`;
}

module.exports = {
  'server/**/*.js': (files) => runEslint('server', files),
  'client/**/*.{js,jsx}': (files) => runEslint('client', files),
};
