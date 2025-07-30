/**
 * VitaeFlow SDK - Migration System Examples
 * 
 * This file demonstrates how to use the migration system to handle
 * schema evolution and version compatibility
 */

const { 
  migrateResume, 
  canMigrateResume, 
  getVersionCompatibility,
  addMigrationStep 
} = require('../dist/index.js');

// Example 1: Basic Migration (1.0.0 → 1.1.0)
async function demonstrateBasicMigration() {
  console.log('🔄 Basic Migration Demo: v1.0.0 → v1.1.0\n');
  
  // Sample v1.0.0 resume data
  const v1Resume = {
    schema_version: '1.0.0',
    personal_information: {
      full_name: 'Sarah Johnson',
      email: 'sarah@example.com',
      phone: '+1-555-0123'
    },
    work_experience: [
      {
        company: 'Tech Corp',
        position: 'Senior Developer',
        start_date: '2020-01-01',
        end_date: '2023-12-31',
        description: 'Developed web applications using React, Node.js, and Python. Led a team of 5 developers and managed a $2M budget.'
      },
      {
        company: 'StartupXYZ',
        position: 'Full Stack Developer',
        start_date: '2018-06-01',
        end_date: '2019-12-31',
        description: 'Built REST APIs with Java and managed SQL databases. Completed 12 projects successfully.'
      }
    ],
    education: [
      {
        institution: 'University of Technology',
        degree: 'Bachelor of Science',
        field_of_study: 'Computer Science',
        start_date: '2014-09-01',
        end_date: '2018-05-31'
      }
    ]
  };
  
  console.log('📋 Original v1.0.0 data:');
  console.log(`- Schema version: ${v1Resume.schema_version}`);
  console.log(`- Has skills section: ${!!v1Resume.skills}`);
  console.log(`- Work experiences: ${v1Resume.work_experience.length}`);
  
  // Migrate to v1.1.0
  const migrationResult = await migrateResume(v1Resume, '1.1.0');
  
  if (migrationResult.ok) {
    console.log('\n✅ Migration successful!');
    console.log(`- New schema version: ${migrationResult.data.schema_version}`);
    console.log(`- Has skills section: ${!!migrationResult.data.skills}`);
    console.log(`- Auto-extracted skills: ${migrationResult.data.skills?.technical?.map(s => s.name).join(', ') || 'none'}`);
    console.log(`- Migration steps: ${migrationResult.steps.length}`);
    migrationResult.steps.forEach(step => console.log(`  • ${step}`));
  } else {
    console.log('❌ Migration failed:', migrationResult.error);
  }
  
  return migrationResult.data;
}

// Example 2: Chained Migration (1.0.0 → 1.3.0)
async function demonstrateChainedMigration() {
  console.log('\n\n🔗 Chained Migration Demo: v1.0.0 → v1.3.0\n');
  
  const v1Resume = {
    schema_version: '1.0.0',
    personal_information: {
      full_name: 'Alex Chen',
      email: 'alex@example.com',
      phone: '+1-555-0456',
      linkedin_url: 'https://linkedin.com/in/alexchen',
      city: 'San Francisco',
      country: 'USA'
    },
    work_experience: [
      {
        company: 'BigTech Inc',
        position: 'Engineering Manager',
        start_date: '2021-01-01',
        end_date: '2024-01-01',
        description: 'Managed team of 15 engineers, delivered 25 projects, handled $5M budget for cloud infrastructure.'
      }
    ]
  };
  
  console.log('📋 Starting with v1.0.0 data');
  console.log(`- Contact in personal_information: ${!!v1Resume.personal_information.email}`);
  console.log(`- Has metrics in work experience: ${!!v1Resume.work_experience[0].metrics}`);
  
  // Check if direct migration is possible
  const canMigrate = canMigrateResume('1.0.0', '1.3.0');
  console.log(`\n🔍 Can migrate directly from 1.0.0 to 1.3.0: ${canMigrate}`);
  
  // Perform chained migration
  const migrationResult = await migrateResume(v1Resume, '1.3.0');
  
  if (migrationResult.ok) {
    console.log('\n✅ Chained migration successful!');
    console.log(`- Final schema version: ${migrationResult.data.schema_version}`);
    console.log(`- Contact moved to: ${!!migrationResult.data.contact_information ? 'contact_information' : 'personal_information'}`);
    console.log(`- Auto-extracted team size: ${migrationResult.data.work_experience[0]?.metrics?.team_size || 'none'}`);
    console.log(`- Auto-extracted budget: $${migrationResult.data.work_experience[0]?.metrics?.budget_managed?.toLocaleString() || 'none'}`);
    console.log(`- Auto-extracted projects: ${migrationResult.data.work_experience[0]?.metrics?.projects_completed || 'none'}`);
    console.log(`\n📝 Migration path (${migrationResult.steps.length} steps):`);
    migrationResult.steps.forEach((step, index) => {
      console.log(`  ${index + 1}. ${step}`);
    });
  } else {
    console.log('❌ Chained migration failed:', migrationResult.error);
  }
  
  return migrationResult.data;
}

// Example 3: Major Version Migration (1.0.0 → 2.0.0)
async function demonstrateMajorVersionMigration() {
  console.log('\n\n🚀 Major Version Migration Demo: v1.0.0 → v2.0.0\n');
  
  const v1Resume = {
    schema_version: '1.0.0',
    personal_information: {
      full_name: 'Maria Rodriguez',
      email: 'maria@example.com',
      birth_date: '1990-05-15',
      nationality: 'Spanish'
    },
    summary: 'Experienced software engineer with 8+ years in full-stack development.',
    work_experience: [
      {
        company: 'Innovation Labs',
        position: 'Lead Developer',
        start_date: '2020-03-01',
        end_date: '2024-01-01',
        description: 'Led development of microservices architecture.',
        technologies: ['Node.js', 'React', 'AWS']
      }
    ],
    education: [
      {
        institution: 'Technical University',
        degree: 'Master of Science',
        field_of_study: 'Software Engineering',
        start_date: '2012-09-01',
        end_date: '2014-06-30',
        grade: 'Magna Cum Laude'
      }
    ],
    certifications: [
      {
        name: 'AWS Solutions Architect',
        issuer: 'Amazon',
        date_obtained: '2021-03-15'
      }
    ]
  };
  
  console.log('📋 v1.0.0 structure:');
  console.log('- Flat personal_information with contact details');
  console.log('- Direct work_experience array');
  console.log('- Education as top-level array');
  
  // Migrate to v2.0.0 (major restructuring)
  const migrationResult = await migrateResume(v1Resume, '2.0.0');
  
  if (migrationResult.ok) {
    console.log('\n✅ Major version migration successful!');
    console.log('📋 v2.0.0 structure:');
    console.log('- Nested candidate.identity and candidate.contact');
    console.log('- Professional experience under professional.experience');
    console.log('- Education under professional.education');
    console.log('- Metadata tracking migration history');
    
    console.log('\n🔍 V2.0 Data Structure:');
    console.log(`- Candidate name: ${migrationResult.data.candidate?.identity?.name}`);
    console.log(`- Contact email: ${migrationResult.data.candidate?.contact?.primary_email}`);
    console.log(`- Experience count: ${migrationResult.data.professional?.experience?.length || 0}`);
    console.log(`- Education count: ${migrationResult.data.professional?.education?.length || 0}`);
    console.log(`- Migration tracked: ${!!migrationResult.data.metadata?.migrated_from}`);
    
    console.log(`\n📝 Migration details:`);
    console.log(`- From: ${migrationResult.fromVersion} → To: ${migrationResult.toVersion}`);
    console.log(`- Migration notes: ${migrationResult.data.metadata?.migration_notes}`);
  } else {
    console.log('❌ Major version migration failed:', migrationResult.error);
  }
}

// Example 4: Backward Compatibility (Downgrade)
async function demonstrateBackwardCompatibility() {
  console.log('\n\n⬇️ Backward Compatibility Demo: v1.1.0 → v1.0.0\n');
  
  // Create a v1.1.0 resume with skills
  const v11Resume = {
    schema_version: '1.1.0',
    personal_information: {
      full_name: 'David Kim',
      email: 'david@example.com'
    },
    skills: {
      technical: [
        { name: 'JavaScript', level: 'expert', years_experience: 8 },
        { name: 'Python', level: 'intermediate', years_experience: 3 },
        { name: 'Docker', level: 'intermediate', years_experience: 2 }
      ],
      languages: [
        { name: 'English', level: 'native' },
        { name: 'Korean', level: 'native' }
      ],
      soft_skills: ['Leadership', 'Communication', 'Problem Solving']
    },
    work_experience: [
      {
        company: 'DevCorp',
        position: 'Senior Engineer',
        start_date: '2020-01-01',
        end_date: '2024-01-01',
        description: 'Built scalable web applications.'
      }
    ]
  };
  
  console.log('📋 v1.1.0 data:');
  console.log(`- Has skills section: ${!!v11Resume.skills}`);
  console.log(`- Technical skills: ${v11Resume.skills.technical.map(s => s.name).join(', ')}`);
  console.log(`- Original work description length: ${v11Resume.work_experience[0].description.length} chars`);
  
  // Downgrade to v1.0.0
  const migrationResult = await migrateResume(v11Resume, '1.0.0');
  
  if (migrationResult.ok) {
    console.log('\n✅ Backward migration successful!');
    console.log(`- Schema version: ${migrationResult.data.schema_version}`);
    console.log(`- Has skills section: ${!!migrationResult.data.skills}`);
    console.log(`- New work description length: ${migrationResult.data.work_experience[0].description.length} chars`);
    console.log(`- Skills moved to description: ${migrationResult.data.work_experience[0].description.includes('Technologies used')}`);
  } else {
    console.log('❌ Backward migration failed:', migrationResult.error);
  }
}

// Example 5: Custom Migration Step
function demonstrateCustomMigration() {
  console.log('\n\n🛠️ Custom Migration Demo\n');
  
  // Add a custom migration for company-specific requirements
  const customMigration = {
    fromVersion: '1.3.0',
    toVersion: '1.3.1',
    migrate: (data) => {
      // Company XYZ requires all phone numbers in international format
      if (data.contact_information?.phone) {
        let phone = data.contact_information.phone;
        
        // Convert US numbers to international format
        if (phone.match(/^\+?1?[-\s]?\(?(\d{3})\)?[-\s]?(\d{3})[-\s]?(\d{4})$/)) {
          const match = phone.match(/(\d{3}).*?(\d{3}).*?(\d{4})/);
          if (match) {
            phone = `+1-${match[1]}-${match[2]}-${match[3]}`;
            data.contact_information.phone = phone;
          }
        }
      }
      
      // Add company-specific metadata
      if (!data.metadata) {
        data.metadata = {};
      }
      data.metadata.processed_by = 'Company XYZ HR System';
      data.metadata.compliance_check = 'passed';
      
      return data;
    },
    description: 'Company XYZ: Normalize phone format and add compliance metadata'
  };
  
  console.log('📋 Adding custom migration step:');
  console.log(`- From: ${customMigration.fromVersion} → To: ${customMigration.toVersion}`);
  console.log(`- Purpose: ${customMigration.description}`);
  
  // Register the custom migration
  addMigrationStep(customMigration);
  
  console.log('✅ Custom migration registered successfully!');
  console.log('💡 This migration will now be available for all future migrations.');
}

// Example 6: Version Compatibility Check
function demonstrateVersionCompatibility() {
  console.log('\n\n🔍 Version Compatibility Demo\n');
  
  const versionsToCheck = ['1.0.0', '1.1.0', '1.2.0', '1.3.0', '2.0.0', '3.0.0'];
  
  versionsToCheck.forEach(version => {
    const compatibility = getVersionCompatibility(version);
    console.log(`📋 Version ${version}:`);
    console.log(`   - Supported: ${compatibility.isSupported ? '✅' : '❌'}`);
    console.log(`   - Can migrate to latest: ${compatibility.canMigrateToLatest ? '✅' : '❌'}`);
    console.log(`   - Latest version: ${compatibility.latestVersion}`);
    
    // Check specific migration paths
    if (version !== compatibility.latestVersion) {
      const canMigrate = canMigrateResume(version, compatibility.latestVersion);
      console.log(`   - Migration path exists: ${canMigrate ? '✅' : '❌'}`);
    }
    console.log('');
  });
}

// Main demonstration function
async function runMigrationExamples() {
  console.log('🧪 VitaeFlow Migration System Examples\n');
  console.log('=' .repeat(50));
  
  try {
    // Run all examples
    await demonstrateBasicMigration();
    await demonstrateChainedMigration();
    await demonstrateMajorVersionMigration();
    await demonstrateBackwardCompatibility();
    demonstrateCustomMigration();
    demonstrateVersionCompatibility();
    
    console.log('\n' + '='.repeat(50));
    console.log('🎉 All migration examples completed successfully!');
    console.log('\n💡 Key Takeaways:');
    console.log('• Migrations can be chained automatically (1.0.0 → 1.1.0 → 1.2.0 → 1.3.0)');
    console.log('• Data extraction from descriptions (skills, metrics, contact info)');
    console.log('• Major version migrations restructure data organization');
    console.log('• Backward compatibility ensures data can be downgraded');
    console.log('• Custom migrations handle company-specific requirements');
    console.log('• Version compatibility checks prevent invalid operations');
    
  } catch (error) {
    console.error('❌ Migration example failed:', error);
  }
}

// Run examples if file is executed directly
if (require.main === module) {
  runMigrationExamples().catch(console.error);
}

module.exports = {
  demonstrateBasicMigration,
  demonstrateChainedMigration,
  demonstrateMajorVersionMigration,
  demonstrateBackwardCompatibility,
  demonstrateCustomMigration,
  demonstrateVersionCompatibility,
  runMigrationExamples
};