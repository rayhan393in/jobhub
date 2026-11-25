/** Shared domain types. Mirrors the SQL schema in supabase/migrations. */

export type RoleId = "student" | "content_editor" | "admin" | "super_admin";

export type Course = {
  id: string;
  slug: string;
  title_en: string;
  title_bn: string;
  short_en: string | null;
  short_bn: string | null;
  summary_en: string | null;
  summary_bn: string | null;
  description_en: string | null;
  description_bn: string | null;
  level: "foundation" | "intermediate" | "advanced";
  icon: string;
  accent: "indigo" | "violet";
  duration_weeks: number | null;
  price_bdt: number;
  status: "draft" | "published" | "archived";
  sort_order: number;
  exam_config: CourseExamConfig;
};

export type CourseExamConfig = {
  duration_minutes: number;
  max_questions: number;
  max_duration_minutes: number;
  positive_marks: number;
  negative_marks: number;
  publish_lead_minutes: number;
  result_delay_minutes: number;
};

export type Subject = {
  id: string;
  course_id: string;
  slug: string;
  title_en: string;
  title_bn: string;
  chapter_group: string | null;
  sort_order: number;
};

export type Topic = {
  id: string;
  subject_id: string;
  slug: string;
  title_en: string;
  title_bn: string;
  chapter: string | null;
  sort_order: number;
  approval_status?: "pending" | "approved" | "rejected";
  source_url?: string | null;
  occurrence_years?: number[];
  canonical_id?: string | null;
};

export type Subtopic = {
  id: string;
  topic_id: string;
  slug: string;
  title_en: string;
  title_bn: string;
  sort_order: number;
  approval_status?: "pending" | "approved" | "rejected";
};

export type MicroTopic = {
  id: string;
  subtopic_id: string;
  slug: string;
  title_en: string;
  title_bn: string;
  sort_order: number;
  is_active: boolean;
  approval_status: "pending" | "approved" | "rejected";
};

export type CanonicalTopic = {
  id: string;
  slug: string;
  title_en: string;
  title_bn: string;
  subject_group: string | null;
};

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  full_name_bn: string | null;
  phone: string | null;
  role_id: RoleId;
  target_course_id: string | null;
  locale: "bn" | "en";
  avatar_url: string | null;
  is_active: boolean;
  onboarded_at: string | null;
  created_at: string;
};

export type QuestionStatus = "draft" | "pending_review" | "approved" | "rejected" | "archived";
export type Difficulty = "easy" | "medium" | "hard";
export type SourceType = "manual" | "csv_import" | "json_import" | "ai_assisted";

export type QuestionRow = {
  id: string;
  course_id: string;
  subject_id: string | null;
  topic_id: string | null;
  subtopic_id: string | null;
  statement: string;
  statement_bn: string | null;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: number;
  explanation: string;
  difficulty: Difficulty;
  source: string;
  source_type: SourceType;
  year: number | null;
  status: QuestionStatus;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
  subject_title_bn?: string | null;
  topic_title_bn?: string | null;
};

export type ExamKind = "daily_live" | "weekly_special" | "scheduled_mock";
export type ExamStatus = "draft" | "published" | "cancelled" | "completed";

export type ExamSchedule = {
  id: string;
  course_id: string;
  kind: ExamKind;
  title_en: string;
  title_bn: string;
  starts_at: string;
  ends_at: string;
  result_release_at: string;
  duration_minutes: number;
  question_count: number;
  total_marks: number;
  positive_marks: number;
  negative_marks: number;
  status: ExamStatus;
  routine_id: string | null;
  settings: { composition?: ExamComposition };
  published_at: string | null;
};

export type CompositionItem = {
  subject_id?: string | null;
  topic_id?: string | null;
  subtopic_id?: string | null;
  count: number;
  label?: string;
};

export type ExamComposition = { items: CompositionItem[] };

export type AttemptMode =
  | "scheduled"
  | "custom"
  | "mixed_practice"
  | "topic_practice"
  | "wrong_practice"
  | "bookmark_practice"
  | "timed_mock"
  | "revision";

export type AttemptStatus = "in_progress" | "submitted" | "expired";

export type ExamAttempt = {
  id: string;
  user_id: string;
  paper_id: string;
  schedule_id: string | null;
  course_id: string;
  mode: AttemptMode;
  status: AttemptStatus;
  started_at: string;
  deadline_at: string;
  submitted_at: string | null;
  total_questions: number;
  total_marks: number;
  correct_count: number | null;
  wrong_count: number | null;
  unanswered_count: number | null;
  score: number | null;
  accuracy: number | null;
  is_released: boolean;
};

/** A question exactly as the browser is allowed to see it: no answer key. */
export type ExamQuestion = {
  question_id: string;
  position: number;
  statement: string;
  statement_bn: string | null;
  options: string[];
  difficulty: Difficulty;
  subject_id: string | null;
  topic_id: string | null;
  subtopic_id: string | null;
  source: string;
  year: number | null;
  subject_title_bn?: string | null;
  topic_title_bn?: string | null;
};

export type SavedAnswer = {
  question_id: string;
  selected_option: number | null;
  marked_for_review: boolean;
};

export type AttemptPaper = {
  attempt: ExamAttempt;
  server_now: string;
  questions: ExamQuestion[];
  /** Present when the paper is re-opened so answers survive a refresh. */
  saved_answers?: SavedAnswer[];
};

export type ReviewItem = ExamQuestion & {
  correct_option: number;
  selected_option: number | null;
  is_correct: boolean;
  explanation: string;
  /** Joined in by jh_get_attempt_review so the result sheet can group honestly. */
  topic_title_bn?: string | null;
  exam_name?: string | null;
  source_title?: string | null;
  book_chapter?: string | null;
  book_page?: number | null;
};

export type AttemptReview = {
  released: boolean;
  result_release_at?: string | null;
  score?: number | null;
  total_marks?: number;
  correct?: number;
  wrong?: number;
  unanswered?: number;
  accuracy?: number | null;
  duration_seconds?: number | null;
  submitted_at?: string | null;
  items: ReviewItem[];
};

export type SubjectPerformance = {
  subject_id: string | null;
  title_bn: string;
  title_en: string;
  attempted: number;
  correct: number;
  accuracy: number;
};

export type TopicPerformance = {
  topic_id: string;
  title_bn: string;
  title_en: string;
  subject_bn: string;
  attempted: number;
  correct: number;
  accuracy: number;
};

/** The signed-in student's own rank in a leaderboard scope (jh_my_rank). */
export type MyRank = {
  rank: number | null;
  total: number;
  score?: number;
  total_marks?: number;
  accuracy?: number;
  submitted_at?: string;
};

export type StudentAnalytics = {
  summary: {
    attempts: number;
    released: number;
    avg_score: number;
    avg_accuracy: number;
    correct: number;
    wrong: number;
    unanswered: number;
    best_score: number;
  };
  subjects: SubjectPerformance[];
  topics: TopicPerformance[];
  weekly: { date: string; score: number; attempts: number }[];
  history: ResultHistoryRow[];
};

export type ResultHistoryRow = {
  attempt_id: string;
  result_id: string;
  score: number;
  total_marks: number;
  accuracy: number;
  correct: number;
  wrong: number;
  unanswered: number;
  mode: AttemptMode;
  is_released: boolean;
  submitted_at: string | null;
  title_bn: string | null;
  title_en: string | null;
  course_id: string;
};

export type LeaderboardRow = {
  rank: number;
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  score: number;
  total_marks: number;
  accuracy: number;
  duration_seconds: number | null;
  submitted_at: string | null;
  course_id: string;
};

export type Routine = {
  id: string;
  course_id: string;
  kind: "daily" | "weekly_special";
  routine_date: string;
  title_en: string;
  title_bn: string;
  subject_id: string | null;
  topic_id: string | null;
  subtopic_id: string | null;
  minutes: number;
  focus_note_bn: string | null;
  status: "draft" | "published" | "archived" | "cancelled";
  slot_label?: string | null;
  target_bn?: string | null;
  task_kind?: "study" | "practice" | "revision" | "exam" | "rest" | null;
  topic_ids?: string[];
  subtopic_ids?: string[];
  subject_title_bn?: string | null;
  topic_title_bn?: string | null;
  subtopic_title_bn?: string | null;
  /** Bengali titles resolved from topic_ids / subtopic_ids (multi-topic rows). */
  topic_titles_bn?: string[];
  subtopic_titles_bn?: string[];
};

export type AuditLog = {
  id: number;
  actor_id: string | null;
  actor_role: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
  actor_name?: string | null;
};

export const ROLE_LABELS: Record<RoleId, { bn: string; en: string }> = {
  student: { bn: "শিক্ষার্থী", en: "Student" },
  content_editor: { bn: "কনটেন্ট এডিটর", en: "Content Editor" },
  admin: { bn: "প্রশাসক", en: "Administrator" },
  super_admin: { bn: "সুপার অ্যাডমিন", en: "Super Admin" },
};

export const STATUS_LABELS: Record<QuestionStatus, { bn: string; en: string }> = {
  draft: { bn: "খসড়া", en: "Draft" },
  pending_review: { bn: "পর্যালোচনার অপেক্ষায়", en: "Pending review" },
  approved: { bn: "অনুমোদিত", en: "Approved" },
  rejected: { bn: "প্রত্যাখ্যাত", en: "Rejected" },
  archived: { bn: "আর্কাইভ", en: "Archived" },
};

export const EXAM_KIND_LABELS: Record<ExamKind, { bn: string; en: string }> = {
  daily_live: { bn: "দৈনিক লাইভ পরীক্ষা", en: "Daily Live Exam" },
  weekly_special: { bn: "সাপ্তাহিক স্পেশাল", en: "Weekly Special" },
  scheduled_mock: { bn: "নির্ধারিত মক", en: "Scheduled Mock" },
};

export const MODE_LABELS: Record<AttemptMode, { bn: string; en: string }> = {
  scheduled: { bn: "নির্ধারিত পরীক্ষা", en: "Scheduled exam" },
  custom: { bn: "কাস্টম পরীক্ষা", en: "Custom exam" },
  mixed_practice: { bn: "মিশ্র প্র্যাকটিস", en: "Mixed practice" },
  topic_practice: { bn: "টপিক প্র্যাকটিস", en: "Topic practice" },
  wrong_practice: { bn: "ভুল উত্তরের প্র্যাকটিস", en: "Wrong-answer practice" },
  bookmark_practice: { bn: "বুকমার্ক প্র্যাকটিস", en: "Bookmarked practice" },
  timed_mock: { bn: "টাইমড মক", en: "Timed mock" },
  revision: { bn: "রিভিশন", en: "Revision" },
};
