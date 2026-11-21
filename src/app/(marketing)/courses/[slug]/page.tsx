import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, BookOpen, CalendarDays, CheckCircle2, Clock3, Info, Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getCourseBySlug, listPublishedSchedules, listSubjects, listTopicsWithSubtopics } from "@/lib/queries";
import { formatDate, formatNumber, formatTime } from "@/lib/format";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const course = await getCourseBySlug(slug);
  if (!course) return { title: "কোর্স পাওয়া যায়নি" };
  return {
    title: course.title_bn,
    description:
      course.description_bn ??
      `${course.title_bn} প্রস্তুতির বিষয়, টপিক ও প্রশ্নব্যাংক — JobHub-এ যাচাইকৃত প্রশ্নে অনুশীলন করুন।`,
  };
}

export default async function CourseDetailPage({ params }: Params) {
  const { slug } = await params;
  const course = await getCourseBySlug(slug);
  if (!course) notFound();

  const [subjects, topics, schedules] = await Promise.all([
    listSubjects(course.id),
    listTopicsWithSubtopics(course.id),
    listPublishedSchedules({ courseId: course.id, limit: 6 }),
  ]);

  const topicsBySubject = new Map<string, typeof topics>();
  for (const topic of topics) {
    const list = topicsBySubject.get(topic.subject_id) ?? [];
    list.push(topic);
    topicsBySubject.set(topic.subject_id, list);
  }

  const totalTopics = topics.length;
  const totalSubtopics = topics.reduce((sum, t) => sum + t.subtopics.length, 0);

  return (
    <div>
      <section className="jh-hero-field border-b border-[var(--border)]">
        <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
          <nav aria-label="Breadcrumb" className="text-[0.75rem] text-[var(--text-subtle)]">
            <Link href="/courses" className="hover:text-[var(--brand)]">
              কোর্স
            </Link>
            <span aria-hidden> / </span>
            <span className="text-[var(--text-muted)]">{course.title_bn}</span>
          </nav>

          <div className="mt-5 grid gap-8 lg:grid-cols-[1.4fr_0.6fr]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="brand">{course.level === "advanced" ? "উচ্চতর" : course.level === "intermediate" ? "মধ্যম" : "বেসিক"}</Badge>
                <Badge tone="neutral">{course.title_en}</Badge>
              </div>
              <h1 className="mt-3 text-balance text-[1.875rem] font-bold leading-tight tracking-[-0.035em] text-[var(--text)] sm:text-[2.25rem]">
                {course.title_bn}
              </h1>
              <p className="mt-3 max-w-2xl text-pretty text-[0.9375rem] leading-relaxed text-[var(--text-muted)]">
                {course.description_bn ??
                  `${course.title_bn} পরীক্ষার প্রস্তুতির জন্য বিষয়ভিত্তিক প্রশ্নব্যাংক, দিনভিত্তিক রুটিন ও নির্ধারিত লাইভ পরীক্ষা।`}
              </p>

              <div className="mt-6 flex flex-wrap gap-x-7 gap-y-3 text-[0.8125rem]">
                {[
                  { icon: <Layers className="size-4" />, label: "বিষয়", value: formatNumber(subjects.length) },
                  { icon: <BookOpen className="size-4" />, label: "টপিক", value: formatNumber(totalTopics) },
                  { icon: <CheckCircle2 className="size-4" />, label: "সাবটপিক", value: formatNumber(totalSubtopics) },
                ].map((stat) => (
                  <div key={stat.label} className="flex items-center gap-2">
                    <span className="text-[var(--brand)]">{stat.icon}</span>
                    <span className="font-semibold text-[var(--text)]">{stat.value}</span>
                    <span className="text-[var(--text-subtle)]">{stat.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="jh-card h-fit p-5">
              <h2 className="text-[0.9375rem] font-semibold text-[var(--text)]">প্রস্তুতি শুরু করুন</h2>
              <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-[var(--text-muted)]">
                এই কোর্সের বিষয় বেছে নিয়ে কাস্টম পরীক্ষা দিন অথবা প্র্যাকটিস সেন্টার থেকে অনুশীলন করুন।
              </p>
              <div className="mt-4 flex flex-col gap-2">
                <ButtonLink href={`/custom-exam?course=${course.slug}`} size="md">
                  কাস্টম পরীক্ষা তৈরি
                  <ArrowRight className="size-3.5" aria-hidden />
                </ButtonLink>
                <ButtonLink href={`/practice?course=${course.slug}`} variant="secondary" size="md">
                  প্র্যাকটিস সেন্টার
                </ButtonLink>
              </div>
              <dl className="mt-4 space-y-2 border-t border-[var(--border)] pt-3.5 text-[0.75rem]">
                <div className="flex justify-between gap-3">
                  <dt className="text-[var(--text-subtle)]">ডিফল্ট সময়</dt>
                  <dd className="font-medium text-[var(--text-muted)]">
                    {formatNumber(course.exam_config.duration_minutes)} মিনিট
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-[var(--text-subtle)]">নম্বরকরণ</dt>
                  <dd className="font-medium text-[var(--text-muted)]">
                    +{formatNumber(course.exam_config.positive_marks)} / −{formatNumber(course.exam_config.negative_marks)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-[var(--text-subtle)]">মূল্য</dt>
                  <dd className="font-semibold text-[var(--text)]">
                    {course.price_bdt === 0 ? "বিনামূল্যে" : `৳${formatNumber(course.price_bdt)}`}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_0.6fr]">
          <section aria-labelledby="syllabus-heading">
            <h2 id="syllabus-heading" className="text-[1.25rem] font-bold tracking-[-0.02em] text-[var(--text)]">
              বিষয় ও টপিক রূপরেখা
            </h2>
            <p className="mt-2 flex items-start gap-2 text-[0.8125rem] leading-relaxed text-[var(--text-muted)]">
              <Info className="mt-0.5 size-4 shrink-0 text-[var(--brand)]" aria-hidden />
              <span>
                এই রূপরেখা সম্পাদনা-ভিত্তিক অধ্যয়ন-তালিকা, অফিসিয়াল সিলেবাস নয়। সংশ্লিষ্ট কমিশনের
                সর্বশেষ বিজ্ঞপ্তি সবসময় প্রাধান্য পাবে।
              </span>
            </p>

            {subjects.length === 0 ? (
              <div className="mt-6">
                <EmptyState
                  icon={<Layers className="size-5" />}
                  title="এই কোর্সে এখনো বিষয় যোগ করা হয়নি"
                  description="প্রশাসক বিষয় ও টপিক যোগ করলে এখানে দেখা যাবে। নতুন কোর্স খালি থাকা স্বাভাবিক।"
                />
              </div>
            ) : (
              <div className="mt-6 space-y-3">
                {subjects.map((subject) => {
                  const subjectTopics = topicsBySubject.get(subject.id) ?? [];
                  return (
                    <details
                      key={subject.id}
                      className="group overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]"
                      open={subjects.length <= 3}
                    >
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 hover:bg-[var(--surface-muted)]">
                        <span className="min-w-0">
                          <span className="block text-[0.9375rem] font-semibold text-[var(--text)]">
                            {subject.title_bn}
                          </span>
                          <span className="mt-0.5 block text-[0.6875rem] text-[var(--text-subtle)]">
                            {subject.title_en} · {formatNumber(subjectTopics.length)} টপিক
                          </span>
                        </span>
                        <span className="shrink-0 text-[0.6875rem] font-semibold text-[var(--brand)] group-open:hidden">
                          দেখুন
                        </span>
                        <span className="shrink-0 text-[0.6875rem] font-semibold text-[var(--text-subtle)] group-open:inline hidden">
                          লুকান
                        </span>
                      </summary>
                      <div className="border-t border-[var(--border)] px-5 py-3.5">
                        {subjectTopics.length === 0 ? (
                          <p className="text-[0.8125rem] text-[var(--text-subtle)]">এই বিষয়ে এখনো টপিক নেই।</p>
                        ) : (
                          <ul className="space-y-2.5">
                            {subjectTopics.map((topic) => (
                              <li key={topic.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                                <span className="text-[0.8125rem] font-medium text-[var(--text)]">
                                  {topic.title_bn}
                                </span>
                                {topic.chapter ? (
                                  <span className="rounded-md bg-[var(--surface-sunken)] px-1.5 py-0.5 text-[0.625rem] font-medium text-[var(--text-subtle)]">
                                    {topic.chapter}
                                  </span>
                                ) : null}
                                {topic.subtopics.length > 0 ? (
                                  <span className="text-[0.6875rem] text-[var(--text-subtle)]">
                                    · {topic.subtopics.map((s) => s.title_bn).join(", ")}
                                  </span>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </details>
                  );
                })}
              </div>
            )}
          </section>

          <aside aria-labelledby="schedule-heading" className="space-y-4">
            <h2 id="schedule-heading" className="text-[1.25rem] font-bold tracking-[-0.02em] text-[var(--text)]">
              প্রকাশিত পরীক্ষা
            </h2>
            {schedules.length === 0 ? (
              <EmptyState
                compact
                icon={<CalendarDays className="size-5" />}
                title="এখনো কোনো পরীক্ষা প্রকাশিত হয়নি"
                description="প্রশাসক যাচাইকৃত প্রশ্নসহ পরীক্ষা প্রকাশ করলে এখানে দেখা যাবে।"
              />
            ) : (
              <ul className="space-y-2.5">
                {schedules.map((schedule) => (
                  <li key={schedule.id} className="jh-card p-4">
                    <p className="text-[0.8125rem] font-semibold text-[var(--text)]">{schedule.title_bn}</p>
                    <p className="mt-1 text-[0.6875rem] text-[var(--text-subtle)]">
                      {formatDate(schedule.starts_at)} · {formatTime(schedule.starts_at)}–{formatTime(schedule.ends_at)}
                    </p>
                    <div className="mt-2.5 flex items-center gap-2 text-[0.6875rem] text-[var(--text-muted)]">
                      <span className="inline-flex items-center gap-1">
                        <Clock3 className="size-3" aria-hidden />
                        {formatNumber(schedule.duration_minutes)} মিনিট
                      </span>
                      <span aria-hidden>·</span>
                      <span>{formatNumber(schedule.question_count)} প্রশ্ন</span>
                      <span aria-hidden>·</span>
                      <span>{formatNumber(schedule.total_marks)} নম্বর</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <ButtonLink href="/exams" variant="secondary" size="sm" className="w-full">
              পরীক্ষা কেন্দ্র দেখুন
            </ButtonLink>
          </aside>
        </div>
      </div>
    </div>
  );
}
