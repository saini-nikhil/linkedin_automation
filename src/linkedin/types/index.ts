export interface LinkedInTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  scope?: string;
}

export interface LinkedInMember {
  sub: string;
  name?: string;
  email?: string;
}

export interface LinkedInPostResult {
  id: string;
}
