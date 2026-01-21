import QuizClientView from './client-view';

export default function QuizPage({ params: { quizId } }: { params: { quizId: string } }) {
  return <QuizClientView quizId={quizId} />;
}
