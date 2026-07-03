export type Health = { status: string; app: string; env: string };

export type PublicSettings = {
  review_source_mode: string;
  local_llm_model: string;
  selenium_max_target_reviews: number;
  analysis_batch_size: number;
  google_maps_api_key_configured: boolean;
  local_llm_api_key_configured: boolean;
};

export type Location = {
  id: number;
  hospital_name: string;
  branch_name: string;
  city: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  source: string;
  external_place_id: string;
  google_maps_url: string | null;
  google_reviews_url: string | null;
  is_active: boolean;
  target_review_count: number;
  created_at?: string | null;
  updated_at?: string | null;
};

export type LocationFormState = {
  hospital_name: string;
  branch_name: string;
  city: string;
  address: string;
  latitude: string;
  longitude: string;
  source: string;
  external_place_id: string;
  google_maps_url: string;
  google_reviews_url: string;
  target_review_count: number;
  is_active: boolean;
};

export type FetchLog = {
  id: number;
  location: string;
  source: string;
  status: string;
  total_fetched: number;
  total_inserted: number;
  total_duplicate: number;
  total_failed: number;
  started_at: string | null;
  finished_at: string | null;
};

export type Review = {
  id: number;
  location: string;
  location_id: number;
  reviewer_name: string;
  rating: number | null;
  review_text: string;
  review_time: string | null;
  owner_response_text?: string | null;
  owner_response_time?: string | null;
  sentiment: string | null;
  issue_category: string | null;
  urgency: string | null;
  recommended_action: string | null;
  is_patient_safety_issue: boolean;
  is_potential_viral: boolean;
};

export type Overview = {
  total_locations: number;
  total_reviews: number;
  analyzed_reviews: number;
  pending_analysis: number;
  sentiments: Record<string, number>;
  top_issues: Array<Record<string, number | string | null>>;
  critical_issues: number;
  latest_fetch: string | null;
};

export type ActionMessage = {
  type: "success" | "error" | "info";
  title: string;
  detail: string;
};
