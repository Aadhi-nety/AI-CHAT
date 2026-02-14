'use client';

import { getQuiz, calculateQuizResult, type Quiz, type QuizResult } from '@/lib/quiz-system';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useState } from 'react';
import { CheckCircle, XCircle } from 'lucide-react';

export function QuizViewer({ labId }: { labId: string }) {
  const quiz = getQuiz(labId);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [result, setResult] = useState<QuizResult | null>(null);

  if (!quiz) {
    return <div>Quiz not available for this lab</div>;
  }

  const handleAnswer = (optionIndex: number) => {
    const newAnswers = [...answers];
    newAnswers[currentQuestion] = optionIndex;
    setAnswers(newAnswers);
  };

  const handleNext = () => {
    if (currentQuestion < quiz.questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      submitQuiz();
    }
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  };

  const submitQuiz = () => {
    const quizResult = calculateQuizResult(quiz, answers);
    setResult(quizResult);
    setQuizCompleted(true);
  };

  const resetQuiz = () => {
    setCurrentQuestion(0);
    setAnswers([]);
    setQuizCompleted(false);
    setResult(null);
  };

  if (quizCompleted && result) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Quiz Results</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center space-y-4">
            <div className={`text-5xl font-bold ${result.passed ? 'text-green-500' : 'text-red-500'}`}>
              {result.percentage}%
            </div>
            <div className="text-xl font-semibold">
              {result.passed ? 'Congratulations! You passed!' : 'You did not pass this quiz.'}
            </div>
            <div className="text-muted-foreground">
              You got {result.score} out of {result.totalQuestions} questions correct
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold">Detailed Results:</h3>
            {quiz.questions.map((question, idx) => {
              const answer = result.answers[idx];
              return (
                <Card key={idx} className={answer.isCorrect ? 'border-green-500/30' : 'border-red-500/30'}>
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-2">
                      {answer.isCorrect ? (
                        <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <p className="font-semibold text-sm mb-2">{question.question}</p>
                        <p className="text-sm text-muted-foreground mb-2">{question.explanation}</p>
                        <p className="text-xs text-muted-foreground">
                          Your answer: {question.options[answer.selectedAnswer]}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Button onClick={resetQuiz} className="w-full">
            Retake Quiz
          </Button>
        </CardContent>
      </Card>
    );
  }

  const question = quiz.questions[currentQuestion];
  const selectedAnswer = answers[currentQuestion];
  const progress = ((currentQuestion + 1) / quiz.questions.length) * 100;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">{quiz.title}</h2>
        <p className="text-muted-foreground mt-2">{quiz.description}</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Question {currentQuestion + 1} of {quiz.questions.length}</CardTitle>
            <span className="text-sm text-muted-foreground">Difficulty: {question.difficulty}</span>
          </div>
          <div className="w-full bg-slate-700 h-2 rounded-full mt-4">
            <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${progress}%` }} />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <h3 className="text-lg font-semibold">{question.question}</h3>

          <div className="space-y-3">
            {question.options.map((option, idx) => (
              <Button
                key={idx}
                variant={selectedAnswer === idx ? 'default' : 'outline'}
                className="w-full justify-start text-left h-auto py-3 px-4"
                onClick={() => handleAnswer(idx)}
              >
                <span className="font-semibold mr-3">
                  {String.fromCharCode(65 + idx)}.
                </span>
                {option}
              </Button>
            ))}
          </div>

          <div className="flex gap-2 justify-between pt-4">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentQuestion === 0}
            >
              Previous
            </Button>
            <Button
              onClick={handleNext}
              disabled={selectedAnswer === undefined}
            >
              {currentQuestion === quiz.questions.length - 1 ? 'Submit' : 'Next'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
