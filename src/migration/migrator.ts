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
    // Currently no migrations available since we only have v1.0.0
    // Future migrations will be added here, for example:
    
    // this.migrations.push({
    //   fromVersion: '1.0.0',
    //   toVersion: '1.1.0',
    //   migrate: (data: any) => {
    //     // Migration logic here
    //     return data;
    //   },
    //   description: 'Add new fields for v1.1.0'
    // });
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