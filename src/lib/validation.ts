import { z } from "zod";

/** Shared Zod schemas used by API routes and server actions. */

export const emailSchema = z
  .string()
  .trim()
  .min(5, "Please enter your email address.")
  .max(254)
  .email("Please enter a valid email address.");

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(72, "Password must be 72 characters or fewer.")
  .regex(/[a-zA-Z]/, "Password must contain a letter.")
  .regex(/[0-9]/, "Password must contain a number.");

export const signUpSchema = z.object({
  fullName: z.string().trim().min(2, "Please enter your name.").max(80),
  email: emailSchema,
  password: passwordSchema,
  phone: z
    .string()
    .trim()
    .max(20)
    .regex(/^[0-9+\-\s]*$/, "Please enter a valid phone number.")
    .optional()
    .or(z.literal("")),
  targetCourse: z.string().trim().max(80).optional().or(z.literal("")),
});

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Please enter your password."),
});

export const compositionItemSchema = z.object({
  subject_id: z.string().uuid().nullable().optional(),
  topic_id: z.string().uuid().nullable().optional(),
  subtopic_id: z.string().uuid().nullable().optional(),
  count: z.number().int().min(1).max(200),
  label: z.string().max(160).optional(),
});

export const compositionSchema = z.object({
  items: z.array(compositionItemSchema).min(1, "Select at least one scope.").max(30),
});

export const startCustomExamSchema = z.object({
  courseId: z.string().uuid(),
  composition: compositionSchema,
  durationMinutes: z.number().int().min(1).max(240),
  mode: z
    .enum([
      "custom",
      "mixed_practice",
      "topic_practice",
      "wrong_practice",
      "bookmark_practice",
      "timed_mock",
      "revision",
    ])
    .default("custom"),
  titleEn: z.string().max(160).optional(),
  titleBn: z.string().max(160).optional(),
  /**
   * Exam mode: fixed total marks and the 60/20/10/10 difficulty mix. Off by
   * default so ordinary practice keeps its simple 1-mark-per-question scoring.
   */
  structured: z
    .object({
      totalMarks: z.number().int().min(1).max(500).default(100),
      mix: z
        .object({
          previous: z.number().int().min(0).max(100),
          hard: z.number().int().min(0).max(100),
          easy: z.number().int().min(0).max(100),
          medium: z.number().int().min(0).max(100),
        })
        .optional(),
    })
    .optional(),
});

export const saveAnswerSchema = z.object({
  attemptId: z.string().uuid(),
  questionId: z.string().uuid(),
  selectedOption: z.number().int().min(0).max(3).nullable(),
  markedForReview: z.boolean().optional().default(false),
});

export const submitAttemptSchema = z.object({
  attemptId: z.string().uuid(),
  reason: z.enum(["manual", "timeout"]).default("manual"),
});

export const bulkReviewSchema = z.object({
  action: z.enum(["approve", "reject", "archive", "restore", "submit"]),
  questionIds: z.array(z.string().uuid()).max(500).nullable().optional(),
  filters: z
    .object({
      course_id: z.string().uuid().optional(),
      subject_id: z.string().uuid().optional(),
      topic_id: z.string().uuid().optional(),
      status: z.enum(["draft", "pending_review", "approved", "rejected", "archived"]).optional(),
      difficulty: z.enum(["easy", "medium", "hard"]).optional(),
      source_type: z.enum(["manual", "csv_import", "json_import", "ai_assisted"]).optional(),
    })
    .optional(),
  notes: z.string().max(500).optional(),
});

export const publishScheduleSchema = z.object({
  scheduleId: z.string().uuid(),
});

export const scheduleDraftSchema = z.object({
  courseId: z.string().uuid(),
  kind: z.enum(["daily_live", "weekly_special", "scheduled_mock"]),
  titleEn: z.string().trim().min(3).max(160),
  titleBn: z.string().trim().min(2).max(160),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
  resultReleaseAt: z.string().datetime({ offset: true }),
  durationMinutes: z.number().int().min(1).max(240),
  questionCount: z.number().int().min(1).max(200),
  totalMarks: z.number().positive().max(1000),
  positiveMarks: z.number().positive().max(10).default(1),
  negativeMarks: z.number().min(0).max(10).default(0.5),
  composition: compositionSchema,
  routineId: z.string().uuid().nullable().optional(),
});

export const routineSchema = z.object({
  courseId: z.string().uuid(),
  kind: z.enum(["daily", "weekly_special"]),
  routineDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use the YYYY-MM-DD date format."),
  titleEn: z.string().trim().max(160).default(""),
  titleBn: z.string().trim().max(160).default(""),
  subjectId: z.string().uuid().nullable().optional(),
  topicId: z.string().uuid().nullable().optional(),
  subtopicId: z.string().uuid().nullable().optional(),
  minutes: z.number().int().min(5).max(480),
  focusNoteBn: z.string().max(500).optional(),
});

export const courseSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(2)
    .max(79)
    .regex(/^[a-z0-9][a-z0-9-]*$/, "Use lowercase letters, numbers and hyphens only."),
  titleEn: z.string().trim().min(3).max(120),
  titleBn: z.string().trim().min(2).max(120),
  level: z.enum(["foundation", "intermediate", "advanced"]).default("foundation"),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
  priceBdt: z.number().int().min(0).max(100000).default(0),
  summaryBn: z.string().trim().max(400).optional(),
  summaryEn: z.string().trim().max(400).optional(),
});

export const questionImportRowSchema = z.object({
  course: z.string().trim().min(1),
  subject: z.string().trim().min(1),
  topic: z.string().trim().optional(),
  subtopic: z.string().trim().optional(),
  question: z.string().trim().min(8, "Question text is too short."),
  option_a: z.string().trim().min(1),
  option_b: z.string().trim().min(1),
  option_c: z.string().trim().min(1),
  option_d: z.string().trim().min(1),
  answer: z.union([z.enum(["A", "B", "C", "D"]), z.coerce.number().int().min(0).max(3)]),
  explanation: z.string().trim().default(""),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  source: z.string().trim().default(""),
  year: z.coerce.number().int().min(1971).max(2100).optional().nullable(),
  status: z.enum(["draft", "pending_review", "approved", "rejected", "archived"]).default("pending_review"),
  source_type: z.enum(["manual", "csv_import", "json_import", "ai_assisted"]).default("csv_import"),
});

export type QuestionImportRow = z.infer<typeof questionImportRowSchema>;

export const profileUpdateSchema = z.object({
  fullName: z.string().trim().min(2).max(80).optional(),
  fullNameBn: z.string().trim().max(80).optional(),
  phone: z.string().trim().max(20).optional(),
  locale: z.enum(["bn", "en"]).optional(),
  targetCourseId: z.string().uuid().nullable().optional(),
});
