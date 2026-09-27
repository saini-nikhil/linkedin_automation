export class UpdateCareerDto {
  targetRoles?: string[];
  skills?: string[];
  experienceYears?: number | null;
  location?: string | null;
  workTypes?: string[];
  salaryMin?: number | null;
  salaryMax?: number | null;
  currency?: string;
  noticePeriodDays?: number | null;
  employmentTypes?: string[];
  targetCompanies?: string[];
  excludedCompanies?: string[];
  jobSourceUrls?: string[];
}
