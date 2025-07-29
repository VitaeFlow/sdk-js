/**
 * Resume types - temporary definition until @vitaeflow/spec is available
 * These types will be replaced with imports from the official specification
 */

// Temporary Resume type definition for development
// TODO: Replace with import from @vitaeflow/spec when available
export interface Resume {
  schema_version?: string;
  personal_information?: {
    full_name?: string;
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
    address?: string;
    [key: string]: any;
  };
  work_experience?: Array<{
    company: string;
    position: string;
    start_date: string;
    end_date?: string;
    description?: string;
    [key: string]: any;
  }>;
  education?: Array<{
    institution: string;
    degree: string;
    field_of_study: string;
    start_date: string;
    end_date?: string;
    [key: string]: any;
  }>;
  skills?: Array<{
    name: string;
    level?: string;
    [key: string]: any;
  }>;
  // Allow additional properties for flexibility
  [key: string]: any;
}