'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import ProductForm from '@/components/ProductForm';
import LoadingScreen from '@/components/LoadingScreen';

export default function NewProductPage() {
  const router = useRouter();
  const pathname = usePathname();
  const locale = pathname.split('/')[1] || 'bg';
  const [categories, setCategories] = useState<any[]>([]);

  useEffect(() => {
    async function fetchCategories() {
      const response = await fetch('/api/categories');
      const data = await response.json();
      setCategories(data.categories || []);
    }
    fetchCategories();
  }, []);

  const handleSubmit = async (data: any) => {
    try {
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      // Check if server is offline (503 or network error)
      if (response.status === 503 || !response.ok) {
        // Trigger offline banner
        if (typeof window !== 'undefined' && (window as any).__setOfflineState) {
          (window as any).__setOfflineState(true);
        }
        if (typeof window !== 'undefined' && (window as any).__setServerDown) {
          (window as any).__setServerDown(true);
        }
        throw new Error('Server is offline');
      }

      if (response.ok) {
        router.push(`/${locale}/admin/products`);
      }
    } catch (error: any) {
      // Network error or server offline
      if (error.name === 'TypeError' || error.message === 'Server is offline') {
        // Trigger offline banner
        if (typeof window !== 'undefined' && (window as any).__setOfflineState) {
          (window as any).__setOfflineState(true);
        }
        if (typeof window !== 'undefined' && (window as any).__setServerDown) {
          (window as any).__setServerDown(true);
        }
      }
      throw error; // Re-throw to let form handle it
    }
  };

  if (categories.length === 0) {
    return <LoadingScreen locale={locale} />;
  }

  return (
    <div>
      <h1 className="malts-admin-heading-font malts-admin-page-title mb-8">Добави продукт</h1>
      
      <div className="malts-card p-8">
        <ProductForm
          categories={categories}
          onSubmit={handleSubmit}
          locale={locale}
        />
      </div>
    </div>
  );
}

