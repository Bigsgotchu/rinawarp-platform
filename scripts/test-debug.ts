import debugCommand from '../src/terminal/commands/debug';

async function main() {
  // Test error debugging
  console.log('Testing error debugging...\n');
  let result = await debugCommand.execute({
    command: 'debug',
    args: ['Error: Cannot find module "express"'],
    options: {},
    raw: 'debug Error: Cannot find module "express"',
    timestamp: Date.now(),
  });
  console.log(result.output);
  console.log('\nMetadata:', result.metadata);

  // Wait for user input
  await new Promise(resolve => {
    console.log('\nPress Enter to continue...');
    process.stdin.once('data', resolve);
  });

  // Test showing solutions
  console.log('\nTesting solution display...\n');
  result = await debugCommand.execute({
    command: 'debug',
    args: ['show', 'solutions'],
    options: {},
    raw: 'debug show solutions',
    timestamp: Date.now(),
  });
  console.log(result.output);
  console.log('\nMetadata:', result.metadata);

  // Wait for user input
  await new Promise(resolve => {
    console.log('\nPress Enter to continue...');
    process.stdin.once('data', resolve);
  });

  // Test step execution
  console.log('\nTesting step execution...\n');
  result = await debugCommand.execute({
    command: 'debug',
    args: ['execute', 'npm install express'],
    options: {},
    raw: 'debug execute npm install express',
    timestamp: Date.now(),
  });
  console.log(result.output);
  console.log('\nMetadata:', result.metadata);
}

main().catch(console.error);
