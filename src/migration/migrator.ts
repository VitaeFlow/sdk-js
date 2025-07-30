/**
 * Resume migration system
 * Handles migration between different versions of VitaeFlow schema
 */

import { Resume } from '../types/resume';
import { MigrationResult } from '../types/results';
import { CURRENT_VERSION } from '../constants';
import { isVersionSupported } from '../schemas';
import semver from 'semver';

/**
 * Migration function interface
 */
export interface MigrationStep {
  fromVersion: string;
  toVersion: string;
  migrate: (data: any) => any;
  description: string;
}

/**
 * Main migrator class
 */
export class ResumeMigrator {
  private migrations: MigrationStep[] = [];

  constructor() {
    // Initialize with available migrations
    this.initializeMigrations();
  }

  /**
   * Migrate resume data to target version
   */
  async migrate(
    data: any,
    targetVersion?: string
  ): Promise<MigrationResult> {
    const target = targetVersion || CURRENT_VERSION;
    const sourceVersion = this.detectVersion(data);

    // If source equals target, no migration needed
    if (sourceVersion === target) {
      return {
        ok: true,
        data: data as Resume,
        fromVersion: sourceVersion,
        toVersion: target,
        steps: [],
      };
    }

    try {
      // Build migration path
      const migrationPath = this.buildMigrationPath(sourceVersion, target);
      
      if (migrationPath.length === 0) {
        return {
          ok: false,
          error: `No migration path found from ${sourceVersion} to ${target}`,
          fromVersion: sourceVersion,
          toVersion: target,
          steps: [],
        };
      }

      // Apply migrations in sequence
      let currentData = this.cloneData(data);
      const appliedSteps: string[] = [];

      for (const step of migrationPath) {
        try {
          currentData = step.migrate(currentData);
          appliedSteps.push(`${step.fromVersion} → ${step.toVersion}: ${step.description}`);
        } catch (error) {
          return {
            ok: false,
            error: `Migration step ${step.fromVersion} → ${step.toVersion} failed: ${error}`,
            fromVersion: sourceVersion,
            toVersion: target,
            steps: appliedSteps,
          };
        }
      }

      // Update schema_version
      currentData.schema_version = target;

      return {
        ok: true,
        data: currentData as Resume,
        fromVersion: sourceVersion,
        toVersion: target,
        steps: appliedSteps,
      };

    } catch (error) {
      return {
        ok: false,
        error: `Migration failed: ${error}`,
        fromVersion: sourceVersion,
        toVersion: target,
        steps: [],
      };
    }
  }

  /**
   * Check if migration is possible between versions
   */
  canMigrate(fromVersion: string, toVersion: string): boolean {
    if (fromVersion === toVersion) return true;
    
    const path = this.buildMigrationPath(fromVersion, toVersion);
    return path.length > 0;
  }

  /**
   * Get available migration paths from a version
   */
  getAvailableMigrations(fromVersion: string): string[] {
    return this.migrations
      .filter(m => m.fromVersion === fromVersion)
      .map(m => m.toVersion);
  }

  /**
   * Add a custom migration step
   */
  addMigration(migration: MigrationStep): void {
    this.migrations.push(migration);
  }

  /**
   * Detect version from resume data
   */
  private detectVersion(data: any): string {
    if (data?.schema_version && typeof data.schema_version === 'string') {
      return data.schema_version;
    }
    
    if (data?.$schema && typeof data.$schema === 'string') {
      const match = data.$schema.match(/v(\d+\.\d+\.\d+)/);
      if (match) {
        return match[1];
      }
    }
    
    // Structure heuristic - assume 1.0.0 for unknown formats
    return '1.0.0';
  }

  /**
   * Build migration path between versions using graph traversal
   */
  private buildMigrationPath(fromVersion: string, toVersion: string): MigrationStep[] {
    if (fromVersion === toVersion) return [];

    // Use BFS to find shortest path
    const queue: { version: string; path: MigrationStep[] }[] = [
      { version: fromVersion, path: [] }
    ];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const { version, path } = queue.shift()!;
      
      if (visited.has(version)) continue;
      visited.add(version);

      // Find all possible next steps
      const nextSteps = this.migrations.filter(m => m.fromVersion === version);
      
      for (const step of nextSteps) {
        const newPath = [...path, step];
        
        if (step.toVersion === toVersion) {
          return newPath;
        }
        
        if (!visited.has(step.toVersion)) {
          queue.push({
            version: step.toVersion,
            path: newPath
          });
        }
      }
    }

    return []; // No path found
  }

  /**
   * Deep clone data to avoid mutation
   */
  private cloneData(data: any): any {
    return JSON.parse(JSON.stringify(data));
  }

  /**
   * Initialize available migrations
   * This is where future migration steps will be registered
   */
  private initializeMigrations(): void {
    // Example migrations for demonstration
    // These show how to handle schema evolution patterns
    
    // Migration 1.0.0 → 1.1.0: Add skills section
    this.migrations.push({
      fromVersion: '1.0.0',
      toVersion: '1.1.0',
      migrate: (data: any) => {
        // Add skills section if missing
        if (!data.skills) {
          data.skills = {
            technical: [],
            languages: [],
            soft_skills: []
          };
        }
        
        // Extract skills from work experience descriptions (basic NLP)
        if (data.work_experience && Array.isArray(data.work_experience)) {
          const commonTechSkills = ['javascript', 'python', 'java', 'react', 'node', 'sql', 'git'];
          const foundSkills = new Set<string>();
          
          data.work_experience.forEach((exp: any) => {
            if (exp.description) {
              const desc = exp.description.toLowerCase();
              commonTechSkills.forEach(skill => {
                if (desc.includes(skill)) {
                  foundSkills.add(skill.charAt(0).toUpperCase() + skill.slice(1));
                }
              });
            }
          });
          
          // Add found skills to technical skills (avoid duplicates)
          foundSkills.forEach(skill => {
            if (!data.skills.technical.some((s: any) => s.name === skill)) {
              data.skills.technical.push({
                name: skill,
                level: 'intermediate', // Default level
                years_experience: null
              });
            }
          });
        }
        
        return data;
      },
      description: 'Add skills section with automatic extraction from experience'
    });
    
    // Migration 1.1.0 → 1.2.0: Restructure contact information
    this.migrations.push({
      fromVersion: '1.1.0',
      toVersion: '1.2.0',
      migrate: (data: any) => {
        if (data.personal_information) {
          const personal = data.personal_information;
          
          // Create new contact structure
          const contact = {
            email: personal.email,
            phone: personal.phone,
            social_media: {
              linkedin: personal.linkedin_url || null,
              github: personal.github_url || null,
              website: personal.website_url || null
            },
            address: {
              street: personal.address || null,
              city: personal.city || null,
              state: personal.state || null,
              country: personal.country || null,
              postal_code: personal.postal_code || null
            }
          };
          
          // Keep only core personal info
          data.personal_information = {
            full_name: personal.full_name,
            birth_date: personal.birth_date,
            nationality: personal.nationality
          };
          
          // Add new contact section
          data.contact_information = contact;
          
          // Clean up old fields
          delete personal.phone;
          delete personal.email;
          delete personal.linkedin_url;
          delete personal.github_url;
          delete personal.website_url;
          delete personal.address;
          delete personal.city;
          delete personal.state;
          delete personal.country;
          delete personal.postal_code;
        }
        
        return data;
      },
      description: 'Restructure contact information into dedicated section'
    });
    
    // Migration 1.2.0 → 1.3.0: Add performance metrics to work experience
    this.migrations.push({
      fromVersion: '1.2.0',
      toVersion: '1.3.0',
      migrate: (data: any) => {
        if (data.work_experience && Array.isArray(data.work_experience)) {
          data.work_experience.forEach((exp: any) => {
            // Add metrics structure if not present
            if (!exp.achievements) {
              exp.achievements = [];
            }
            
            if (!exp.metrics) {
              exp.metrics = {
                team_size: null,
                budget_managed: null,
                revenue_impact: null,
                projects_completed: null
              };
            }
            
            // Try to extract metrics from description using regex
            if (exp.description) {
              const desc = exp.description;
              
              // Extract team size (e.g., "managed 5 developers", "team of 10")
              const teamMatch = desc.match(/(?:team of|managed|led)\\s+(\\d+)/i);
              if (teamMatch && !exp.metrics.team_size) {
                exp.metrics.team_size = parseInt(teamMatch[1]);
              }
              
              // Extract budget (e.g., "$1M budget", "€500K")
              const budgetMatch = desc.match(/[\\$€£]([\\d,]+)([MK]?)\\s*(?:budget|managed)/i);
              if (budgetMatch && !exp.metrics.budget_managed) {
                let amount = parseInt(budgetMatch[1].replace(',', ''));
                if (budgetMatch[2] === 'M') amount *= 1000000;
                if (budgetMatch[2] === 'K') amount *= 1000;
                exp.metrics.budget_managed = amount;
              }
              
              // Extract project count (e.g., "delivered 15 projects")
              const projectMatch = desc.match(/(?:delivered|completed|managed)\\s+(\\d+)\\s+projects?/i);
              if (projectMatch && !exp.metrics.projects_completed) {
                exp.metrics.projects_completed = parseInt(projectMatch[1]);
              }
            }
          });
        }
        
        return data;
      },
      description: 'Add performance metrics to work experience with automatic extraction'
    });
    
    // Migration 1.0.0 → 2.0.0: Major breaking change (direct jump)
    this.migrations.push({
      fromVersion: '1.0.0',
      toVersion: '2.0.0',
      migrate: (data: any) => {
        // Major restructuring for v2.0
        const v2Data = {
          schema_version: '2.0.0',
          metadata: {
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            migrated_from: '1.0.0',
            migration_notes: 'Automated migration from v1.0 to v2.0'
          },
          candidate: {
            identity: {
              name: data.personal_information?.full_name || 'Unknown',
              birth_date: data.personal_information?.birth_date,
              nationality: data.personal_information?.nationality
            },
            contact: {
              primary_email: data.personal_information?.email,
              phone_number: data.personal_information?.phone,
              location: {
                country: data.personal_information?.country,
                city: data.personal_information?.city
              }
            }
          },
          professional: {
            summary: data.summary || '',
            experience: data.work_experience?.map((exp: any) => ({
              organization: exp.company,
              role: exp.position,
              period: {
                start: exp.start_date,
                end: exp.end_date
              },
              description: exp.description,
              technologies: exp.technologies || [],
              achievements: exp.achievements || []
            })) || [],
            education: data.education?.map((edu: any) => ({
              institution: edu.institution,
              qualification: edu.degree,
              field: edu.field_of_study,
              period: {
                start: edu.start_date,
                end: edu.end_date
              },
              grade: edu.grade
            })) || []
          },
          additional: {
            certifications: data.certifications || [],
            languages: data.languages || [],
            projects: data.projects || [],
            publications: data.publications || []
          }
        };
        
        return v2Data;
      },
      description: 'Major restructuring for v2.0 schema with improved organization'
    });
    
    // Backward compatibility: 1.1.0 → 1.0.0 (downgrade)
    this.migrations.push({
      fromVersion: '1.1.0',
      toVersion: '1.0.0',
      migrate: (data: any) => {
        // Remove v1.1 specific fields for backward compatibility
        if (data.skills) {
          // Move technical skills back to work experience descriptions
          if (data.skills.technical && data.work_experience) {
            const skillsText = data.skills.technical
              .map((skill: any) => skill.name || skill)
              .join(', ');
            
            if (skillsText && data.work_experience[0]) {
              const currentDesc = data.work_experience[0].description || '';
              data.work_experience[0].description = currentDesc + 
                (currentDesc ? '\\n\\n' : '') + 
                `Technologies used: ${skillsText}`;
            }
          }
          
          // Remove skills section
          delete data.skills;
        }
        
        return data;
      },
      description: 'Downgrade from v1.1 to v1.0 (remove skills section)'
    });
  }
}

// Global migrator instance
const globalMigrator = new ResumeMigrator();

/**
 * Migrate resume data (convenience function)
 */
export async function migrateResume(
  data: any,
  targetVersion?: string
): Promise<MigrationResult> {
  return globalMigrator.migrate(data, targetVersion);
}

/**
 * Check if migration is possible
 */
export function canMigrateResume(
  fromVersion: string,
  toVersion: string
): boolean {
  return globalMigrator.canMigrate(fromVersion, toVersion);
}

/**
 * Add a custom migration step globally
 */
export function addMigrationStep(migration: MigrationStep): void {
  globalMigrator.addMigration(migration);
}

/**
 * Get version compatibility info
 */
export function getVersionCompatibility(version: string): {
  isSupported: boolean;
  canMigrateToLatest: boolean;
  latestVersion: string;
} {
  return {
    isSupported: isVersionSupported(version),
    canMigrateToLatest: globalMigrator.canMigrate(version, CURRENT_VERSION),
    latestVersion: CURRENT_VERSION,
  };
}