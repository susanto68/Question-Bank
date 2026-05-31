import { NextResponse } from 'next/server';
import supabaseAdmin from '@/lib/supabase/admin';

// Smart grading logic helper for server-side evaluation of all 10 sections
function checkIsCorrect(q: any, studentAnswer: string): boolean {
  const studentAns = (studentAnswer || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const correctAns = (q.answer || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');

  if (q.type === 'MCQ' || q.type === 'True/False' || q.type === 'Assertion Reason') {
    // 1. Direct match
    if (studentAns === correctAns) {
      return true;
    }

    // 2. Letter-to-Text match
    if (q.options && q.options.length > 0) {
      const correctOptionIdx = q.options.findIndex(
        (opt: string) => opt.trim().toLowerCase().replace(/[^a-z0-9]/g, '') === correctAns
      );

      if (correctOptionIdx !== -1) {
        const correctLetter = String.fromCharCode(97 + correctOptionIdx); // 'a', 'b', 'c', 'd'
        if (studentAns === correctLetter) {
          return true;
        }
      }

      // 3. Text-to-Letter match
      const selectedOptionIdx = studentAns.charCodeAt(0) - 97;
      if (
        selectedOptionIdx >= 0 && 
        selectedOptionIdx < q.options.length && 
        q.options[selectedOptionIdx].trim().toLowerCase().replace(/[^a-z0-9]/g, '') === correctAns
      ) {
        return true;
      }
    }

    return false;
  } else if (q.type === 'Fill in the Blanks' || q.type === 'One Word' || q.type === 'Full Forms') {
    // Exact alphanumeric comparison
    return studentAns === correctAns;
  } else {
    // Free text questions require minimal input length
    return studentAns.length > 3;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { studentId, board, className, subject, score, durationSeconds, questions, answers } = body;

    if (!studentId || !board || !className || !subject || !questions) {
      return NextResponse.json({ error: 'Missing required parameters to save test results.' }, { status: 400 });
    }

    const totalQuestions = questions.length;
    const percentage = totalQuestions > 0 ? (score / totalQuestions) * 100 : 0;

    let correctCount = 0;
    let wrongCount = 0;
    const correctConcepts = new Set<string>();
    const wrongConcepts = new Set<string>();

    questions.forEach((q: any, idx: number) => {
      const isCorrect = checkIsCorrect(q, answers[idx] || '');
      if (isCorrect) {
        correctCount++;
        if (q.concept_tag) correctConcepts.add(q.concept_tag);
      } else {
        wrongCount++;
        if (q.concept_tag) wrongConcepts.add(q.concept_tag);
      }
    });

    const strongTopicsArray = Array.from(correctConcepts);
    const weakTopicsArray = Array.from(wrongConcepts).filter(c => !correctConcepts.has(c));

    // 1. Save Test Attempt securely with updated analytical fields
    const { data: testData, error: testError } = await supabaseAdmin
      .from('mock_tests')
      .insert({
        student_id: studentId,
        board: board,
        class_name: className,
        subject: subject,
        score: score,
        total_questions: totalQuestions,
        duration_seconds: durationSeconds,
        percentage: percentage,
        questions_attempted: totalQuestions,
        correct_answers: correctCount,
        wrong_answers: wrongCount,
        strong_topics: strongTopicsArray,
        weak_topics: weakTopicsArray
      })
      .select('*')
      .single();

    if (testError) {
      console.error('Database error saving mock test attempt:', testError);
      throw new Error(testError.message);
    }

    // 2. Save Answers with Smart Grading check
    const answersToInsert = questions.map((q: any, idx: number) => ({
      test_id: testData.id,
      question_id: q.id,
      student_answer: answers[idx] || '',
      is_correct: checkIsCorrect(q, answers[idx] || ''),
    }));

    const { error: answersError } = await supabaseAdmin
      .from('mock_questions')
      .insert(answersToInsert);

    if (answersError) {
      console.error('Database error saving mock test answers:', answersError);
    }

    let certificateId = null;

    // 3. Generate Certificate if percentage score >= 80%
    if (percentage >= 80) {
      const certUniqueId = `QB-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      
      const { data: certData, error: certError } = await supabaseAdmin
        .from('certificates')
        .insert({
          student_id: studentId,
          test_id: testData.id,
          board: board,
          class_name: className,
          subject: subject,
          score: score,
          percentage: percentage,
          certificate_id: certUniqueId,
        })
        .select('*')
        .single();

      if (certError) {
        console.error('Database error generating certificate:', certError);
      } else {
        certificateId = certData.id;
      }
    }

    return NextResponse.json({
      success: true,
      testId: testData.id,
      certificateId,
    });
  } catch (error: any) {
    console.error('API Error in /api/mock-test/save:', error);
    return NextResponse.json(
      { error: error.message || 'Unexpected server error while saving mock test.' },
      { status: 500 }
    );
  }
}
