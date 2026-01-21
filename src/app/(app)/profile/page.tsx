'use client';
import { useSearchParams } from 'next/navigation';
import ProfileClientView from './client-view';
import { Suspense } from 'react';

function ProfilePageContent() {
  const searchParams = useSearchParams();
  const userId = searchParams.get('id');

  return <ProfileClientView userId={userId} />;
}


export default function ProfilePage() {
    return (
        <Suspense fallback={<div className="flex h-full w-full items-center justify-center">Loading Profile...</div>}>
            <ProfilePageContent />
        </Suspense>
    )
}
