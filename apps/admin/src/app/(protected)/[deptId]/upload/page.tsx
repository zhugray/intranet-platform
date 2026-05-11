import UploadPageClient from './UploadPageClient';

export function generateStaticParams() {
  return [{ deptId: 'placeholder' }];
}

export default function UploadPage() {
  return <UploadPageClient />;
}
