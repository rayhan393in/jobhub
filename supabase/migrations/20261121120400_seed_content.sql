-- ============================================================================
-- JobHub — 05 Editorial sample content (development seed)
-- These are JobHub-authored editorial questions imported in `pending_review`.
-- They are NOT verified past questions and are NOT approved automatically.
-- An administrator must review and approve them before any exam can use them.
-- No exam, routine or schedule is published by this migration.
-- ============================================================================

do $$
declare
  v_admin uuid;
  v_batch uuid;
  v_q uuid;
  v_course uuid;
begin
  -- Import attribution: the first super admin if one exists, otherwise NULL.
  select id into v_admin from public.profiles where role_id = 'super_admin' order by created_at limit 1;

  insert into public.import_batches (created_by, filename, format, mode, total_rows)
  values (v_admin, 'editorial-sample-questions.json', 'json', 'commit', 48)
  returning id into v_batch;

  select c.id into v_course from public.courses c where c.slug = 'bcs';
  v_q := null;
  select qq.id into v_q
    from public.questions qq
    join public.subjects su on su.id = qq.subject_id
    join public.topics t on t.id = qq.topic_id
    where qq.course_id = v_course and su.slug = 'bangla'
      and qq.fingerprint = encode(digest('বাংলা বর্ণমালায় মোট স্বরবর্ণ কতটি?', 'sha256'), 'hex')
    limit 1;

  if v_q is null then
    insert into public.questions (
      course_id, subject_id, topic_id, statement, option_a, option_b, option_c, option_d,
      correct_option, explanation, difficulty, source, source_type, year, status, is_verified,
      fingerprint, import_batch_id, created_by
    )
    select v_course, su.id, t.id, 'বাংলা বর্ণমালায় মোট স্বরবর্ণ কতটি?', '৭টি', '১১টি', '৩৯টি', '৫০টি',
           1, 'বাংলা বর্ণমালায় স্বরবর্ণ ১১টি (অ, আ, ই, ঈ, উ, ঊ, ঋ, এ, ঐ, ও, ঔ)।', 'easy', 'JobHub editorial — general Bengali grammar', 'manual', null,
           'pending_review', false,
           encode(digest('বাংলা বর্ণমালায় মোট স্বরবর্ণ কতটি?', 'sha256'), 'hex'), v_batch, v_admin
    from public.subjects su
    join public.topics t on t.subject_id = su.id
    where su.course_id = v_course and su.slug = 'bangla' and t.sort_order = 1;
  end if;

  select c.id into v_course from public.courses c where c.slug = 'bcs';
  v_q := null;
  select qq.id into v_q
    from public.questions qq
    join public.subjects su on su.id = qq.subject_id
    join public.topics t on t.id = qq.topic_id
    where qq.course_id = v_course and su.slug = 'bangla'
      and qq.fingerprint = encode(digest('বাংলা বর্ণমালায় ব্যঞ্জনবর্ণের সংখ্যা কত?', 'sha256'), 'hex')
    limit 1;

  if v_q is null then
    insert into public.questions (
      course_id, subject_id, topic_id, statement, option_a, option_b, option_c, option_d,
      correct_option, explanation, difficulty, source, source_type, year, status, is_verified,
      fingerprint, import_batch_id, created_by
    )
    select v_course, su.id, t.id, 'বাংলা বর্ণমালায় ব্যঞ্জনবর্ণের সংখ্যা কত?', '২৫টি', '৩৯টি', '৪১টি', '৫০টি',
           1, 'বাংলা বর্ণমালায় ব্যঞ্জনবর্ণ ৩৯টি। মোট বর্ণ ৫০টি (১১ স্বর + ৩৯ ব্যঞ্জন)।', 'easy', 'JobHub editorial — general Bengali grammar', 'manual', null,
           'pending_review', false,
           encode(digest('বাংলা বর্ণমালায় ব্যঞ্জনবর্ণের সংখ্যা কত?', 'sha256'), 'hex'), v_batch, v_admin
    from public.subjects su
    join public.topics t on t.subject_id = su.id
    where su.course_id = v_course and su.slug = 'bangla' and t.sort_order = 1;
  end if;

  select c.id into v_course from public.courses c where c.slug = 'bcs';
  v_q := null;
  select qq.id into v_q
    from public.questions qq
    join public.subjects su on su.id = qq.subject_id
    join public.topics t on t.id = qq.topic_id
    where qq.course_id = v_course and su.slug = 'bangla'
      and qq.fingerprint = encode(digest('‘হ্রস্ব’ শব্দের বিপরীতার্থক শব্দ কোনটি?', 'sha256'), 'hex')
    limit 1;

  if v_q is null then
    insert into public.questions (
      course_id, subject_id, topic_id, statement, option_a, option_b, option_c, option_d,
      correct_option, explanation, difficulty, source, source_type, year, status, is_verified,
      fingerprint, import_batch_id, created_by
    )
    select v_course, su.id, t.id, '‘হ্রস্ব’ শব্দের বিপরীতার্থক শব্দ কোনটি?', 'দীর্ঘ', 'ক্ষুদ্র', 'সংক্ষিপ্ত', 'উচ্চ',
           0, 'হ্রস্ব >< দীর্ঘ। এটি একটি বিপরীতার্থক শব্দ জোড়া।', 'easy', 'JobHub editorial — general Bengali grammar', 'manual', null,
           'pending_review', false,
           encode(digest('‘হ্রস্ব’ শব্দের বিপরীতার্থক শব্দ কোনটি?', 'sha256'), 'hex'), v_batch, v_admin
    from public.subjects su
    join public.topics t on t.subject_id = su.id
    where su.course_id = v_course and su.slug = 'bangla' and t.sort_order = 1;
  end if;

  select c.id into v_course from public.courses c where c.slug = 'bcs';
  v_q := null;
  select qq.id into v_q
    from public.questions qq
    join public.subjects su on su.id = qq.subject_id
    join public.topics t on t.id = qq.topic_id
    where qq.course_id = v_course and su.slug = 'bangla'
      and qq.fingerprint = encode(digest('নিচের কোনটি ঘোষ ধ্বনি?', 'sha256'), 'hex')
    limit 1;

  if v_q is null then
    insert into public.questions (
      course_id, subject_id, topic_id, statement, option_a, option_b, option_c, option_d,
      correct_option, explanation, difficulty, source, source_type, year, status, is_verified,
      fingerprint, import_batch_id, created_by
    )
    select v_course, su.id, t.id, 'নিচের কোনটি ঘোষ ধ্বনি?', 'ক', 'খ', 'গ', 'চ',
           2, '‘গ’ একটি ঘোষ ধ্বনি; ক, খ, চ অঘোষ ধ্বনি।', 'medium', 'JobHub editorial — general Bengali grammar', 'manual', null,
           'pending_review', false,
           encode(digest('নিচের কোনটি ঘোষ ধ্বনি?', 'sha256'), 'hex'), v_batch, v_admin
    from public.subjects su
    join public.topics t on t.subject_id = su.id
    where su.course_id = v_course and su.slug = 'bangla' and t.sort_order = 1;
  end if;

  select c.id into v_course from public.courses c where c.slug = 'bcs';
  v_q := null;
  select qq.id into v_q
    from public.questions qq
    join public.subjects su on su.id = qq.subject_id
    join public.topics t on t.id = qq.topic_id
    where qq.course_id = v_course and su.slug = 'bangla'
      and qq.fingerprint = encode(digest('‘অ’ ধ্বনিটি কোন ধরনের?', 'sha256'), 'hex')
    limit 1;

  if v_q is null then
    insert into public.questions (
      course_id, subject_id, topic_id, statement, option_a, option_b, option_c, option_d,
      correct_option, explanation, difficulty, source, source_type, year, status, is_verified,
      fingerprint, import_batch_id, created_by
    )
    select v_course, su.id, t.id, '‘অ’ ধ্বনিটি কোন ধরনের?', 'স্বরধ্বনি', 'ব্যঞ্জনধ্বনি', 'অনুনাসিক', 'ধ্বন্যাত্মক',
           0, '‘অ’ একটি স্বরধ্বনি।', 'easy', 'JobHub editorial — general Bengali grammar', 'manual', null,
           'pending_review', false,
           encode(digest('‘অ’ ধ্বনিটি কোন ধরনের?', 'sha256'), 'hex'), v_batch, v_admin
    from public.subjects su
    join public.topics t on t.subject_id = su.id
    where su.course_id = v_course and su.slug = 'bangla' and t.sort_order = 1;
  end if;

  select c.id into v_course from public.courses c where c.slug = 'bcs';
  v_q := null;
  select qq.id into v_q
    from public.questions qq
    join public.subjects su on su.id = qq.subject_id
    join public.topics t on t.id = qq.topic_id
    where qq.course_id = v_course and su.slug = 'bangla'
      and qq.fingerprint = encode(digest('‘নবী + ইমন’ = নবীন — এখানে কোন সন্ধি হয়েছে?', 'sha256'), 'hex')
    limit 1;

  if v_q is null then
    insert into public.questions (
      course_id, subject_id, topic_id, statement, option_a, option_b, option_c, option_d,
      correct_option, explanation, difficulty, source, source_type, year, status, is_verified,
      fingerprint, import_batch_id, created_by
    )
    select v_course, su.id, t.id, '‘নবী + ইমন’ = নবীন — এখানে কোন সন্ধি হয়েছে?', 'স্বরসন্ধি', 'ব্যঞ্জনসন্ধি', 'বিসর্গসন্ধি', 'অনুনাসিক সন্ধি',
           0, 'স্বরবর্ণের সঙ্গে স্বরবর্ণের মিলন হলে স্বরসন্ধি হয়।', 'medium', 'JobHub editorial — general Bengali grammar', 'manual', null,
           'pending_review', false,
           encode(digest('‘নবী + ইমন’ = নবীন — এখানে কোন সন্ধি হয়েছে?', 'sha256'), 'hex'), v_batch, v_admin
    from public.subjects su
    join public.topics t on t.subject_id = su.id
    where su.course_id = v_course and su.slug = 'bangla' and t.sort_order = 2;
  end if;

  select c.id into v_course from public.courses c where c.slug = 'bcs';
  v_q := null;
  select qq.id into v_q
    from public.questions qq
    join public.subjects su on su.id = qq.subject_id
    join public.topics t on t.id = qq.topic_id
    where qq.course_id = v_course and su.slug = 'bangla'
      and qq.fingerprint = encode(digest('‘বিদ্যা + আলয়’ = বিদ্যালয় — কোন সন্ধি?', 'sha256'), 'hex')
    limit 1;

  if v_q is null then
    insert into public.questions (
      course_id, subject_id, topic_id, statement, option_a, option_b, option_c, option_d,
      correct_option, explanation, difficulty, source, source_type, year, status, is_verified,
      fingerprint, import_batch_id, created_by
    )
    select v_course, su.id, t.id, '‘বিদ্যা + আলয়’ = বিদ্যালয় — কোন সন্ধি?', 'স্বরসন্ধি', 'বিসর্গসন্ধি', 'ব্যঞ্জনসন্ধি', 'নিপাতনে সিদ্ধ',
           0, 'আ + আ = আ, তাই এটি স্বরসন্ধি।', 'medium', 'JobHub editorial — general Bengali grammar', 'manual', null,
           'pending_review', false,
           encode(digest('‘বিদ্যা + আলয়’ = বিদ্যালয় — কোন সন্ধি?', 'sha256'), 'hex'), v_batch, v_admin
    from public.subjects su
    join public.topics t on t.subject_id = su.id
    where su.course_id = v_course and su.slug = 'bangla' and t.sort_order = 2;
  end if;

  select c.id into v_course from public.courses c where c.slug = 'bcs';
  v_q := null;
  select qq.id into v_q
    from public.questions qq
    join public.subjects su on su.id = qq.subject_id
    join public.topics t on t.id = qq.topic_id
    where qq.course_id = v_course and su.slug = 'bangla'
      and qq.fingerprint = encode(digest('‘মনঃ + কষ্ট’ = মনঃকষ্ট — সন্ধিটির নাম কী?', 'sha256'), 'hex')
    limit 1;

  if v_q is null then
    insert into public.questions (
      course_id, subject_id, topic_id, statement, option_a, option_b, option_c, option_d,
      correct_option, explanation, difficulty, source, source_type, year, status, is_verified,
      fingerprint, import_batch_id, created_by
    )
    select v_course, su.id, t.id, '‘মনঃ + কষ্ট’ = মনঃকষ্ট — সন্ধিটির নাম কী?', 'স্বরসন্ধি', 'বিসর্গসন্ধি', 'ব্যঞ্জনসন্ধি', 'কোনোটিই নয়',
           1, 'বিসর্গের সঙ্গে ব্যঞ্জনের মিলনে বিসর্গসন্ধি হয়।', 'medium', 'JobHub editorial — general Bengali grammar', 'manual', null,
           'pending_review', false,
           encode(digest('‘মনঃ + কষ্ট’ = মনঃকষ্ট — সন্ধিটির নাম কী?', 'sha256'), 'hex'), v_batch, v_admin
    from public.subjects su
    join public.topics t on t.subject_id = su.id
    where su.course_id = v_course and su.slug = 'bangla' and t.sort_order = 2;
  end if;

  select c.id into v_course from public.courses c where c.slug = 'bcs';
  v_q := null;
  select qq.id into v_q
    from public.questions qq
    join public.subjects su on su.id = qq.subject_id
    join public.topics t on t.id = qq.topic_id
    where qq.course_id = v_course and su.slug = 'english'
      and qq.fingerprint = encode(digest('She is ___ honest woman.', 'sha256'), 'hex')
    limit 1;

  if v_q is null then
    insert into public.questions (
      course_id, subject_id, topic_id, statement, option_a, option_b, option_c, option_d,
      correct_option, explanation, difficulty, source, source_type, year, status, is_verified,
      fingerprint, import_batch_id, created_by
    )
    select v_course, su.id, t.id, 'She is ___ honest woman.', 'a', 'an', 'the', 'no article',
           1, '‘honest’ begins with a vowel sound (/ɒ/), so ‘an’ is used.', 'easy', 'JobHub editorial — English grammar', 'manual', null,
           'pending_review', false,
           encode(digest('She is ___ honest woman.', 'sha256'), 'hex'), v_batch, v_admin
    from public.subjects su
    join public.topics t on t.subject_id = su.id
    where su.course_id = v_course and su.slug = 'english' and t.sort_order = 1;
  end if;

  select c.id into v_course from public.courses c where c.slug = 'bcs';
  v_q := null;
  select qq.id into v_q
    from public.questions qq
    join public.subjects su on su.id = qq.subject_id
    join public.topics t on t.id = qq.topic_id
    where qq.course_id = v_course and su.slug = 'english'
      and qq.fingerprint = encode(digest('He is ___ university student.', 'sha256'), 'hex')
    limit 1;

  if v_q is null then
    insert into public.questions (
      course_id, subject_id, topic_id, statement, option_a, option_b, option_c, option_d,
      correct_option, explanation, difficulty, source, source_type, year, status, is_verified,
      fingerprint, import_batch_id, created_by
    )
    select v_course, su.id, t.id, 'He is ___ university student.', 'a', 'an', 'the', 'no article',
           0, '‘university’ begins with the consonant sound /j/, so ‘a’ is used.', 'medium', 'JobHub editorial — English grammar', 'manual', null,
           'pending_review', false,
           encode(digest('He is ___ university student.', 'sha256'), 'hex'), v_batch, v_admin
    from public.subjects su
    join public.topics t on t.subject_id = su.id
    where su.course_id = v_course and su.slug = 'english' and t.sort_order = 1;
  end if;

  select c.id into v_course from public.courses c where c.slug = 'bcs';
  v_q := null;
  select qq.id into v_q
    from public.questions qq
    join public.subjects su on su.id = qq.subject_id
    join public.topics t on t.id = qq.topic_id
    where qq.course_id = v_course and su.slug = 'english'
      and qq.fingerprint = encode(digest('___ Padma is the longest river in Bangladesh.', 'sha256'), 'hex')
    limit 1;

  if v_q is null then
    insert into public.questions (
      course_id, subject_id, topic_id, statement, option_a, option_b, option_c, option_d,
      correct_option, explanation, difficulty, source, source_type, year, status, is_verified,
      fingerprint, import_batch_id, created_by
    )
    select v_course, su.id, t.id, '___ Padma is the longest river in Bangladesh.', 'A', 'An', 'The', 'No article',
           2, 'Rivers take the definite article ‘the’.', 'easy', 'JobHub editorial — English grammar', 'manual', null,
           'pending_review', false,
           encode(digest('___ Padma is the longest river in Bangladesh.', 'sha256'), 'hex'), v_batch, v_admin
    from public.subjects su
    join public.topics t on t.subject_id = su.id
    where su.course_id = v_course and su.slug = 'english' and t.sort_order = 1;
  end if;

  select c.id into v_course from public.courses c where c.slug = 'bcs';
  v_q := null;
  select qq.id into v_q
    from public.questions qq
    join public.subjects su on su.id = qq.subject_id
    join public.topics t on t.id = qq.topic_id
    where qq.course_id = v_course and su.slug = 'english'
      and qq.fingerprint = encode(digest('I bought ___ umbrella yesterday.', 'sha256'), 'hex')
    limit 1;

  if v_q is null then
    insert into public.questions (
      course_id, subject_id, topic_id, statement, option_a, option_b, option_c, option_d,
      correct_option, explanation, difficulty, source, source_type, year, status, is_verified,
      fingerprint, import_batch_id, created_by
    )
    select v_course, su.id, t.id, 'I bought ___ umbrella yesterday.', 'a', 'an', 'the', 'no article',
           1, '‘umbrella’ begins with a vowel sound, so ‘an’ is used.', 'easy', 'JobHub editorial — English grammar', 'manual', null,
           'pending_review', false,
           encode(digest('I bought ___ umbrella yesterday.', 'sha256'), 'hex'), v_batch, v_admin
    from public.subjects su
    join public.topics t on t.subject_id = su.id
    where su.course_id = v_course and su.slug = 'english' and t.sort_order = 1;
  end if;

  select c.id into v_course from public.courses c where c.slug = 'bcs';
  v_q := null;
  select qq.id into v_q
    from public.questions qq
    join public.subjects su on su.id = qq.subject_id
    join public.topics t on t.id = qq.topic_id
    where qq.course_id = v_course and su.slug = 'english'
      and qq.fingerprint = encode(digest('Neither the teacher nor the students ___ present.', 'sha256'), 'hex')
    limit 1;

  if v_q is null then
    insert into public.questions (
      course_id, subject_id, topic_id, statement, option_a, option_b, option_c, option_d,
      correct_option, explanation, difficulty, source, source_type, year, status, is_verified,
      fingerprint, import_batch_id, created_by
    )
    select v_course, su.id, t.id, 'Neither the teacher nor the students ___ present.', 'was', 'were', 'is', 'has been',
           1, 'With ‘neither … nor’, the verb agrees with the nearer subject ‘students’.', 'medium', 'JobHub editorial — English grammar', 'manual', null,
           'pending_review', false,
           encode(digest('Neither the teacher nor the students ___ present.', 'sha256'), 'hex'), v_batch, v_admin
    from public.subjects su
    join public.topics t on t.subject_id = su.id
    where su.course_id = v_course and su.slug = 'english' and t.sort_order = 2;
  end if;

  select c.id into v_course from public.courses c where c.slug = 'bcs';
  v_q := null;
  select qq.id into v_q
    from public.questions qq
    join public.subjects su on su.id = qq.subject_id
    join public.topics t on t.id = qq.topic_id
    where qq.course_id = v_course and su.slug = 'english'
      and qq.fingerprint = encode(digest('Each of the boys ___ a pen.', 'sha256'), 'hex')
    limit 1;

  if v_q is null then
    insert into public.questions (
      course_id, subject_id, topic_id, statement, option_a, option_b, option_c, option_d,
      correct_option, explanation, difficulty, source, source_type, year, status, is_verified,
      fingerprint, import_batch_id, created_by
    )
    select v_course, su.id, t.id, 'Each of the boys ___ a pen.', 'have', 'has', 'are', 'were',
           1, '‘Each’ is singular and takes a singular verb.', 'easy', 'JobHub editorial — English grammar', 'manual', null,
           'pending_review', false,
           encode(digest('Each of the boys ___ a pen.', 'sha256'), 'hex'), v_batch, v_admin
    from public.subjects su
    join public.topics t on t.subject_id = su.id
    where su.course_id = v_course and su.slug = 'english' and t.sort_order = 2;
  end if;

  select c.id into v_course from public.courses c where c.slug = 'bcs';
  v_q := null;
  select qq.id into v_q
    from public.questions qq
    join public.subjects su on su.id = qq.subject_id
    join public.topics t on t.id = qq.topic_id
    where qq.course_id = v_course and su.slug = 'english'
      and qq.fingerprint = encode(digest('The number of students ___ increasing.', 'sha256'), 'hex')
    limit 1;

  if v_q is null then
    insert into public.questions (
      course_id, subject_id, topic_id, statement, option_a, option_b, option_c, option_d,
      correct_option, explanation, difficulty, source, source_type, year, status, is_verified,
      fingerprint, import_batch_id, created_by
    )
    select v_course, su.id, t.id, 'The number of students ___ increasing.', 'are', 'is', 'were', 'have been',
           1, '‘The number of’ takes a singular verb.', 'medium', 'JobHub editorial — English grammar', 'manual', null,
           'pending_review', false,
           encode(digest('The number of students ___ increasing.', 'sha256'), 'hex'), v_batch, v_admin
    from public.subjects su
    join public.topics t on t.subject_id = su.id
    where su.course_id = v_course and su.slug = 'english' and t.sort_order = 2;
  end if;

  select c.id into v_course from public.courses c where c.slug = 'bcs';
  v_q := null;
  select qq.id into v_q
    from public.questions qq
    join public.subjects su on su.id = qq.subject_id
    join public.topics t on t.id = qq.topic_id
    where qq.course_id = v_course and su.slug = 'bd'
      and qq.fingerprint = encode(digest('মুক্তিযুদ্ধ শুরু হয় কত সালে?', 'sha256'), 'hex')
    limit 1;

  if v_q is null then
    insert into public.questions (
      course_id, subject_id, topic_id, statement, option_a, option_b, option_c, option_d,
      correct_option, explanation, difficulty, source, source_type, year, status, is_verified,
      fingerprint, import_batch_id, created_by
    )
    select v_course, su.id, t.id, 'মুক্তিযুদ্ধ শুরু হয় কত সালে?', '১৯৪৭', '১৯৫২', '১৯৭১', '১৯৭৫',
           2, 'বাংলাদেশের মহান মুক্তিযুদ্ধ ১৯৭১ সালে সংঘটিত হয়।', 'easy', 'JobHub editorial — Bangladesh affairs', 'manual', 2021,
           'pending_review', false,
           encode(digest('মুক্তিযুদ্ধ শুরু হয় কত সালে?', 'sha256'), 'hex'), v_batch, v_admin
    from public.subjects su
    join public.topics t on t.subject_id = su.id
    where su.course_id = v_course and su.slug = 'bd' and t.sort_order = 3;
  end if;

  select c.id into v_course from public.courses c where c.slug = 'bcs';
  v_q := null;
  select qq.id into v_q
    from public.questions qq
    join public.subjects su on su.id = qq.subject_id
    join public.topics t on t.id = qq.topic_id
    where qq.course_id = v_course and su.slug = 'bd'
      and qq.fingerprint = encode(digest('মুক্তিযুদ্ধকালীন বাংলাদেশকে কয়টি সেক্টরে ভাগ করা হয়েছিল?', 'sha256'), 'hex')
    limit 1;

  if v_q is null then
    insert into public.questions (
      course_id, subject_id, topic_id, statement, option_a, option_b, option_c, option_d,
      correct_option, explanation, difficulty, source, source_type, year, status, is_verified,
      fingerprint, import_batch_id, created_by
    )
    select v_course, su.id, t.id, 'মুক্তিযুদ্ধকালীন বাংলাদেশকে কয়টি সেক্টরে ভাগ করা হয়েছিল?', '৯টি', '১০টি', '১১টি', '১২টি',
           2, 'মুক্তিযুদ্ধকালে সমগ্র দেশকে ১১টি সেক্টরে ভাগ করা হয়।', 'medium', 'JobHub editorial — Bangladesh affairs', 'manual', null,
           'pending_review', false,
           encode(digest('মুক্তিযুদ্ধকালীন বাংলাদেশকে কয়টি সেক্টরে ভাগ করা হয়েছিল?', 'sha256'), 'hex'), v_batch, v_admin
    from public.subjects su
    join public.topics t on t.subject_id = su.id
    where su.course_id = v_course and su.slug = 'bd' and t.sort_order = 3;
  end if;

  select c.id into v_course from public.courses c where c.slug = 'bcs';
  v_q := null;
  select qq.id into v_q
    from public.questions qq
    join public.subjects su on su.id = qq.subject_id
    join public.topics t on t.id = qq.topic_id
    where qq.course_id = v_course and su.slug = 'bd'
      and qq.fingerprint = encode(digest('বাংলাদেশের স্বাধীনতা ঘোষণা করা হয় কোন তারিখে?', 'sha256'), 'hex')
    limit 1;

  if v_q is null then
    insert into public.questions (
      course_id, subject_id, topic_id, statement, option_a, option_b, option_c, option_d,
      correct_option, explanation, difficulty, source, source_type, year, status, is_verified,
      fingerprint, import_batch_id, created_by
    )
    select v_course, su.id, t.id, 'বাংলাদেশের স্বাধীনতা ঘোষণা করা হয় কোন তারিখে?', '২৬ মার্চ ১৯৭১', '১৬ ডিসেম্বর ১৯৭১', '৭ মার্চ ১৯৭১', '২১ ফেব্রুয়ারি ১৯৫২',
           0, '২৬ মার্চ ১৯৭১ তারিখে স্বাধীনতা ঘোষণা করা হয়।', 'easy', 'JobHub editorial — Bangladesh affairs', 'manual', null,
           'pending_review', false,
           encode(digest('বাংলাদেশের স্বাধীনতা ঘোষণা করা হয় কোন তারিখে?', 'sha256'), 'hex'), v_batch, v_admin
    from public.subjects su
    join public.topics t on t.subject_id = su.id
    where su.course_id = v_course and su.slug = 'bd' and t.sort_order = 3;
  end if;

  select c.id into v_course from public.courses c where c.slug = 'bcs';
  v_q := null;
  select qq.id into v_q
    from public.questions qq
    join public.subjects su on su.id = qq.subject_id
    join public.topics t on t.id = qq.topic_id
    where qq.course_id = v_course and su.slug = 'bd'
      and qq.fingerprint = encode(digest('মুজিবনগর সরকার গঠিত হয় কত তারিখে?', 'sha256'), 'hex')
    limit 1;

  if v_q is null then
    insert into public.questions (
      course_id, subject_id, topic_id, statement, option_a, option_b, option_c, option_d,
      correct_option, explanation, difficulty, source, source_type, year, status, is_verified,
      fingerprint, import_batch_id, created_by
    )
    select v_course, su.id, t.id, 'মুজিবনগর সরকার গঠিত হয় কত তারিখে?', '১০ এপ্রিল ১৯৭১', '১৭ এপ্রিল ১৯৭১', '২৬ মার্চ ১৯৭১', '৪ নভেম্বর ১৯৭২',
           0, '১০ এপ্রিল ১৯৭১ মুজিবনগর সরকার গঠিত হয় এবং ১৭ এপ্রিল শপথ গ্রহণ করে।', 'hard', 'JobHub editorial — Bangladesh affairs', 'manual', null,
           'pending_review', false,
           encode(digest('মুজিবনগর সরকার গঠিত হয় কত তারিখে?', 'sha256'), 'hex'), v_batch, v_admin
    from public.subjects su
    join public.topics t on t.subject_id = su.id
    where su.course_id = v_course and su.slug = 'bd' and t.sort_order = 3;
  end if;

  select c.id into v_course from public.courses c where c.slug = 'bcs';
  v_q := null;
  select qq.id into v_q
    from public.questions qq
    join public.subjects su on su.id = qq.subject_id
    join public.topics t on t.id = qq.topic_id
    where qq.course_id = v_course and su.slug = 'bd'
      and qq.fingerprint = encode(digest('বাংলাদেশের সংবিধান কার্যকর হয় কত তারিখে?', 'sha256'), 'hex')
    limit 1;

  if v_q is null then
    insert into public.questions (
      course_id, subject_id, topic_id, statement, option_a, option_b, option_c, option_d,
      correct_option, explanation, difficulty, source, source_type, year, status, is_verified,
      fingerprint, import_batch_id, created_by
    )
    select v_course, su.id, t.id, 'বাংলাদেশের সংবিধান কার্যকর হয় কত তারিখে?', '৪ নভেম্বর ১৯৭২', '১৬ ডিসেম্বর ১৯৭২', '২৬ মার্চ ১৯৭২', '৭ মার্চ ১৯৭৩',
           1, 'সংবিধান ৪ নভেম্বর ১৯৭২ গৃহীত ও ১৬ ডিসেম্বর ১৯৭২ কার্যকর হয়।', 'medium', 'JobHub editorial — Bangladesh affairs', 'manual', null,
           'pending_review', false,
           encode(digest('বাংলাদেশের সংবিধান কার্যকর হয় কত তারিখে?', 'sha256'), 'hex'), v_batch, v_admin
    from public.subjects su
    join public.topics t on t.subject_id = su.id
    where su.course_id = v_course and su.slug = 'bd' and t.sort_order = 4;
  end if;

  select c.id into v_course from public.courses c where c.slug = 'bcs';
  v_q := null;
  select qq.id into v_q
    from public.questions qq
    join public.subjects su on su.id = qq.subject_id
    join public.topics t on t.id = qq.topic_id
    where qq.course_id = v_course and su.slug = 'bd'
      and qq.fingerprint = encode(digest('বাংলাদেশের সংবিধানে মৌলিক অধিকার কোন ভাগে আছে?', 'sha256'), 'hex')
    limit 1;

  if v_q is null then
    insert into public.questions (
      course_id, subject_id, topic_id, statement, option_a, option_b, option_c, option_d,
      correct_option, explanation, difficulty, source, source_type, year, status, is_verified,
      fingerprint, import_batch_id, created_by
    )
    select v_course, su.id, t.id, 'বাংলাদেশের সংবিধানে মৌলিক অধিকার কোন ভাগে আছে?', 'প্রথম ভাগ', 'দ্বিতীয় ভাগ', 'তৃতীয় ভাগ', 'চতুর্থ ভাগ',
           2, 'মৌলিক অধিকার সংবিধানের তৃতীয় ভাগে (অনুচ্ছেদ ২৬–৪৭) সন্নিবেশিত।', 'medium', 'JobHub editorial — Bangladesh affairs', 'manual', null,
           'pending_review', false,
           encode(digest('বাংলাদেশের সংবিধানে মৌলিক অধিকার কোন ভাগে আছে?', 'sha256'), 'hex'), v_batch, v_admin
    from public.subjects su
    join public.topics t on t.subject_id = su.id
    where su.course_id = v_course and su.slug = 'bd' and t.sort_order = 4;
  end if;

  select c.id into v_course from public.courses c where c.slug = 'bcs';
  v_q := null;
  select qq.id into v_q
    from public.questions qq
    join public.subjects su on su.id = qq.subject_id
    join public.topics t on t.id = qq.topic_id
    where qq.course_id = v_course and su.slug = 'international'
      and qq.fingerprint = encode(digest('জাতিসংঘের সদর দপ্তর কোথায়?', 'sha256'), 'hex')
    limit 1;

  if v_q is null then
    insert into public.questions (
      course_id, subject_id, topic_id, statement, option_a, option_b, option_c, option_d,
      correct_option, explanation, difficulty, source, source_type, year, status, is_verified,
      fingerprint, import_batch_id, created_by
    )
    select v_course, su.id, t.id, 'জাতিসংঘের সদর দপ্তর কোথায়?', 'জেনেভা', 'প্যারিস', 'নিউইয়র্ক', 'লন্ডন',
           2, 'জাতিসংঘের সদর দপ্তর নিউইয়র্ক, যুক্তরাষ্ট্রে।', 'easy', 'JobHub editorial — international affairs', 'manual', null,
           'pending_review', false,
           encode(digest('জাতিসংঘের সদর দপ্তর কোথায়?', 'sha256'), 'hex'), v_batch, v_admin
    from public.subjects su
    join public.topics t on t.subject_id = su.id
    where su.course_id = v_course and su.slug = 'international' and t.sort_order = 1;
  end if;

  select c.id into v_course from public.courses c where c.slug = 'bcs';
  v_q := null;
  select qq.id into v_q
    from public.questions qq
    join public.subjects su on su.id = qq.subject_id
    join public.topics t on t.id = qq.topic_id
    where qq.course_id = v_course and su.slug = 'international'
      and qq.fingerprint = encode(digest('জাতিসংঘের নিরাপত্তা পরিষদের স্থায়ী সদস্য কতটি?', 'sha256'), 'hex')
    limit 1;

  if v_q is null then
    insert into public.questions (
      course_id, subject_id, topic_id, statement, option_a, option_b, option_c, option_d,
      correct_option, explanation, difficulty, source, source_type, year, status, is_verified,
      fingerprint, import_batch_id, created_by
    )
    select v_course, su.id, t.id, 'জাতিসংঘের নিরাপত্তা পরিষদের স্থায়ী সদস্য কতটি?', '৩টি', '৫টি', '১০টি', '১৫টি',
           1, 'নিরাপত্তা পরিষদে ৫টি স্থায়ী সদস্য রয়েছে।', 'easy', 'JobHub editorial — international affairs', 'manual', null,
           'pending_review', false,
           encode(digest('জাতিসংঘের নিরাপত্তা পরিষদের স্থায়ী সদস্য কতটি?', 'sha256'), 'hex'), v_batch, v_admin
    from public.subjects su
    join public.topics t on t.subject_id = su.id
    where su.course_id = v_course and su.slug = 'international' and t.sort_order = 1;
  end if;

  select c.id into v_course from public.courses c where c.slug = 'bcs';
  v_q := null;
  select qq.id into v_q
    from public.questions qq
    join public.subjects su on su.id = qq.subject_id
    join public.topics t on t.id = qq.topic_id
    where qq.course_id = v_course and su.slug = 'international'
      and qq.fingerprint = encode(digest('বাংলাদেশ জাতিসংঘের সদস্যপদ লাভ করে কত সালে?', 'sha256'), 'hex')
    limit 1;

  if v_q is null then
    insert into public.questions (
      course_id, subject_id, topic_id, statement, option_a, option_b, option_c, option_d,
      correct_option, explanation, difficulty, source, source_type, year, status, is_verified,
      fingerprint, import_batch_id, created_by
    )
    select v_course, su.id, t.id, 'বাংলাদেশ জাতিসংঘের সদস্যপদ লাভ করে কত সালে?', '১৯৭২', '১৯৭৩', '১৯৭৪', '১৯৭৫',
           2, 'বাংলাদেশ ১৯৭৪ সালের ১৭ সেপ্টেম্বর জাতিসংঘের সদস্যপদ লাভ করে।', 'medium', 'JobHub editorial — international affairs', 'manual', null,
           'pending_review', false,
           encode(digest('বাংলাদেশ জাতিসংঘের সদস্যপদ লাভ করে কত সালে?', 'sha256'), 'hex'), v_batch, v_admin
    from public.subjects su
    join public.topics t on t.subject_id = su.id
    where su.course_id = v_course and su.slug = 'international' and t.sort_order = 1;
  end if;

  select c.id into v_course from public.courses c where c.slug = 'bcs';
  v_q := null;
  select qq.id into v_q
    from public.questions qq
    join public.subjects su on su.id = qq.subject_id
    join public.topics t on t.id = qq.topic_id
    where qq.course_id = v_course and su.slug = 'geography'
      and qq.fingerprint = encode(digest('বাংলাদেশের জলবায়ু মূলত কোন ধরনের?', 'sha256'), 'hex')
    limit 1;

  if v_q is null then
    insert into public.questions (
      course_id, subject_id, topic_id, statement, option_a, option_b, option_c, option_d,
      correct_option, explanation, difficulty, source, source_type, year, status, is_verified,
      fingerprint, import_batch_id, created_by
    )
    select v_course, su.id, t.id, 'বাংলাদেশের জলবায়ু মূলত কোন ধরনের?', 'নাতিশীতোষ্ণ', 'উষ্ণ ও আর্দ্র সাব-ট্রপিক্যাল', 'মরু', 'মেরু',
           1, 'বাংলাদেশের জলবায়ু উষ্ণ, আর্দ্র ও সাব-ট্রপিক্যাল monsoon type।', 'medium', 'JobHub editorial — geography', 'manual', null,
           'pending_review', false,
           encode(digest('বাংলাদেশের জলবায়ু মূলত কোন ধরনের?', 'sha256'), 'hex'), v_batch, v_admin
    from public.subjects su
    join public.topics t on t.subject_id = su.id
    where su.course_id = v_course and su.slug = 'geography' and t.sort_order = 2;
  end if;

  select c.id into v_course from public.courses c where c.slug = 'bcs';
  v_q := null;
  select qq.id into v_q
    from public.questions qq
    join public.subjects su on su.id = qq.subject_id
    join public.topics t on t.id = qq.topic_id
    where qq.course_id = v_course and su.slug = 'geography'
      and qq.fingerprint = encode(digest('বাংলাদেশে সবচেয়ে বেশি বৃষ্টিপাত হয় কোন মাসে?', 'sha256'), 'hex')
    limit 1;

  if v_q is null then
    insert into public.questions (
      course_id, subject_id, topic_id, statement, option_a, option_b, option_c, option_d,
      correct_option, explanation, difficulty, source, source_type, year, status, is_verified,
      fingerprint, import_batch_id, created_by
    )
    select v_course, su.id, t.id, 'বাংলাদেশে সবচেয়ে বেশি বৃষ্টিপাত হয় কোন মাসে?', 'জানুয়ারি', 'এপ্রিল', 'জুলাই', 'নভেম্বর',
           2, 'জুলাই মাসে বর্ষাকালের সর্বোচ্চ বৃষ্টিপাত হয়।', 'easy', 'JobHub editorial — geography', 'manual', null,
           'pending_review', false,
           encode(digest('বাংলাদেশে সবচেয়ে বেশি বৃষ্টিপাত হয় কোন মাসে?', 'sha256'), 'hex'), v_batch, v_admin
    from public.subjects su
    join public.topics t on t.subject_id = su.id
    where su.course_id = v_course and su.slug = 'geography' and t.sort_order = 2;
  end if;

  select c.id into v_course from public.courses c where c.slug = 'bcs';
  v_q := null;
  select qq.id into v_q
    from public.questions qq
    join public.subjects su on su.id = qq.subject_id
    join public.topics t on t.id = qq.topic_id
    where qq.course_id = v_course and su.slug = 'science'
      and qq.fingerprint = encode(digest('বলের একক কী?', 'sha256'), 'hex')
    limit 1;

  if v_q is null then
    insert into public.questions (
      course_id, subject_id, topic_id, statement, option_a, option_b, option_c, option_d,
      correct_option, explanation, difficulty, source, source_type, year, status, is_verified,
      fingerprint, import_batch_id, created_by
    )
    select v_course, su.id, t.id, 'বলের একক কী?', 'জুল', 'নিউটন', 'ওয়াট', 'প্যাসকেল',
           1, 'বলের SI একক নিউটন (N)।', 'easy', 'JobHub editorial — general science', 'manual', null,
           'pending_review', false,
           encode(digest('বলের একক কী?', 'sha256'), 'hex'), v_batch, v_admin
    from public.subjects su
    join public.topics t on t.subject_id = su.id
    where su.course_id = v_course and su.slug = 'science' and t.sort_order = 1;
  end if;

  select c.id into v_course from public.courses c where c.slug = 'bcs';
  v_q := null;
  select qq.id into v_q
    from public.questions qq
    join public.subjects su on su.id = qq.subject_id
    join public.topics t on t.id = qq.topic_id
    where qq.course_id = v_course and su.slug = 'science'
      and qq.fingerprint = encode(digest('কাজের একক কোনটি?', 'sha256'), 'hex')
    limit 1;

  if v_q is null then
    insert into public.questions (
      course_id, subject_id, topic_id, statement, option_a, option_b, option_c, option_d,
      correct_option, explanation, difficulty, source, source_type, year, status, is_verified,
      fingerprint, import_batch_id, created_by
    )
    select v_course, su.id, t.id, 'কাজের একক কোনটি?', 'নিউটন', 'জুল', 'ওয়াট', 'প্যাসকেল',
           1, 'কাজের SI একক জুল (J)।', 'easy', 'JobHub editorial — general science', 'manual', null,
           'pending_review', false,
           encode(digest('কাজের একক কোনটি?', 'sha256'), 'hex'), v_batch, v_admin
    from public.subjects su
    join public.topics t on t.subject_id = su.id
    where su.course_id = v_course and su.slug = 'science' and t.sort_order = 1;
  end if;

  select c.id into v_course from public.courses c where c.slug = 'bcs';
  v_q := null;
  select qq.id into v_q
    from public.questions qq
    join public.subjects su on su.id = qq.subject_id
    join public.topics t on t.id = qq.topic_id
    where qq.course_id = v_course and su.slug = 'science'
      and qq.fingerprint = encode(digest('আলোর গতিবেগ শূন্যস্থানে প্রায় কত?', 'sha256'), 'hex')
    limit 1;

  if v_q is null then
    insert into public.questions (
      course_id, subject_id, topic_id, statement, option_a, option_b, option_c, option_d,
      correct_option, explanation, difficulty, source, source_type, year, status, is_verified,
      fingerprint, import_batch_id, created_by
    )
    select v_course, su.id, t.id, 'আলোর গতিবেগ শূন্যস্থানে প্রায় কত?', '৩ × ১০⁶ m/s', '৩ × ১০⁸ m/s', '৩ × ১০⁵ m/s', '৩ × ১০¹⁰ m/s',
           1, 'শূন্যস্থানে আলোর গতিবেগ প্রায় ৩ × ১০⁸ m/s।', 'medium', 'JobHub editorial — general science', 'manual', null,
           'pending_review', false,
           encode(digest('আলোর গতিবেগ শূন্যস্থানে প্রায় কত?', 'sha256'), 'hex'), v_batch, v_admin
    from public.subjects su
    join public.topics t on t.subject_id = su.id
    where su.course_id = v_course and su.slug = 'science' and t.sort_order = 1;
  end if;

  select c.id into v_course from public.courses c where c.slug = 'bcs';
  v_q := null;
  select qq.id into v_q
    from public.questions qq
    join public.subjects su on su.id = qq.subject_id
    join public.topics t on t.id = qq.topic_id
    where qq.course_id = v_course and su.slug = 'ict'
      and qq.fingerprint = encode(digest('কম্পিউটারের মস্তিষ্ক বলা হয় কোনটিকে?', 'sha256'), 'hex')
    limit 1;

  if v_q is null then
    insert into public.questions (
      course_id, subject_id, topic_id, statement, option_a, option_b, option_c, option_d,
      correct_option, explanation, difficulty, source, source_type, year, status, is_verified,
      fingerprint, import_batch_id, created_by
    )
    select v_course, su.id, t.id, 'কম্পিউটারের মস্তিষ্ক বলা হয় কোনটিকে?', 'RAM', 'CPU', 'Hard Disk', 'Monitor',
           1, 'CPU (Central Processing Unit) কম্পিউটারের মস্তিষ্ক।', 'easy', 'JobHub editorial — computer & ICT', 'manual', null,
           'pending_review', false,
           encode(digest('কম্পিউটারের মস্তিষ্ক বলা হয় কোনটিকে?', 'sha256'), 'hex'), v_batch, v_admin
    from public.subjects su
    join public.topics t on t.subject_id = su.id
    where su.course_id = v_course and su.slug = 'ict' and t.sort_order = 1;
  end if;

  select c.id into v_course from public.courses c where c.slug = 'bcs';
  v_q := null;
  select qq.id into v_q
    from public.questions qq
    join public.subjects su on su.id = qq.subject_id
    join public.topics t on t.id = qq.topic_id
    where qq.course_id = v_course and su.slug = 'ict'
      and qq.fingerprint = encode(digest('নিচের কোনটি ইনপুট ডিভাইস?', 'sha256'), 'hex')
    limit 1;

  if v_q is null then
    insert into public.questions (
      course_id, subject_id, topic_id, statement, option_a, option_b, option_c, option_d,
      correct_option, explanation, difficulty, source, source_type, year, status, is_verified,
      fingerprint, import_batch_id, created_by
    )
    select v_course, su.id, t.id, 'নিচের কোনটি ইনপুট ডিভাইস?', 'মনিটর', 'প্রিন্টার', 'কিবোর্ড', 'স্পিকার',
           2, 'কিবোর্ড একটি ইনপুট ডিভাইস।', 'easy', 'JobHub editorial — computer & ICT', 'manual', null,
           'pending_review', false,
           encode(digest('নিচের কোনটি ইনপুট ডিভাইস?', 'sha256'), 'hex'), v_batch, v_admin
    from public.subjects su
    join public.topics t on t.subject_id = su.id
    where su.course_id = v_course and su.slug = 'ict' and t.sort_order = 1;
  end if;

  select c.id into v_course from public.courses c where c.slug = 'bcs';
  v_q := null;
  select qq.id into v_q
    from public.questions qq
    join public.subjects su on su.id = qq.subject_id
    join public.topics t on t.id = qq.topic_id
    where qq.course_id = v_course and su.slug = 'ict'
      and qq.fingerprint = encode(digest('বাইনারি ১০১০ এর দশমিক মান কত?', 'sha256'), 'hex')
    limit 1;

  if v_q is null then
    insert into public.questions (
      course_id, subject_id, topic_id, statement, option_a, option_b, option_c, option_d,
      correct_option, explanation, difficulty, source, source_type, year, status, is_verified,
      fingerprint, import_batch_id, created_by
    )
    select v_course, su.id, t.id, 'বাইনারি ১০১০ এর দশমিক মান কত?', '৮', '১০', '১২', '১৪',
           1, '১×৮ + ০×৪ + ১×২ + ০×১ = ১০।', 'medium', 'JobHub editorial — computer & ICT', 'manual', null,
           'pending_review', false,
           encode(digest('বাইনারি ১০১০ এর দশমিক মান কত?', 'sha256'), 'hex'), v_batch, v_admin
    from public.subjects su
    join public.topics t on t.subject_id = su.id
    where su.course_id = v_course and su.slug = 'ict' and t.sort_order = 3;
  end if;

  select c.id into v_course from public.courses c where c.slug = 'bcs';
  v_q := null;
  select qq.id into v_q
    from public.questions qq
    join public.subjects su on su.id = qq.subject_id
    join public.topics t on t.id = qq.topic_id
    where qq.course_id = v_course and su.slug = 'ict'
      and qq.fingerprint = encode(digest('হেক্সাডেসিমাল পদ্ধতিতে সর্বোচ্চ অঙ্ক কোনটি?', 'sha256'), 'hex')
    limit 1;

  if v_q is null then
    insert into public.questions (
      course_id, subject_id, topic_id, statement, option_a, option_b, option_c, option_d,
      correct_option, explanation, difficulty, source, source_type, year, status, is_verified,
      fingerprint, import_batch_id, created_by
    )
    select v_course, su.id, t.id, 'হেক্সাডেসিমাল পদ্ধতিতে সর্বোচ্চ অঙ্ক কোনটি?', '৯', 'E', 'F', 'G',
           2, 'হেক্সাডেসিমাল পদ্ধতিতে ০–৯ এবং A–F ব্যবহৃত হয়; সর্বোচ্চ F।', 'medium', 'JobHub editorial — computer & ICT', 'manual', null,
           'pending_review', false,
           encode(digest('হেক্সাডেসিমাল পদ্ধতিতে সর্বোচ্চ অঙ্ক কোনটি?', 'sha256'), 'hex'), v_batch, v_admin
    from public.subjects su
    join public.topics t on t.subject_id = su.id
    where su.course_id = v_course and su.slug = 'ict' and t.sort_order = 3;
  end if;

  select c.id into v_course from public.courses c where c.slug = 'bcs';
  v_q := null;
  select qq.id into v_q
    from public.questions qq
    join public.subjects su on su.id = qq.subject_id
    join public.topics t on t.id = qq.topic_id
    where qq.course_id = v_course and su.slug = 'math'
      and qq.fingerprint = encode(digest('কোনো সংখ্যার ২৫% = ৫০ হলে সংখ্যাটি কত?', 'sha256'), 'hex')
    limit 1;

  if v_q is null then
    insert into public.questions (
      course_id, subject_id, topic_id, statement, option_a, option_b, option_c, option_d,
      correct_option, explanation, difficulty, source, source_type, year, status, is_verified,
      fingerprint, import_batch_id, created_by
    )
    select v_course, su.id, t.id, 'কোনো সংখ্যার ২৫% = ৫০ হলে সংখ্যাটি কত?', '১০০', '১৫০', '২০০', '২৫০',
           2, 'সংখ্যাটি = ৫০ × ১০০ / ২৫ = ২০০।', 'easy', 'JobHub editorial — mathematical reasoning', 'manual', null,
           'pending_review', false,
           encode(digest('কোনো সংখ্যার ২৫% = ৫০ হলে সংখ্যাটি কত?', 'sha256'), 'hex'), v_batch, v_admin
    from public.subjects su
    join public.topics t on t.subject_id = su.id
    where su.course_id = v_course and su.slug = 'math' and t.sort_order = 1;
  end if;

  select c.id into v_course from public.courses c where c.slug = 'bcs';
  v_q := null;
  select qq.id into v_q
    from public.questions qq
    join public.subjects su on su.id = qq.subject_id
    join public.topics t on t.id = qq.topic_id
    where qq.course_id = v_course and su.slug = 'math'
      and qq.fingerprint = encode(digest('৮০ এর ১৫% কত?', 'sha256'), 'hex')
    limit 1;

  if v_q is null then
    insert into public.questions (
      course_id, subject_id, topic_id, statement, option_a, option_b, option_c, option_d,
      correct_option, explanation, difficulty, source, source_type, year, status, is_verified,
      fingerprint, import_batch_id, created_by
    )
    select v_course, su.id, t.id, '৮০ এর ১৫% কত?', '১০', '১২', '১৪', '১৬',
           1, '৮০ × ১৫ / ১০০ = ১২।', 'easy', 'JobHub editorial — mathematical reasoning', 'manual', null,
           'pending_review', false,
           encode(digest('৮০ এর ১৫% কত?', 'sha256'), 'hex'), v_batch, v_admin
    from public.subjects su
    join public.topics t on t.subject_id = su.id
    where su.course_id = v_course and su.slug = 'math' and t.sort_order = 1;
  end if;

  select c.id into v_course from public.courses c where c.slug = 'bcs';
  v_q := null;
  select qq.id into v_q
    from public.questions qq
    join public.subjects su on su.id = qq.subject_id
    join public.topics t on t.id = qq.topic_id
    where qq.course_id = v_course and su.slug = 'math'
      and qq.fingerprint = encode(digest('৫ : ৮ অনুপাতে ৩৯০ কে ভাগ করলে প্রথম অংশ কত?', 'sha256'), 'hex')
    limit 1;

  if v_q is null then
    insert into public.questions (
      course_id, subject_id, topic_id, statement, option_a, option_b, option_c, option_d,
      correct_option, explanation, difficulty, source, source_type, year, status, is_verified,
      fingerprint, import_batch_id, created_by
    )
    select v_course, su.id, t.id, '৫ : ৮ অনুপাতে ৩৯০ কে ভাগ করলে প্রথম অংশ কত?', '১৫০', '১৮০', '২১০', '২৪০',
           0, 'মোট অংশ ১৩; প্রথম অংশ = ৩৯০ × ৫/১৩ = ১৫০।', 'medium', 'JobHub editorial — mathematical reasoning', 'manual', null,
           'pending_review', false,
           encode(digest('৫ : ৮ অনুপাতে ৩৯০ কে ভাগ করলে প্রথম অংশ কত?', 'sha256'), 'hex'), v_batch, v_admin
    from public.subjects su
    join public.topics t on t.subject_id = su.id
    where su.course_id = v_course and su.slug = 'math' and t.sort_order = 2;
  end if;

  select c.id into v_course from public.courses c where c.slug = 'bcs';
  v_q := null;
  select qq.id into v_q
    from public.questions qq
    join public.subjects su on su.id = qq.subject_id
    join public.topics t on t.id = qq.topic_id
    where qq.course_id = v_course and su.slug = 'math'
      and qq.fingerprint = encode(digest('১০০ টাকায় কিনে ১২০ টাকায় বিক্রি করলে শতকরা লাভ কত?', 'sha256'), 'hex')
    limit 1;

  if v_q is null then
    insert into public.questions (
      course_id, subject_id, topic_id, statement, option_a, option_b, option_c, option_d,
      correct_option, explanation, difficulty, source, source_type, year, status, is_verified,
      fingerprint, import_batch_id, created_by
    )
    select v_course, su.id, t.id, '১০০ টাকায় কিনে ১২০ টাকায় বিক্রি করলে শতকরা লাভ কত?', '১০%', '১৫%', '২০%', '২৫%',
           2, 'লাভ = ২০ টাকা; শতকরা লাভ = ২০/১০০ × ১০০ = ২০%।', 'easy', 'JobHub editorial — mathematical reasoning', 'manual', null,
           'pending_review', false,
           encode(digest('১০০ টাকায় কিনে ১২০ টাকায় বিক্রি করলে শতকরা লাভ কত?', 'sha256'), 'hex'), v_batch, v_admin
    from public.subjects su
    join public.topics t on t.subject_id = su.id
    where su.course_id = v_course and su.slug = 'math' and t.sort_order = 3;
  end if;

  select c.id into v_course from public.courses c where c.slug = 'bcs';
  v_q := null;
  select qq.id into v_q
    from public.questions qq
    join public.subjects su on su.id = qq.subject_id
    join public.topics t on t.id = qq.topic_id
    where qq.course_id = v_course and su.slug = 'mental'
      and qq.fingerprint = encode(digest('২, ৬, ১২, ২০, ৩০, ? — পরবর্তী সংখ্যা কত?', 'sha256'), 'hex')
    limit 1;

  if v_q is null then
    insert into public.questions (
      course_id, subject_id, topic_id, statement, option_a, option_b, option_c, option_d,
      correct_option, explanation, difficulty, source, source_type, year, status, is_verified,
      fingerprint, import_batch_id, created_by
    )
    select v_course, su.id, t.id, '২, ৬, ১২, ২০, ৩০, ? — পরবর্তী সংখ্যা কত?', '৩৬', '৪০', '৪২', '৪৮',
           2, 'পার্থক্য ৪, ৬, ৮, ১০, ১২ — তাই ৩০ + ১২ = ৪২।', 'medium', 'JobHub editorial — mental ability', 'manual', null,
           'pending_review', false,
           encode(digest('২, ৬, ১২, ২০, ৩০, ? — পরবর্তী সংখ্যা কত?', 'sha256'), 'hex'), v_batch, v_admin
    from public.subjects su
    join public.topics t on t.subject_id = su.id
    where su.course_id = v_course and su.slug = 'mental' and t.sort_order = 1;
  end if;

  select c.id into v_course from public.courses c where c.slug = 'bcs';
  v_q := null;
  select qq.id into v_q
    from public.questions qq
    join public.subjects su on su.id = qq.subject_id
    join public.topics t on t.id = qq.topic_id
    where qq.course_id = v_course and su.slug = 'mental'
      and qq.fingerprint = encode(digest('৩, ৬, ১২, ২৪, ? — পরবর্তী সংখ্যা কত?', 'sha256'), 'hex')
    limit 1;

  if v_q is null then
    insert into public.questions (
      course_id, subject_id, topic_id, statement, option_a, option_b, option_c, option_d,
      correct_option, explanation, difficulty, source, source_type, year, status, is_verified,
      fingerprint, import_batch_id, created_by
    )
    select v_course, su.id, t.id, '৩, ৬, ১২, ২৪, ? — পরবর্তী সংখ্যা কত?', '৩৬', '৪২', '৪৮', '৫৪',
           2, 'প্রতিটি সংখ্যা আগেরটির দ্বিগুণ; ২৪ × ২ = ৪৮।', 'easy', 'JobHub editorial — mental ability', 'manual', null,
           'pending_review', false,
           encode(digest('৩, ৬, ১২, ২৪, ? — পরবর্তী সংখ্যা কত?', 'sha256'), 'hex'), v_batch, v_admin
    from public.subjects su
    join public.topics t on t.subject_id = su.id
    where su.course_id = v_course and su.slug = 'mental' and t.sort_order = 1;
  end if;

  select c.id into v_course from public.courses c where c.slug = 'bcs';
  v_q := null;
  select qq.id into v_q
    from public.questions qq
    join public.subjects su on su.id = qq.subject_id
    join public.topics t on t.id = qq.topic_id
    where qq.course_id = v_course and su.slug = 'ethics'
      and qq.fingerprint = encode(digest('সুশাসনের মূল উপাদান কোনটি?', 'sha256'), 'hex')
    limit 1;

  if v_q is null then
    insert into public.questions (
      course_id, subject_id, topic_id, statement, option_a, option_b, option_c, option_d,
      correct_option, explanation, difficulty, source, source_type, year, status, is_verified,
      fingerprint, import_batch_id, created_by
    )
    select v_course, su.id, t.id, 'সুশাসনের মূল উপাদান কোনটি?', 'স্বচ্ছতা', 'স্বজনপ্রীতি', 'ক্ষমতার অপব্যবহার', 'দুর্নীতি',
           0, 'স্বচ্ছতা, জবাবদিহি ও আইনের শাসন সুশাসনের মূল উপাদান।', 'easy', 'JobHub editorial — ethics & governance', 'manual', null,
           'pending_review', false,
           encode(digest('সুশাসনের মূল উপাদান কোনটি?', 'sha256'), 'hex'), v_batch, v_admin
    from public.subjects su
    join public.topics t on t.subject_id = su.id
    where su.course_id = v_course and su.slug = 'ethics' and t.sort_order = 1;
  end if;

  select c.id into v_course from public.courses c where c.slug = 'bcs';
  v_q := null;
  select qq.id into v_q
    from public.questions qq
    join public.subjects su on su.id = qq.subject_id
    join public.topics t on t.id = qq.topic_id
    where qq.course_id = v_course and su.slug = 'ethics'
      and qq.fingerprint = encode(digest('‘স্বচ্ছতা’ বলতে বোঝায়—', 'sha256'), 'hex')
    limit 1;

  if v_q is null then
    insert into public.questions (
      course_id, subject_id, topic_id, statement, option_a, option_b, option_c, option_d,
      correct_option, explanation, difficulty, source, source_type, year, status, is_verified,
      fingerprint, import_batch_id, created_by
    )
    select v_course, su.id, t.id, '‘স্বচ্ছতা’ বলতে বোঝায়—', 'গোপনীয়তা', 'তথ্যের প্রকাশ্যতা', 'নীরবতা', 'নিয়ন্ত্রণ',
           1, 'স্বচ্ছতা মানে সিদ্ধান্ত ও তথ্যের প্রকাশ্যতা।', 'medium', 'JobHub editorial — ethics & governance', 'manual', null,
           'pending_review', false,
           encode(digest('‘স্বচ্ছতা’ বলতে বোঝায়—', 'sha256'), 'hex'), v_batch, v_admin
    from public.subjects su
    join public.topics t on t.subject_id = su.id
    where su.course_id = v_course and su.slug = 'ethics' and t.sort_order = 1;
  end if;

  select c.id into v_course from public.courses c where c.slug = 'eee';
  v_q := null;
  select qq.id into v_q
    from public.questions qq
    join public.subjects su on su.id = qq.subject_id
    join public.topics t on t.id = qq.topic_id
    where qq.course_id = v_course and su.slug = 'circuit'
      and qq.fingerprint = encode(digest('A 10 Ω resistor carries 2 A. The power dissipated is—', 'sha256'), 'hex')
    limit 1;

  if v_q is null then
    insert into public.questions (
      course_id, subject_id, topic_id, statement, option_a, option_b, option_c, option_d,
      correct_option, explanation, difficulty, source, source_type, year, status, is_verified,
      fingerprint, import_batch_id, created_by
    )
    select v_course, su.id, t.id, 'A 10 Ω resistor carries 2 A. The power dissipated is—', '20 W', '40 W', '10 W', '5 W',
           1, 'P = I²R = 4 × 10 = 40 W.', 'easy', 'JobHub editorial — EEE', 'manual', null,
           'pending_review', false,
           encode(digest('A 10 Ω resistor carries 2 A. The power dissipated is—', 'sha256'), 'hex'), v_batch, v_admin
    from public.subjects su
    join public.topics t on t.subject_id = su.id
    where su.course_id = v_course and su.slug = 'circuit' and t.sort_order = 1;
  end if;

  select c.id into v_course from public.courses c where c.slug = 'eee';
  v_q := null;
  select qq.id into v_q
    from public.questions qq
    join public.subjects su on su.id = qq.subject_id
    join public.topics t on t.id = qq.topic_id
    where qq.course_id = v_course and su.slug = 'circuit'
      and qq.fingerprint = encode(digest('The SI unit of resistance is—', 'sha256'), 'hex')
    limit 1;

  if v_q is null then
    insert into public.questions (
      course_id, subject_id, topic_id, statement, option_a, option_b, option_c, option_d,
      correct_option, explanation, difficulty, source, source_type, year, status, is_verified,
      fingerprint, import_batch_id, created_by
    )
    select v_course, su.id, t.id, 'The SI unit of resistance is—', 'volt', 'ampere', 'ohm', 'watt',
           2, 'Resistance is measured in ohms (Ω).', 'easy', 'JobHub editorial — EEE', 'manual', null,
           'pending_review', false,
           encode(digest('The SI unit of resistance is—', 'sha256'), 'hex'), v_batch, v_admin
    from public.subjects su
    join public.topics t on t.subject_id = su.id
    where su.course_id = v_course and su.slug = 'circuit' and t.sort_order = 1;
  end if;

  select c.id into v_course from public.courses c where c.slug = 'eee';
  v_q := null;
  select qq.id into v_q
    from public.questions qq
    join public.subjects su on su.id = qq.subject_id
    join public.topics t on t.id = qq.topic_id
    where qq.course_id = v_course and su.slug = 'circuit'
      and qq.fingerprint = encode(digest('Two 6 Ω resistors in parallel give—', 'sha256'), 'hex')
    limit 1;

  if v_q is null then
    insert into public.questions (
      course_id, subject_id, topic_id, statement, option_a, option_b, option_c, option_d,
      correct_option, explanation, difficulty, source, source_type, year, status, is_verified,
      fingerprint, import_batch_id, created_by
    )
    select v_course, su.id, t.id, 'Two 6 Ω resistors in parallel give—', '12 Ω', '6 Ω', '3 Ω', '1 Ω',
           2, 'Equal parallel resistors give R/2 = 3 Ω.', 'medium', 'JobHub editorial — EEE', 'manual', null,
           'pending_review', false,
           encode(digest('Two 6 Ω resistors in parallel give—', 'sha256'), 'hex'), v_batch, v_admin
    from public.subjects su
    join public.topics t on t.subject_id = su.id
    where su.course_id = v_course and su.slug = 'circuit' and t.sort_order = 1;
  end if;

  select c.id into v_course from public.courses c where c.slug = 'eee';
  v_q := null;
  select qq.id into v_q
    from public.questions qq
    join public.subjects su on su.id = qq.subject_id
    join public.topics t on t.id = qq.topic_id
    where qq.course_id = v_course and su.slug = 'circuit'
      and qq.fingerprint = encode(digest('Kirchhoff''s current law follows conservation of—', 'sha256'), 'hex')
    limit 1;

  if v_q is null then
    insert into public.questions (
      course_id, subject_id, topic_id, statement, option_a, option_b, option_c, option_d,
      correct_option, explanation, difficulty, source, source_type, year, status, is_verified,
      fingerprint, import_batch_id, created_by
    )
    select v_course, su.id, t.id, 'Kirchhoff''s current law follows conservation of—', 'charge', 'energy', 'momentum', 'power factor',
           0, 'The algebraic sum of currents at a node is zero because charge is conserved.', 'medium', 'JobHub editorial — EEE', 'manual', null,
           'pending_review', false,
           encode(digest('Kirchhoff''s current law follows conservation of—', 'sha256'), 'hex'), v_batch, v_admin
    from public.subjects su
    join public.topics t on t.subject_id = su.id
    where su.course_id = v_course and su.slug = 'circuit' and t.sort_order = 1;
  end if;

  select c.id into v_course from public.courses c where c.slug = 'eee';
  v_q := null;
  select qq.id into v_q
    from public.questions qq
    join public.subjects su on su.id = qq.subject_id
    join public.topics t on t.id = qq.topic_id
    where qq.course_id = v_course and su.slug = 'circuit'
      and qq.fingerprint = encode(digest('At series RLC resonance the impedance is—', 'sha256'), 'hex')
    limit 1;

  if v_q is null then
    insert into public.questions (
      course_id, subject_id, topic_id, statement, option_a, option_b, option_c, option_d,
      correct_option, explanation, difficulty, source, source_type, year, status, is_verified,
      fingerprint, import_batch_id, created_by
    )
    select v_course, su.id, t.id, 'At series RLC resonance the impedance is—', 'zero always', 'purely resistive', 'purely capacitive', 'infinite always',
           1, 'XL = XC, so net reactance is zero and impedance equals R.', 'hard', 'JobHub editorial — EEE', 'manual', null,
           'pending_review', false,
           encode(digest('At series RLC resonance the impedance is—', 'sha256'), 'hex'), v_batch, v_admin
    from public.subjects su
    join public.topics t on t.subject_id = su.id
    where su.course_id = v_course and su.slug = 'circuit' and t.sort_order = 1;
  end if;

  select c.id into v_course from public.courses c where c.slug = 'eee';
  v_q := null;
  select qq.id into v_q
    from public.questions qq
    join public.subjects su on su.id = qq.subject_id
    join public.topics t on t.id = qq.topic_id
    where qq.course_id = v_course and su.slug = 'machines'
      and qq.fingerprint = encode(digest('A transformer works on the principle of—', 'sha256'), 'hex')
    limit 1;

  if v_q is null then
    insert into public.questions (
      course_id, subject_id, topic_id, statement, option_a, option_b, option_c, option_d,
      correct_option, explanation, difficulty, source, source_type, year, status, is_verified,
      fingerprint, import_batch_id, created_by
    )
    select v_course, su.id, t.id, 'A transformer works on the principle of—', 'self induction', 'mutual induction', 'electrolysis', 'thermoelectric effect',
           1, 'A transformer transfers energy through mutual induction.', 'easy', 'JobHub editorial — EEE', 'manual', null,
           'pending_review', false,
           encode(digest('A transformer works on the principle of—', 'sha256'), 'hex'), v_batch, v_admin
    from public.subjects su
    join public.topics t on t.subject_id = su.id
    where su.course_id = v_course and su.slug = 'machines' and t.sort_order = 1;
  end if;

  select c.id into v_course from public.courses c where c.slug = 'eee';
  v_q := null;
  select qq.id into v_q
    from public.questions qq
    join public.subjects su on su.id = qq.subject_id
    join public.topics t on t.id = qq.topic_id
    where qq.course_id = v_course and su.slug = 'power'
      and qq.fingerprint = encode(digest('The unit of apparent power is—', 'sha256'), 'hex')
    limit 1;

  if v_q is null then
    insert into public.questions (
      course_id, subject_id, topic_id, statement, option_a, option_b, option_c, option_d,
      correct_option, explanation, difficulty, source, source_type, year, status, is_verified,
      fingerprint, import_batch_id, created_by
    )
    select v_course, su.id, t.id, 'The unit of apparent power is—', 'watt', 'volt-ampere', 'var', 'joule',
           1, 'Apparent power S is measured in volt-amperes (VA).', 'medium', 'JobHub editorial — EEE', 'manual', null,
           'pending_review', false,
           encode(digest('The unit of apparent power is—', 'sha256'), 'hex'), v_batch, v_admin
    from public.subjects su
    join public.topics t on t.subject_id = su.id
    where su.course_id = v_course and su.slug = 'power' and t.sort_order = 1;
  end if;

  update public.import_batches b set
    created_rows = (select count(*) from public.questions q where q.import_batch_id = b.id),
    total_rows = 48
  where b.id = v_batch;
end;
$$;

-- Seed integrity: every seeded question is unverified and awaiting review.
do $$
begin
  if exists (select 1 from public.questions where source_type = 'manual' and is_verified) then
    raise warning 'Some manual questions are already verified (pre-existing data).';
  end if;
  if exists (select 1 from public.exam_schedules where status = 'published') then
    raise warning 'Published exams already exist (pre-existing data).';
  end if;
end;
$$;
