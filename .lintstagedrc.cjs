const path = require('path');

// lint-staged passes absolute file paths. Each subpackage has its own
// eslint config; eslint must run from inside that subpackage so it
// picks up the right config. Quote paths to survive spaces.
function runEslintIn(subdir, files) {
  const abs = path.resolve(subdir);
  const relFiles = files
    .map(f => path.relative(abs, f))
    .map(f => `"${f}"`)
    .join(' ');
  return `sh -c "cd ${subdir} && ./node_modules/.bin/eslint --fix --max-warnings=0 ${relFiles}"`;
}

module.exports = {
  'server/**/*.js': (files) => runEslintIn('server', files),
  'client/**/*.{js,jsx}': (files) => runEslintIn('client', files),
};
