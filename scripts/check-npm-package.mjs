import { assertStagedPackage } from './npm-package.mjs';

try {
  const result = assertStagedPackage();
  console.log(
    `  npm package: ${result.version}, ${result.bytes.toLocaleString('en-US')} bytes, sha256 ${result.sha256}`,
  );
} catch (error) {
  console.error(`\n  npm package: ${error.message ?? error}\n`);
  process.exit(1);
}
