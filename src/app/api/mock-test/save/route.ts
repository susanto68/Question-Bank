import { NextResponse } from 'next/server';
import supabaseAdmin from '@/lib/supabase/admin';

// Smart grading logic helper for server-side evaluation
function checkIsCorrect(q: any, studentAnswer: string): boolean {
  const studentAns = (studentAnswer || '').trim().toLowerCase();
  const correctAns = (q.answer || '').trim().toLowerCase();

  if (q.type === 'MCQ' || q.type === 'True/False' || q.type === 'Assertion Reason') {
    // 1. Direct match (e.g., both are "a" or both are "true")
    if (studentAns === correctAns) {
      return true;
    }

    // 2. Letter-to-Text match (e.g., student chose "a" and correctAns is the text of option A)
    if (q.options && q.options.length > 0) {
      const correctOptionIdx = q.options.findIndex(
        (opt: string) => opt.trim().toLowerCase() === correctAns
      );

      if (correctOptionIdx !== -1) {
        const correctLetter = String.fromCharCode(97 + correctOptionIdx); // 'a', 'b', 'c', 'd'
        if (studentAns === correctLetter) {
          return true;
        }
      }

      // 3. Text-to-Letter match (just in case)
      const selectedOptionIdx = studentAns.charCodeAt(0) - 97; // e.g., 'a' -> 0
      if (
        selectedOptionIdx >= 0 && 
        selectedOptionIdx < q.options.length && 
        q.options[selectedOptionIdx].trim().toLowerCase() === correctAns
      ) {
        return true;
      }
    }

    return false;
  } else {
    // Free text questions require minimal input length
    return studentAns.length > 2;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { studentId, board, className, subject, score, durationSeconds, questions, answers } = body;

    if (!studentId || !board || !className || !subject) {
      return NextResponse.json({ error: 'Missing required parameters to save test results.' }, { status: 400 });
    }

    const percentage = (score / 5) * 100;

    // 1. Save Test Attempt securely
    const { data: testData, error: testError } = await supabaseAdmin
      .from('mock_tests')
      .insert({
        student_id: studentId,
        board: board,
        class_name: className,
        subject: subject,
        score: score,
        total_questions: 5,
        duration_seconds: durationSeconds,
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

    // 3. Generate Certificate if Score >= 4 (80% for 5 questions)
    if (score >= 4) {
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
