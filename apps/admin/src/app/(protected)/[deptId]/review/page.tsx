import ReviewPageClient from './ReviewPageClient';

export function generateStaticParams() {
  return [{ deptId: 'placeholder' }];
}

export default function ReviewPage() {
  return <ReviewPageClient />;
}
