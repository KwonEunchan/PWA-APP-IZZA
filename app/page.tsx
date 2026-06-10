"use client";

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Image from 'next/image';

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    if (localStorage.getItem('isLoggedIn') === 'true') {
      router.push('/main');
    }
  }, [router]);

  const handleLogin = (user: 'me' | 'minji') => {
    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem('currentUser', user);
    router.push('/main');
  };

  return (
    <main className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-6 text-center">
      {/* 1. 로고 영역 */}
      <div className="flex flex-col items-center mb-12 w-full max-w-sm animate-in fade-in duration-1000">
        <div className="relative w-full aspect-square mb-2">
          <Image 
            src="/logo.png" 
            alt="이짜! 로고" 
            fill
            sizes="(max-width: 768px) 100vw, 400px"
            className="object-contain"
            priority
          />
        </div>
        <h2 className="text-2xl font-bold text-stone-700 animate-pulse">
          우리들의 소중한 오늘을 이짜!
        </h2>
        <p className="text-stone-400 mt-2">데이트부터 여행까지, 둘만의 기록장</p>
      </div>

      {/* 2. 간편 입장 버튼 */}
      <div className="w-full max-w-sm space-y-4">
        
        {/* 은찬이 입장 버튼 - p-4로 높이 축소 */}
        <button 
          onClick={() => handleLogin('me')}
          className="w-full p-4 bg-white rounded-3xl shadow-sm border border-stone-200 flex items-center justify-between hover:bg-stone-50 transition active:scale-95 duration-200"
        >
          <span className="text-lg font-bold ml-2">은찬이 입장</span>
          <div className="relative w-12 h-12 rounded-full border border-stone-100 bg-stone-100 overflow-hidden flex items-center justify-center">
            <Image 
              src="/retriever.png" 
              alt="은찬이 아이콘" 
              width={32}
              height={32}
              className="object-contain"
            />
          </div>
        </button>

        {/* 민지 입장 버튼 - p-4로 높이 축소 */}
        <button 
          onClick={() => handleLogin('minji')}
          className="w-full p-4 bg-white rounded-3xl shadow-sm border border-stone-200 flex items-center justify-between hover:bg-stone-50 transition active:scale-95 duration-200"
        >
          <span className="text-lg font-bold ml-2">민지 입장</span>
          <div className="relative w-12 h-12 rounded-full border border-pink-100 bg-pink-50 overflow-hidden flex items-center justify-center">
            <Image 
              src="/maltese.png" 
              alt="민지 아이콘" 
              width={32}
              height={32}
              className="object-contain"
            />
          </div>
        </button>
      </div>
    </main>
  );
}