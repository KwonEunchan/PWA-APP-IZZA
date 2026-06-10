"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

type CourseItem = {
  id: number;
  title: string;
  date: string;
  status: 'waiting' | 'approved';
  location: string;
};

export default function ArchivePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // 메인에서 넘어온 탭 파라미터 확인 (기본값은 'all')
  const currentTabParam = searchParams.get('tab') || 'all';
  const [activeTab, setActiveTab] = useState<string>(currentTabParam);

  // 가상 데이터 (추후 파이어베이스 컬렉션 데이터로 치환할 영역)
  const [courses] = useState<CourseItem[]>([
    { id: 1, title: '성수동 서울숲 산책 코스', date: '2026.06.15', status: 'waiting', location: '서울 성동구' },
    { id: 2, title: '홍대 연남동 핫플 탐방', date: '2026.06.01', status: 'approved', location: '서울 마포구' },
    { id: 3, title: '강남역 이색 맛집 데이트', date: '2026.05.28', status: 'waiting', location: '서울 강남구' },
    { id: 4, title: '인천 구읍뱃터 바다 여행', date: '2026.05.14', status: 'approved', location: '인천 중구' },
  ]);

  // 주소창 파라미터가 실시간으로 변경될 때 탭 상태를 동기화
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  // 선택된 탭에 매칭되는 데이터 필터링
  const filteredCourses = courses.filter((course) => {
    if (activeTab === 'all') return true;
    return course.status === activeTab;
  });

  return (
    <main className="min-h-screen bg-stone-50 pb-12">
      {/* 상단 고정 헤더 시스템 (pt-14 패딩 가드 적용) */}
      <div className="sticky top-0 bg-white/95 backdrop-blur-md pb-3 z-20 rounded-b-[24px] shadow-sm">
        <div className="pt-14 px-4 flex items-center justify-between pb-3">
          <button 
            onClick={() => router.back()} 
            className="p-2 hover:bg-stone-50 rounded-xl transition text-stone-500"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <h1 className="text-[16px] font-bold text-stone-800 tracking-tight">데이트 코스 보관함</h1>
          <div className="w-9 h-9"></div> 
        </div>

        {/* 탭 네비게이션 컨트롤러 */}
        <div className="flex px-6 pt-1 gap-2">
          <button
            onClick={() => setActiveTab('all')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'all' 
                ? 'bg-stone-900 text-white shadow-sm' 
                : 'bg-stone-50 text-stone-400 border border-stone-100 hover:bg-stone-100'
            }`}
          >
            전체 코스
          </button>
          <button
            onClick={() => setActiveTab('waiting')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'waiting' 
                ? 'bg-orange-500 text-white shadow-sm' 
                : 'bg-stone-50 text-stone-400 border border-stone-100 hover:bg-stone-100'
            }`}
          >
            승인 대기
          </button>
          <button
            onClick={() => setActiveTab('approved')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'approved' 
                ? 'bg-emerald-600 text-white shadow-sm' 
                : 'bg-stone-50 text-stone-400 border border-stone-100 hover:bg-stone-100'
            }`}
          >
            승인 완료
          </button>
        </div>
      </div>

      {/* 코스 목록 카드 리스트 */}
      <div className="mx-6 mt-6 flex flex-col gap-4">
        {filteredCourses.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-stone-100 shadow-sm text-stone-300 text-xs font-medium">
            비어있습니다. 새로운 코스를 작성해보세요!
          </div>
        ) : (
          filteredCourses.map((course) => (
            <div 
              key={course.id}
              className="bg-white border border-stone-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div className="flex justify-between items-start gap-3">
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-semibold text-stone-400 tracking-tight bg-stone-50 px-2 py-0.5 rounded-md">
                    📍 {course.location}
                  </span>
                  <h3 className="font-bold text-[15px] text-stone-800 tracking-tight mt-2 truncate">
                    {course.title}
                  </h3>
                </div>

                {course.status === 'waiting' ? (
                  <span className="text-[10px] font-bold bg-orange-50 text-orange-500 px-2 py-1 rounded-lg shrink-0">
                    승인 대기
                  </span>
                ) : (
                  <span className="text-[10px] font-bold bg-emerald-50 text-emerald-600 px-2 py-1 rounded-lg shrink-0">
                    승인 완료
                  </span>
                )}
              </div>

              <div className="border-t border-stone-50 mt-4 pt-3 flex justify-between items-center">
                <span className="text-[11px] font-medium text-stone-400">{course.date}</span>
                <button 
                  className="text-xs font-bold text-stone-500 hover:text-stone-800 bg-stone-50 hover:bg-stone-100 px-3 py-1.5 rounded-xl border border-stone-100 transition"
                >
                  상세 보기 →
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}