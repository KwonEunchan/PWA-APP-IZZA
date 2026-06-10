"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function MyPage() {
  const router = useRouter();
  const [username, setUsername] = useState<string>("");
  
  // AI 추천 문구 상태 관리 (로딩 스켈레톤 포함)
  const [aiRecommendation, setAiRecommendation] = useState<string>("");
  const [isAiLoading, setIsAiLoading] = useState<boolean>(true);

  const menuItems = [
    { title: "데이트 코스 관리", path: "/archive?tab=all" },
    { title: "과거 데이트 기록", path: "/memory" }
  ];

  const upcomingDate = {
    title: "성수동 서울숲 산책",
    date: "2026.06.15",
    dday: "D-5",
    weather: {
      condition: "비",
      temp: "22°C",
      pop: "80%"
    }
  };

  // 유저 데이터 로드 및 Gemini AI API 호출
  useEffect(() => {
    const user = localStorage.getItem('currentUser');
    const computedName = user === 'me' ? '은찬' : '민지';
    setUsername(computedName);

    // 실제 백엔드 라우터로 Gemini 추천 요청 전송
    const fetchAIRecommendation = async () => {
      try {
        setIsAiLoading(true);
        const res = await fetch('/api/date-recommend', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: computedName,
            weather: upcomingDate.weather
          })
        });
        const data = await res.json();
        setAiRecommendation(data.recommendation);
      } catch (err) {
        console.error(err);
      } finally {
        setIsAiLoading(false);
      }
    };

    fetchAIRecommendation();
  }, []);

  const handleLogout = () => {
    localStorage.clear();
    router.push('/');
  };

  return (
    <main className="min-h-screen bg-stone-50 pb-32">
      {/* 프로필 영역 */}
      <section className="px-6 pt-14 pb-6 bg-white flex items-center justify-between rounded-b-[24px] shadow-sm">
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl shadow-sm ${username === '은찬' ? 'bg-blue-50' : 'bg-pink-50'}`}>
            {username === '은찬' ? '🐶' : '🐱'}
          </div>
          <div>
            <h2 className="font-bold text-lg text-stone-800">{username}님</h2>
            <p className="text-xs text-stone-400 font-medium">오늘도 즐거운 데이트 하세요!</p>
          </div>
        </div>
        <button 
          onClick={handleLogout} 
          className="px-3 py-1.5 text-xs font-medium border border-stone-200 rounded-xl text-stone-500 hover:bg-stone-50 transition"
        >
          로그아웃
        </button>
      </section>

      {/* 곧 다가오는 데이트 */}
      <section className="px-6 py-4 mt-3">
        <h3 className="font-bold text-stone-800 mb-3 text-sm tracking-tight">📅 곧 다가오는 데이트</h3>
        <div className="p-4 bg-orange-50/70 backdrop-blur-sm rounded-2xl border border-orange-100 flex justify-between items-center shadow-sm">
          <div className="flex-1 min-w-0">
            <p className="font-bold text-stone-800 truncate text-[15px] mb-1">{upcomingDate.title}</p>
            <div className="flex items-center gap-2 text-xs text-stone-500">
              <span className="font-medium">{upcomingDate.date}</span>
              <span className="text-stone-300">|</span>
              <div className="flex gap-1.5">
                <span className="font-semibold text-orange-600">{upcomingDate.weather.condition} {upcomingDate.weather.temp}</span>
                {upcomingDate.weather.pop && <span className="font-semibold text-blue-500">💧 {upcomingDate.weather.pop}</span>}
              </div>
            </div>
          </div>
          <div className="bg-orange-500 text-white px-3 py-1.5 rounded-full font-bold text-xs ml-4 flex-shrink-0 shadow-sm">
            {upcomingDate.dday}
          </div>
        </div>
      </section>

      {/* 요약 섹션 */}
      <section className="mx-6 my-2 flex bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
        <div 
          onClick={() => router.push('/archive?tab=waiting')}
          className="flex-1 py-4 text-center border-r border-stone-100 hover:bg-stone-50/50 transition cursor-pointer"
        >
          <p className="font-bold text-xl text-stone-800">12건</p>
          <p className="text-[11px] font-medium text-stone-400 mt-0.5">승인 대기</p>
        </div>
        <div 
          onClick={() => router.push('/archive?tab=approved')}
          className="flex-1 py-4 text-center hover:bg-stone-50/50 transition cursor-pointer"
        >
          <p className="font-bold text-xl text-stone-800">8건</p>
          <p className="text-[11px] font-medium text-stone-400 mt-0.5">승인 완료</p>
        </div>
      </section>

      {/* [실시간 연동] AI 추천 코스 영역 */}
      <section className="px-6 py-4 mt-2">
        <h3 className="font-bold text-stone-800 mb-3 text-sm flex items-center gap-2 tracking-tight">✨ AI가 추천하는 데이트 코스</h3>
        <div className="p-5 bg-indigo-50/60 rounded-2xl border border-indigo-100 cursor-pointer hover:bg-indigo-100/50 transition shadow-sm">
          {isAiLoading ? (
            // 로딩 중일 때 깜빡이는 스켈레톤 UX 효과
            <div className="animate-pulse space-y-2">
              <div className="h-4 bg-indigo-200/60 rounded-md w-full"></div>
              <div className="h-4 bg-indigo-200/60 rounded-md w-5/6"></div>
            </div>
          ) : (
            // Gemini API가 생성해 준 실시간 문구 출력 부
            <p className="text-sm text-indigo-950 font-medium leading-relaxed">
              "{aiRecommendation}"
            </p>
          )}
          <p className="text-[11px] text-indigo-500 mt-4 font-bold tracking-tight">지금 확인하기 →</p>
        </div>
      </section>

      {/* 기록 정보 메뉴 */}
      <section className="mx-6 mt-3 bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
        <h3 className="px-5 py-4 font-bold text-stone-800 text-sm border-b border-stone-50">📋 기록 정보</h3>
        {menuItems.map((item, index) => (
          <div 
            key={index} 
            onClick={() => router.push(item.path)}
            className="px-5 py-4 flex justify-between items-center border-t border-stone-50 first:border-t-0 hover:bg-stone-50 transition cursor-pointer"
          >
            <span className="text-sm font-medium text-stone-600">{item.title}</span>
            <span className="text-stone-300 text-sm font-bold">＞</span>
          </div>
        ))}
      </section>

      {/* 신규 데이트 코스 만들기 버튼 (하단 고정) */}
      <div className="fixed bottom-24 w-full px-6 z-10 max-w-md left-1/2 -translate-x-1/2">
        <button 
          onClick={() => router.push('/course/write')}
          className="w-full py-4 bg-stone-900 text-white rounded-2xl font-bold shadow-xl hover:bg-stone-800 active:scale-[0.99] transition-all flex items-center justify-center gap-2 text-[15px]"
        >
          <span>✨</span> 신규 데이트 코스 만들기
        </button>
      </div>

      {/* 하단 내비게이션 바 */}
      <nav className="fixed bottom-0 w-full bg-white/90 backdrop-blur-md border-t border-stone-100 flex justify-around p-2 pb-5 z-20">
        <button className="flex flex-col items-center gap-0.5 text-[10px] font-medium text-stone-400">
          <span className="text-base">🏠</span>홈
        </button>
        <button className="flex flex-col items-center gap-0.5 text-[10px] font-medium text-stone-400">
          <span className="text-base">📁</span>결재함
        </button>
        <button className="flex flex-col items-center gap-0.5 text-[10px] font-medium text-stone-400">
          <span className="text-base">📝</span>작성
        </button>
        <button className="flex flex-col items-center gap-0.5 text-[10px] font-medium text-stone-400">
          <span className="text-base">💾</span>임시저장
        </button>
        <button className="flex flex-col items-center gap-0.5 text-[10px] font-bold text-stone-900">
          <span className="text-base">👤</span>마이
        </button>
      </nav>
    </main>
  );
}