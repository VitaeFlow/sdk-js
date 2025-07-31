/**
 * Resume types based on VitaeFlow Schema v0.1.0
 * Comprehensive types for structured resume data
 */

// Location interface used across multiple sections
export interface Location {
  city?: string;
  region?: string;
  country?: string;
}

// Metadata for resume tracking and versioning
export interface ResumeMeta {
  id?: string;
  createdAt?: string;
  updatedAt?: string;
  source?: string;
  version?: string;
  canonical?: string;
  language: string;
  country: string;
}

// Contact profiles (social media, portfolios, etc.)
export interface Profile {
  network: string;
  username?: string;
  url: string;
}

// Availability information
export interface Availability {
  immediateStart?: boolean;
  noticePeriod?: string;
  preferredStartDate?: string;
}

// Basic personal information
export interface ResumeBasics {
  firstName: string;
  lastName: string;
  label?: string;
  pronouns?: string;
  title?: string;
  email: string;
  phone?: string;
  url?: string;
  summary?: string;
  birthDate?: string;
  nationality?: string;
  maritalStatus?: string;
  drivingLicense?: string;
  location?: Location;
  availability?: Availability;
  profiles?: Profile[];
}

// Achievement with optional metrics
export interface Achievement {
  description: string;
  metrics?: {
    value: number;
    unit: string;
    context: string;
  };
}

// Project reference within experience
export interface ExperienceProject {
  name: string;
  description: string;
  url?: string;
}

// Work experience entry
export interface Experience {
  position: string;
  company: string;
  contractType?: string;
  startDate: string;
  endDate?: string;
  current?: boolean;
  remote?: boolean;
  teamSize?: number;
  location?: Location;
  summary?: string;
  highlights?: string[];
  technologies?: string[];
  achievements?: Achievement[];
  labels?: string[];
  projects?: ExperienceProject[];
}

// Education entry
export interface Education {
  institution: string;
  area: string;
  studyType: string;
  startDate: string;
  endDate?: string;
  gpa?: number;
  courses?: string[];
  location?: Location;
  summary?: string;
  highlights?: string[];
}

// Technical skill with proficiency level
export interface TechnicalSkill {
  name: string;
  level: 'beginner' | 'intermediate' | 'advanced' | 'expert' | string;
  yearsOfExperience?: number;
  category?: string;
}

// Language skill with fluency level
export interface LanguageSkill {
  code: string;
  fluency: string;
}

// Skills organization
export interface Skills {
  technical?: TechnicalSkill[];
  soft?: string[];
  languages?: LanguageSkill[];
}

// Standalone project
export interface Project {
  name: string;
  description: string;
  role?: string;
  startDate?: string;
  endDate?: string;
  status?: 'planning' | 'in-progress' | 'completed' | 'on-hold' | 'cancelled' | 'ongoing';
  context?: 'work' | 'personal' | 'academic' | 'volunteer' | 'freelance';
  url?: string;
  repository?: string;
  technologies?: string[];
  teamSize?: number;
  budget?: number;
  metrics?: {
    participants?: number;
    revenue?: number;
    efficiency?: string;
  };
}

// Professional certification
export interface Certification {
  name: string;
  issuer: string;
  date: string;
  expiryDate?: string;
  url?: string;
}

// Award or recognition
export interface AchievementRecord {
  title: string;
  date: string;
  awarder: string;
  summary?: string;
}

// Publication or article
export interface Publication {
  name: string;
  publisher: string;
  releaseDate: string;
  url?: string;
  summary?: string;
}

// Volunteer work (reuses Experience structure)
export interface VolunteerWork extends Experience {
  // Inherits all Experience fields but with volunteer context
}

// Main resume data structure
export interface ResumeData {
  basics: ResumeBasics;
  experience?: Experience[];
  education?: Education[];
  skills?: Skills;
  projects?: Project[];
  certifications?: Certification[];
  achievements?: AchievementRecord[];
  publications?: Publication[];
  volunteer?: VolunteerWork[];
}

// Complete VitaeFlow document structure
export interface VitaeFlowDocument {
  $schema?: string;
  specVersion: string;
  meta: ResumeMeta;
  resume: ResumeData;
}

// Legacy Resume interface for backward compatibility
export interface Resume {
  schema_version?: string;
  specVersion?: string;
  meta?: ResumeMeta;
  personal_information?: {
    full_name?: string;
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
    address?: string;
    [key: string]: any;
  };
  resume?: ResumeData;
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