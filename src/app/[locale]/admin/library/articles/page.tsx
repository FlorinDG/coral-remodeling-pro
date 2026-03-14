"use client";

import dynamic from 'next/dynamic';

const DatabaseCloneDynamic = dynamic(
    () => import('@/components/admin/database/DatabaseClone'),
    { ssr: false, loading: () => <div className="flex h-[calc(100vh-8rem)] items-center justify-center text-neutral-500">Preparing Library...</div> }
);

export default function ArticlesPage() {
    return (
        <div className="w-full h-full pb-10">
            <div className="mb-4">
                <h1 className="text-2xl font-bold">Articles Library</h1>
                <p className="text-sm text-neutral-500">Manage knowledge base articles, blog posts, and thought leadership content.</p>
            </div>
            <DatabaseCloneDynamic databaseId="db-articles" />
        </div>
    );
}
