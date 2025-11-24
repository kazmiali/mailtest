/**
 * Test All Validators
 * 
 * Tests email validation with all available validators
 * Run with: node test-all-validators.mjs
 */

import {
  RegexValidator,
  TypoValidator,
  DisposableValidator,
  MXValidator,
  SMTPValidator,
} from './dist/index.js';

/**
 * Test email validation with all validators
 * 
 * @param {string} email - Email address to validate
 */
async function testEmail(email) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Testing: ${email}`);
  console.log('='.repeat(80));

  const results = {
    email,
    validators: {},
    overall: {
      valid: true,
      failedValidators: [],
    },
  };

  // 1. Regex Validator
  console.log('\n1. Regex Validator:');
  console.log('-'.repeat(80));
  try {
    const regexValidator = new RegexValidator({ mode: 'loose' });
    const regexResult = await regexValidator.validate(email);
    results.validators.regex = regexResult;
    
    console.log(`   Valid: ${regexResult.valid}`);
    if (regexResult.error) {
      console.log(`   Error: ${regexResult.error.message}`);
      console.log(`   Code: ${regexResult.error.code}`);
      results.overall.valid = false;
      results.overall.failedValidators.push('regex');
    } else {
      console.log('   ✓ Email format is valid');
    }
  } catch (error) {
    console.log(`   ✗ Error: ${error.message}`);
    results.overall.valid = false;
    results.overall.failedValidators.push('regex');
  }

  // 2. Typo Validator
  console.log('\n2. Typo Validator:');
  console.log('-'.repeat(80));
  try {
    const typoValidator = new TypoValidator();
    const typoResult = await typoValidator.validate(email);
    results.validators.typo = typoResult;
    
    console.log(`   Valid: ${typoResult.valid}`);
    if (typoResult.error) {
      console.log(`   Warning: ${typoResult.error.message}`);
      console.log(`   Suggestion: ${typoResult.error.suggestion || 'N/A'}`);
      console.log(`   Code: ${typoResult.error.code}`);
      // Typo is a warning, not a failure
    } else {
      console.log('   ✓ No typo detected');
    }
    if (typoResult.details?.suggestion) {
      console.log(`   Suggested: ${typoResult.details.suggestion}`);
    }
  } catch (error) {
    console.log(`   ✗ Error: ${error.message}`);
  }

  // 3. Disposable Validator
  console.log('\n3. Disposable Email Validator:');
  console.log('-'.repeat(80));
  try {
    const disposableValidator = new DisposableValidator();
    const disposableResult = await disposableValidator.validate(email);
    results.validators.disposable = disposableResult;
    
    console.log(`   Valid: ${disposableResult.valid}`);
    if (disposableResult.error) {
      console.log(`   Error: ${disposableResult.error.message}`);
      console.log(`   Code: ${disposableResult.error.code}`);
      console.log(`   Reason: ${disposableResult.error.details?.reason || 'N/A'}`);
      results.overall.valid = false;
      results.overall.failedValidators.push('disposable');
    } else {
      console.log('   ✓ Email is not disposable');
    }
  } catch (error) {
    console.log(`   ✗ Error: ${error.message}`);
    results.overall.valid = false;
    results.overall.failedValidators.push('disposable');
  }

  // 4. MX Record Validator
  console.log('\n4. MX Record Validator:');
  console.log('-'.repeat(80));
  try {
    const mxValidator = new MXValidator({
      timeout: 10000,
      retries: 2,
      fallbackToA: true,
    });
    const mxResult = await mxValidator.validate(email);
    results.validators.mx = mxResult;
    
    console.log(`   Valid: ${mxResult.valid}`);
    if (mxResult.error) {
      console.log(`   Error: ${mxResult.error.message}`);
      console.log(`   Code: ${mxResult.error.code}`);
      results.overall.valid = false;
      results.overall.failedValidators.push('mx');
    } else {
      const details = mxResult.details || {};
      console.log(`   ✓ Domain has mail servers configured`);
      console.log(`   Has MX Records: ${details.hasMX || false}`);
      console.log(`   Has A Records: ${details.hasA || false}`);
      console.log(`   Quality Score: ${details.quality || 0}/20`);
      console.log(`   Record Count: ${details.recordCount || 0}`);
      
      if (details.mxRecords && details.mxRecords.length > 0) {
        console.log(`   MX Records:`);
        details.mxRecords.forEach((record, index) => {
          console.log(`     ${index + 1}. Priority: ${record.priority}, Exchange: ${record.exchange}`);
        });
      }
      
      if (details.aRecords && details.aRecords.length > 0) {
        console.log(`   A Records (fallback):`);
        details.aRecords.forEach((record, index) => {
          console.log(`     ${index + 1}. ${record.address}`);
        });
      }
    }
  } catch (error) {
    console.log(`   ✗ Error: ${error.message}`);
    results.overall.valid = false;
    results.overall.failedValidators.push('mx');
  }

  // 5. SMTP Validator
  console.log('\n5. SMTP Validator:');
  console.log('-'.repeat(80));
  try {
    const smtpValidator = new SMTPValidator({
      timeout: 15000,
      retries: 1,
      tlsRequired: false,
      verifyMailbox: true,
    });
    const smtpResult = await smtpValidator.validate(email);
    results.validators.smtp = smtpResult;
    
    console.log(`   Valid: ${smtpResult.valid}`);
    if (smtpResult.error) {
      console.log(`   Error: ${smtpResult.error.message}`);
      console.log(`   Code: ${smtpResult.error.code}`);
      const errorDetails = smtpResult.error.details || {};
      if (errorDetails.greylisted) {
        console.log(`   ⚠ Greylisted (temporary failure - mailbox may exist)`);
      }
      results.overall.valid = false;
      results.overall.failedValidators.push('smtp');
    } else {
      const details = smtpResult.details || {};
      console.log(`   ✓ Mailbox verification successful`);
      console.log(`   Mailbox Exists: ${details.mailboxExists !== false ? 'Yes' : 'No'}`);
      console.log(`   MX Host: ${details.mxHost || 'N/A'}`);
      console.log(`   Port: ${details.port || 'N/A'}`);
      console.log(`   TLS Used: ${details.tlsUsed ? 'Yes' : 'No'}`);
      if (details.code) {
        console.log(`   SMTP Response Code: ${details.code}`);
      }
      if (details.message) {
        console.log(`   SMTP Response: ${details.message}`);
      }
    }
  } catch (error) {
    console.log(`   ✗ Error: ${error.message}`);
    results.overall.valid = false;
    results.overall.failedValidators.push('smtp');
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY:');
  console.log('='.repeat(80));
  console.log(`Email: ${email}`);
  console.log(`Overall Valid: ${results.overall.valid ? '✓ YES' : '✗ NO'}`);
  
  if (results.overall.failedValidators.length > 0) {
    console.log(`Failed Validators: ${results.overall.failedValidators.join(', ')}`);
  } else {
    console.log('All validators passed!');
  }

  return results;
}

/**
 * Main function to test multiple emails
 */
async function main() {
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                    EMAIL VALIDATION TEST SUITE                               ║');
  console.log('║                    Testing All Available Validators                          ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝');

  // Test emails
  const testEmails = [
    'ali.smak099@gmail.com',
    'ali.smak099@outlook.com',
    'info@songplace.io',
    'order@sumairatariq.com',
    'order@sumairaaatariq.com',
    // Add more test emails here if needed
  ];

  const allResults = [];

  for (const email of testEmails) {
    const result = await testEmail(email);
    allResults.push(result);
  }

  // Final summary
  console.log('\n\n');
  console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                         FINAL SUMMARY                                       ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝');
  
  allResults.forEach((result, index) => {
    console.log(`\n${index + 1}. ${result.email}`);
    console.log(`   Status: ${result.overall.valid ? '✓ VALID' : '✗ INVALID'}`);
    if (result.overall.failedValidators.length > 0) {
      console.log(`   Failed: ${result.overall.failedValidators.join(', ')}`);
    }
  });

  console.log('\n');
  console.log('Available validators: Regex, Typo, Disposable, MX, SMTP\n');
}

// Run the tests
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

