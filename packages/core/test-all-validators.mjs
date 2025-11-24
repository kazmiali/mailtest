/**
 * Test All Validators - Phase 5 Complete
 * 
 * Tests email validation using the full orchestrator pipeline (Phase 5)
 * Uses the public API: validate() and createValidator()
 * Run with: node test-all-validators.mjs
 */

import { validate, createValidator } from './dist/index.js';

/**
 * Format validator result for display
 * 
 * @param {string} name - Validator name
 * @param {object} result - Validator result
 */
function displayValidatorResult(name, result) {
  if (!result) {
    console.log(`   ⚠ ${name}: Not run (disabled or skipped)`);
    return;
  }

  const status = result.valid ? '✓' : '✗';
  console.log(`   ${status} ${name}: ${result.valid ? 'PASSED' : 'FAILED'}`);

  if (result.error) {
    console.log(`      Error: ${result.error.message}`);
    console.log(`      Code: ${result.error.code}`);
    console.log(`      Severity: ${result.error.severity}`);
    if (result.error.suggestion) {
      console.log(`      Suggestion: ${result.error.suggestion}`);
    }
  }

  // Display validator-specific details
  if (result.details) {
    const details = result.details;

    // Regex details
    if (details.mode) {
      console.log(`      Mode: ${details.mode}`);
    }

    // Typo details
    if (details.suggestion) {
      console.log(`      Suggested: ${details.suggestion}`);
    }
    if (details.confidence) {
      console.log(`      Confidence: ${details.confidence}`);
    }

    // Disposable details
    if (details.reason) {
      console.log(`      Reason: ${details.reason}`);
    }

    // MX details
    if (details.hasMX !== undefined) {
      console.log(`      Has MX Records: ${details.hasMX}`);
    }
    if (details.hasA !== undefined) {
      console.log(`      Has A Records: ${details.hasA}`);
    }
    if (details.quality !== undefined) {
      console.log(`      Quality Score: ${details.quality}/20`);
    }
    if (details.recordCount !== undefined) {
      console.log(`      Record Count: ${details.recordCount}`);
    }
    if (details.mxRecords && details.mxRecords.length > 0) {
      console.log(`      MX Records:`);
      details.mxRecords.forEach((record, index) => {
        console.log(`        ${index + 1}. Priority: ${record.priority}, Exchange: ${record.exchange}`);
      });
    }
    if (details.aRecords && details.aRecords.length > 0) {
      console.log(`      A Records (fallback):`);
      details.aRecords.forEach((record, index) => {
        console.log(`        ${index + 1}. ${record.address}`);
      });
    }

    // SMTP details
    if (details.mailboxExists !== undefined) {
      console.log(`      Mailbox Exists: ${details.mailboxExists ? 'Yes' : 'No'}`);
    }
    if (details.mxHost) {
      console.log(`      MX Host: ${details.mxHost}`);
    }
    if (details.port) {
      console.log(`      Port: ${details.port}`);
    }
    if (details.tlsUsed !== undefined) {
      console.log(`      TLS Used: ${details.tlsUsed ? 'Yes' : 'No'}`);
    }
    if (details.code) {
      console.log(`      SMTP Response Code: ${details.code}`);
    }
    if (details.message) {
      console.log(`      SMTP Response: ${details.message}`);
    }
    if (details.greylisted) {
      console.log(`      ⚠ Greylisted (temporary failure - mailbox may exist)`);
    }
  }
}

/**
 * Test email validation with full orchestrator pipeline
 * 
 * @param {string} email - Email address to validate
 * @param {object} options - Optional validation options
 */
async function testEmail(email, options = {}) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Testing: ${email}`);
  if (Object.keys(options).length > 0) {
    console.log(`Options: ${JSON.stringify(options, null, 2)}`);
  }
  console.log('='.repeat(80));

  try {
    const startTime = Date.now();
    const result = await validate(email, options);
    const duration = Date.now() - startTime;

    // Display overall result
    console.log('\n📊 VALIDATION RESULT:');
    console.log('-'.repeat(80));
    console.log(`   Email: ${result.email}`);
    console.log(`   Valid: ${result.valid ? '✓ YES' : '✗ NO'}`);
    console.log(`   Score: ${result.score}/100`);
    if (result.reason) {
      console.log(`   Failed Reason: ${result.reason}`);
    }

    // Display metadata
    if (result.metadata) {
      console.log(`\n⏱️  METADATA:`);
      console.log('-'.repeat(80));
      if (result.metadata.timestamp) {
        console.log(`   Timestamp: ${result.metadata.timestamp}`);
      }
      if (result.metadata.duration !== undefined) {
        console.log(`   Duration: ${result.metadata.duration}ms`);
      } else {
        console.log(`   Duration: ${duration}ms (measured)`);
      }
    }

    // Display individual validator results
    console.log(`\n🔍 VALIDATOR RESULTS:`);
    console.log('-'.repeat(80));

    if (result.validators.regex) {
      console.log('\n1. Regex Validator:');
      displayValidatorResult('Regex', result.validators.regex);
    }

    if (result.validators.typo) {
      console.log('\n2. Typo Validator:');
      displayValidatorResult('Typo', result.validators.typo);
    }

    if (result.validators.disposable) {
      console.log('\n3. Disposable Email Validator:');
      displayValidatorResult('Disposable', result.validators.disposable);
    }

    if (result.validators.mx) {
      console.log('\n4. MX Record Validator:');
      displayValidatorResult('MX', result.validators.mx);
    }

    if (result.validators.smtp) {
      console.log('\n5. SMTP Validator:');
      displayValidatorResult('SMTP', result.validators.smtp);
    }

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('SUMMARY:');
    console.log('='.repeat(80));
    console.log(`Email: ${result.email}`);
    console.log(`Overall Valid: ${result.valid ? '✓ YES' : '✗ NO'}`);
    console.log(`Reputation Score: ${result.score}/100`);
    if (result.reason) {
      console.log(`Failed Validator: ${result.reason}`);
    }

    const passedValidators = Object.values(result.validators).filter(r => r && r.valid).length;
    const totalValidators = Object.keys(result.validators).length;
    console.log(`Validators Passed: ${passedValidators}/${totalValidators}`);

    return result;
  } catch (error) {
    console.log(`\n✗ FATAL ERROR: ${error.message}`);
    if (error.stack) {
      console.log(`\nStack trace:\n${error.stack}`);
    }
    throw error;
  }
}

/**
 * Main function to test multiple emails with different configurations
 */
async function main() {
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                    EMAIL VALIDATION TEST SUITE                               ║');
  console.log('║                    Phase 5: Orchestrator & Pipeline                         ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝');

  // Test emails (keeping the same as before)
  const testEmails = [
    'ali.smak099@gmail.com',
    'ali.smak099@outlook.com',
    'info@songplace.io',
    'order@sumairatariq.com',
    'order@sumairaaatariq.com',
  ];

  const allResults = [];

  // Test 1: Default configuration (balanced preset)
  console.log('\n\n');
  console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                    TEST 1: Default Configuration (Balanced)                ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝');

  for (const email of testEmails) {
    const result = await testEmail(email);
    allResults.push({ email, result, config: 'default' });
  }

  // Test 2: Strict preset
  console.log('\n\n');
  console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                    TEST 2: Strict Preset                                    ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝');

  for (const email of testEmails.slice(0, 2)) {
    const result = await testEmail(email, { preset: 'strict' });
    allResults.push({ email, result, config: 'strict' });
  }

  // Test 3: Early exit configuration
  console.log('\n\n');
  console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                    TEST 3: Early Exit Configuration                        ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝');

  for (const email of testEmails.slice(0, 2)) {
    const result = await testEmail(email, { earlyExit: true });
    allResults.push({ email, result, config: 'earlyExit' });
  }

  // Test 4: Using createValidator() factory
  console.log('\n\n');
  console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                    TEST 4: Using createValidator() Factory                  ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝');

  const validator = createValidator({ preset: 'balanced' });
  console.log(`\nCreated validator with config: ${JSON.stringify(validator.getConfig().preset, null, 2)}`);

  for (const email of testEmails.slice(0, 2)) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Testing: ${email} (using validator instance)`);
    console.log('='.repeat(80));

    try {
      const startTime = Date.now();
      const result = await validator.validate(email);
      const duration = Date.now() - startTime;

      console.log(`\n📊 RESULT:`);
      console.log(`   Valid: ${result.valid ? '✓ YES' : '✗ NO'}`);
      console.log(`   Score: ${result.score}/100`);
      console.log(`   Duration: ${duration}ms`);
      if (result.reason) {
        console.log(`   Failed Reason: ${result.reason}`);
      }

      allResults.push({ email, result, config: 'factory' });
    } catch (error) {
      console.log(`\n✗ ERROR: ${error.message}`);
    }
  }

  // Final summary
  console.log('\n\n');
  console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                         FINAL SUMMARY                                       ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝');
  
  const summary = {};
  allResults.forEach(({ email, result, config }) => {
    if (!summary[email]) {
      summary[email] = [];
    }
    summary[email].push({ config, valid: result.valid, score: result.score, reason: result.reason });
  });

  Object.entries(summary).forEach(([email, tests]) => {
    console.log(`\n📧 ${email}:`);
    tests.forEach(({ config, valid, score, reason }) => {
      const status = valid ? '✓ VALID' : '✗ INVALID';
      const reasonStr = reason ? ` (failed: ${reason})` : '';
      console.log(`   ${config.padEnd(15)} → ${status.padEnd(10)} Score: ${score}/100${reasonStr}`);
    });
  });

  console.log('\n');
  console.log('✅ Phase 5 Features Tested:');
  console.log('   • Validation Orchestrator & Pipeline');
  console.log('   • Public API (validate() and createValidator())');
  console.log('   • Result Formatter with metadata');
  console.log('   • Early exit functionality');
  console.log('   • Configuration presets');
  console.log('   • All validators: Regex, Typo, Disposable, MX, SMTP');
  console.log('\n');
}

// Run the tests
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

