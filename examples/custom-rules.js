/**
 * VitaeFlow SDK - Custom Rules Examples
 * 
 * This file demonstrates how to create and use custom validation rules
 * for different use cases: ATS optimization, compliance, quality, performance
 */

const { 
  validateResume, 
  addCustomRule, 
  addCustomRules,
  removeRulesByCategory,
  getRulesByCategory,
  listCustomRules 
} = require('../dist/index.js');

// Example 1: ATS Optimization Rules
// These rules help improve parsing success rates in Applicant Tracking Systems

const atsOptimizationRules = [
  {
    id: 'max-work-experiences',
    category: 'ats-optimization',
    priority: 1, // Run early for performance
    message: 'Limit work experiences to 5 entries for optimal ATS parsing',
    severity: 'warning',
    description: `
      Many ATS systems have difficulty parsing resumes with too many work experiences.
      Limiting to 5 most recent/relevant positions improves parsing accuracy.
      This is especially important for senior professionals with long careers.
    `,
    validate: (resume) => {
      const issues = [];
      if (resume.work_experience && resume.work_experience.length > 5) {
        issues.push({
          type: 'rule',
          severity: 'warning',
          message: `Found ${resume.work_experience.length} work experiences, consider limiting to 5 most relevant`,
          ruleId: 'max-work-experiences',
          path: 'work_experience'
        });
      }
      return { valid: issues.length === 0, issues };
    }
  },
  {
    id: 'standard-date-format',
    category: 'ats-optimization', 
    priority: 2,
    message: 'Use consistent YYYY-MM-DD date format for ATS compatibility',
    severity: 'warning',
    description: `
      ATS systems parse dates more reliably when using ISO format (YYYY-MM-DD).
      Inconsistent formats like "Jan 2020" or "01/2020" can cause parsing errors.
    `,
    validate: (resume) => {
      const issues = [];
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      
      // Check work experience dates
      if (resume.work_experience) {
        resume.work_experience.forEach((exp, index) => {
          if (exp.start_date && !dateRegex.test(exp.start_date)) {
            issues.push({
              type: 'rule',
              severity: 'warning',
              message: `Non-standard date format in work experience: ${exp.start_date}`,
              ruleId: 'standard-date-format',
              path: `work_experience[${index}].start_date`
            });
          }
        });
      }
      
      return { valid: true, issues }; // Warnings don't fail validation
    }
  }
];

// Example 2: Compliance Rules
// Legal and regulatory requirements (GDPR, sector-specific)

const complianceRules = [
  {
    id: 'gdpr-consent-indicator',
    category: 'compliance',
    priority: 1,
    message: 'GDPR compliance requires explicit data processing consent',
    severity: 'error',
    description: `
      Under GDPR, processing personal data requires explicit consent.
      Resumes should include a consent field indicating agreement to data processing.
      This is critical for EU job applications and global companies.
    `,
    validate: (resume) => {
      const issues = [];
      if (!resume.privacy || !resume.privacy.data_processing_consent) {
        issues.push({
          type: 'rule',
          severity: 'error',
          message: 'Missing GDPR data processing consent field',
          ruleId: 'gdpr-consent-indicator',
          path: 'privacy.data_processing_consent'
        });
      }
      return { valid: issues.length === 0, issues };
    }
  },
  {
    id: 'healthcare-license-validation',
    category: 'compliance',
    priority: 3,
    message: 'Healthcare positions require valid professional licenses',
    severity: 'error',
    appliesTo: '>=1.0.0', // Version compatibility
    description: `
      Healthcare sector jobs require valid professional licenses.
      This rule checks that healthcare-related positions include proper licensing information.
      Critical for regulatory compliance in medical field.
    `,
    validate: (resume) => {
      const issues = [];
      const healthcareKeywords = ['nurse', 'doctor', 'physician', 'therapist', 'pharmacist'];
      
      if (resume.work_experience) {
        resume.work_experience.forEach((exp, index) => {
          const isHealthcare = healthcareKeywords.some(keyword => 
            exp.position?.toLowerCase().includes(keyword) ||
            exp.description?.toLowerCase().includes(keyword)
          );
          
          if (isHealthcare && (!resume.certifications || resume.certifications.length === 0)) {
            issues.push({
              type: 'rule',
              severity: 'error',
              message: `Healthcare position "${exp.position}" requires professional certification`,
              ruleId: 'healthcare-license-validation',
              path: `work_experience[${index}]`
            });
          }
        });
      }
      
      return { valid: issues.length === 0, issues };
    }
  }
];

// Example 3: Quality Assurance Rules
// Data consistency and completeness checks

const qualityRules = [
  {
    id: 'contact-completeness',
    category: 'quality',
    priority: 1,
    message: 'Ensure complete contact information for recruiter accessibility',
    severity: 'warning',
    description: `
      Complete contact information improves recruiter ability to reach candidates.
      Missing phone or email can result in missed opportunities.
    `,
    validate: (resume) => {
      const issues = [];
      const personal = resume.personal_information;
      
      if (!personal?.phone) {
        issues.push({
          type: 'rule',
          severity: 'warning',
          message: 'Missing phone number in contact information',
          ruleId: 'contact-completeness',
          path: 'personal_information.phone'
        });
      }
      
      if (!personal?.email) {
        issues.push({
          type: 'rule',
          severity: 'error',
          message: 'Email address is required for contact',
          ruleId: 'contact-completeness',
          path: 'personal_information.email'
        });
      }
      
      return { valid: issues.filter(i => i.severity === 'error').length === 0, issues };
    }
  }
];

// Example 4: Performance Rules
// File size and processing efficiency

const performanceRules = [
  {
    id: 'description-length-limit',
    category: 'performance',
    priority: 10, // Run last as it's expensive
    message: 'Limit description lengths for optimal processing performance',
    severity: 'warning',
    description: `
      Very long descriptions can slow down ATS processing and PDF generation.
      Recommend keeping job descriptions under 500 characters for optimal performance.
    `,
    validate: (resume) => {
      const issues = [];
      const maxLength = 500;
      
      if (resume.work_experience) {
        resume.work_experience.forEach((exp, index) => {
          if (exp.description && exp.description.length > maxLength) {
            issues.push({
              type: 'rule',
              severity: 'warning',
              message: `Description too long (${exp.description.length} chars), consider shortening to under ${maxLength}`,
              ruleId: 'description-length-limit',
              path: `work_experience[${index}].description`
            });
          }
        });
      }
      
      return { valid: true, issues };
    }
  }
];

// Demonstration of rule management
async function demonstrateCustomRules() {
  console.log('🔧 VitaeFlow Custom Rules Demo\n');
  
  // Install rule packages
  console.log('📦 Installing ATS optimization rules...');
  addCustomRules(atsOptimizationRules);
  
  console.log('📦 Installing compliance rules...');
  addCustomRules(complianceRules);
  
  console.log('📦 Installing quality rules...');
  addCustomRules(qualityRules);
  
  console.log('📦 Installing performance rules...');
  addCustomRules(performanceRules);
  
  // Show installed rules
  console.log('\n📋 Currently installed custom rules:');
  const allRules = listCustomRules();
  allRules.forEach(rule => {
    console.log(`  • ${rule.id} (${rule.category}, priority: ${rule.priority || 5})`);
  });
  
  // Filter by category
  console.log('\n🎯 ATS Optimization rules:');
  const atsRules = getRulesByCategory('ats-optimization');
  atsRules.forEach(rule => console.log(`  • ${rule.id}: ${rule.message}`));
  
  // Example resume for testing
  const testResume = {
    schema_version: '1.0.0',
    personal_information: {
      full_name: 'Jane Smith',
      email: 'jane@example.com'
      // Missing phone for quality rule
    },
    work_experience: [
      {
        company: 'Hospital ABC',
        position: 'Registered Nurse', // Will trigger healthcare compliance
        start_date: 'Jan 2020', // Non-standard format for ATS rule
        end_date: '2023-12-31',
        description: 'Provided patient care...'
      },
      // Add 5 more to trigger max-experiences rule
      { company: 'Clinic 1', position: 'Nurse', start_date: '2019-01-01', end_date: '2019-12-31' },
      { company: 'Clinic 2', position: 'Nurse', start_date: '2018-01-01', end_date: '2018-12-31' },
      { company: 'Clinic 3', position: 'Nurse', start_date: '2017-01-01', end_date: '2017-12-31' },
      { company: 'Clinic 4', position: 'Nurse', start_date: '2016-01-01', end_date: '2016-12-31' },
      { company: 'Clinic 5', position: 'Nurse', start_date: '2015-01-01', end_date: '2015-12-31' },
    ]
  };
  
  // Validate with custom rules
  console.log('\n🧪 Testing resume against custom rules...');
  const result = await validateResume(testResume);
  
  console.log(`\n📊 Validation Result: ${result.ok ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Issues found: ${result.issues.length}`);
  
  result.issues.forEach(issue => {
    const icon = issue.severity === 'error' ? '❌' : '⚠️';
    console.log(`  ${icon} [${issue.ruleId}] ${issue.message}`);
  });
  
  // Demonstrate rule management
  console.log('\n🧹 Removing compliance rules for demo...');
  removeRulesByCategory('compliance');
  
  console.log('Remaining rules after cleanup:');
  const remainingRules = listCustomRules();
  remainingRules.forEach(rule => {
    console.log(`  • ${rule.id} (${rule.category})`);
  });
}

// Run demo if file is executed directly
if (require.main === module) {
  demonstrateCustomRules().catch(console.error);
}

module.exports = {
  atsOptimizationRules,
  complianceRules,
  qualityRules,
  performanceRules,
  demonstrateCustomRules
};