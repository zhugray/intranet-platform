import DocsPageClient from './DocsPageClient';

export function generateStaticParams() {
  return [{ deptId: 'placeholder' }];
}

export default function DocsPage() {
  return <DocsPageClient />;
}
