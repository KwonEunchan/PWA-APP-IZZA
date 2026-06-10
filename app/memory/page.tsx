"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

type PastDateItem = {
  id: number;
  title: string;
  date: string; // YYYY.MM.DD 형식
  location: string;
  emoji: string;
  isSpecial: boolean;
  memoryNote: string;
};

// 퀵 필터 타입 선언
type FilterType = 'all' | 'week' | 'month' | 'year' | 'custom';

export default function MemoryPage() {
  const router = useRouter();
  
  // 상단 대메뉴 탭 ('past' = 지난 데이트 기록, 'special' = 특별한 기억)
  const [activeMenu, setActiveMenu] = useState<'past' | 'special'>('past');

  // 기간 필터 상태 관리
  const [dateFilter, setDateFilter] = useState<FilterType>('all');
  
  // 직접 입력 날짜 상태 관리 (기본값은 빈 문자열)
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // 전체 데이터셋 (2026년 현재 시점 기준 가상 데이터 추가)
  const [memories] = useState<PastDateItem[]>([
    { 
      id: 1, 
      title: '우리의 1주년 기념 한강 선셋', 
      date: '2026.06.05', // 최근 일주일 이내 (오늘: 2026.06.10)
      location: '서울 여의도 한강공원', 
      emoji: '🍾', 
      isSpecial: true,
      memoryNote: '서로 손편지 교환하고 와인 마셨던 날 잊지 못해 🥂'
    },
    { 
      id: 2, 
      title: '성수동 서울숲 숨은 맛집 데이트', 
      date: '2026.05.20', // 최근 한 달 이내
      location: '서울 성동구 성수동', 
      emoji: '🍕', 
      isSpecial: false,
      memoryNote: '웨이팅 길었지만 파스타가 진짜 역대급이었다!'
    },
    { 
      id: 3, 
      title: '처음으로 같이 맞은 비 오는 날 삼청동', 
      date: '2026.04.18', 
      location: '서울 종로구 삼청동', 
      emoji: '☔', 
      isSpecial: true,
      memoryNote: '갑자기 내린 소나기에 우산 하나 쓰고 밀착 걷기 🤭'
    },
    { 
      id: 4, 
      title: '인천 앞바다 조개구이 먹방 여행', 
      date: '2025.11.14', // 최근 일 년 이내
      location: '인천 중구 을왕리', 
      emoji: '🐚', 
      isSpecial: false,
      memoryNote: '치즈 조개구이 배 터지게 먹고 바다 불꽃놀이 구경'
    }
  ]);

  // [핵심 로직] 기간 필터링 및 메뉴 필터링 함수
  const getFilteredMemories = () => {
    // 1. 대메뉴 필터링 ('특별한 기억' 선택 시 기간 필터 무시하고 특별한 것만 노출)
    if (activeMenu === 'special') {
      return memories.filter(item => item.isSpecial);
    }

    // 2. '지난 데이트 기록'일 때 기간 필터링 적용
    const today = new Date('2026-06-10'); // 현재 기준 타임라인 고정

    return memories.filter((item) => {
      // 데이터의 '2026.06.10' 형식을 '2026-06-10'으로 변환하여 Date 객체 생성
      const itemDate = new Date(item.date.replace(/\./g, '-'));

      if (dateFilter === 'all') return true;

      if (dateFilter === 'week') {
        const oneWeekAgo = new Date(today);
        oneWeekAgo.setDate(today.getDate() - 7);
        return itemDate >= oneWeekAgo && itemDate <= today;
      }

      if (dateFilter === 'month') {
        const oneMonthAgo = new Date(today);
        oneMonthAgo.setMonth(today.getMonth() - 1);
        return itemDate >= oneMonthAgo && itemDate <= today;
      }

      if (dateFilter === 'year') {
        const oneYearAgo = new Date(today);
        oneYearAgo.setFullYear(today.getFullYear() - 1);
        return itemDate >= oneYearAgo && itemDate <= today;
      }

      if (dateFilter === 'custom') {
        if (!startDate || !endDate) return true; // 날짜가 입력되지 않았을 땐 전체 노출
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59); // 종료일 당일 전체 포함
        return itemDate >= start && itemDate <= end;
      }

      return true;
    });
  };

  const filteredMemories = getFilteredMemories();

  return (
    <main className="min-h-screen bg-stone-50 pb-16">
      {/* 상단 고정 헤더 바 (메뉴 탭 포함) */}
      <div className="sticky top-0 bg-white/95 backdrop-blur-md pb-2 z-20 rounded-b-[24px] shadow-sm">
        <div className="pt-14 px-4 flex items-center justify-between pb-2">
          <button 
            onClick={() => router.back()} 
            className="p-2 hover:bg-stone-50 rounded-xl transition text-stone-500"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <h1 className="text-[16px] font-bold text-stone-800 tracking-tight">우리의 추억함</h1>
          <div className="w-9 h-9 flex items-center justify-center text-lg">📸</div> 
        </div>

        {/* 상단 2단 메뉴 탭 */}
        <div className="flex px-6 pt-2 pb-1 gap-2">
          <button
            onClick={() => setActiveMenu('past')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
              activeMenu === 'past' 
                ? 'bg-stone-900 text-white shadow-sm' 
                : 'bg-stone-50 text-stone-400 border border-stone-100/70 hover:bg-stone-100'
            }`}
          >
            🎞️ 지난 데이트 기록
          </button>
          <button
            onClick={() => setActiveMenu('special')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
              activeMenu === 'special' 
                ? 'bg-rose-500 text-white shadow-sm' 
                : 'bg-stone-50 text-stone-400 border border-stone-100/70 hover:bg-stone-100'
            }`}
          >
            💝 특별한 기억
          </button>
        </div>
      </div>

      {/* [신규 기능] 지난 데이트 기록 메뉴가 활성화되었을 때만 기간 필터 UI 노출 */}
      {activeMenu === 'past' && (
        <section className="mx-6 mt-4 p-4 bg-white border border-stone-100 rounded-2xl shadow-sm">
          <span className="text-[11px] font-bold text-stone-400 block mb-2.5">📅 기간별 조회</span>
          
          {/* 퀵 탭 버튼들 */}
          <div className="grid grid-cols-5 gap-1.5">
            {[
              { id: 'all', label: '전체' },
              { id: 'week', label: '1주일' },
              { id: 'month', label: '1개월' },
              { id: 'year', label: '1년' },
              { id: 'custom', label: '직접입력' }
            ].map((btn) => (
              <button
                key={btn.id}
                onClick={() => setDateFilter(btn.id as FilterType)}
                className={`py-1.5 text-[11px] font-bold rounded-lg transition-all border ${
                  dateFilter === btn.id
                    ? 'bg-orange-500 text-white border-orange-500 shadow-xs'
                    : 'bg-stone-50 text-stone-500 border-stone-100 hover:bg-stone-100'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>

          {/* 직접 입력 선택 시 노출되는 이쁜 날짜 피커 인풋창 */}
          {dateFilter === 'custom' && (
            <div className="mt-3 pt-3 border-t border-stone-50 flex items-center gap-2 animate-fadeIn">
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="flex-1 p-2 bg-stone-50 border border-stone-100 rounded-xl text-xs font-semibold text-stone-700 outline-none focus:border-orange-300 focus:bg-white transition"
              />
              <span className="text-stone-300 text-xs font-bold">~</span>
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="flex-1 p-2 bg-stone-50 border border-stone-100 rounded-xl text-xs font-semibold text-stone-700 outline-none focus:border-orange-300 focus:bg-white transition"
              />
            </div>
          )}
        </section>
      )}

      {/* 추억 피드 리스트 출력 섹션 */}
      <section className="mx-6 mt-4">
        {filteredMemories.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-stone-100 shadow-sm text-stone-300 text-xs font-medium leading-relaxed">
            선택한 기간 내에<br/>다녀온 데이트 추억이 없습니다.
          </div>
        ) : (
          <div className="space-y-4">
            {filteredMemories.map((item) => (
              <div 
                key={item.id}
                className={`border rounded-2xl p-5 shadow-sm transition-all bg-white flex flex-col justify-between ${
                  item.isSpecial && activeMenu === 'special'
                    ? 'border-rose-100 bg-gradient-to-tr from-rose-50/30 to-white' 
                    : 'border-stone-100'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl shadow-sm shrink-0 border ${
                    item.isSpecial && activeMenu === 'special' ? 'bg-rose-50 border-rose-100 text-rose-500' : 'bg-stone-50 border-stone-100'
                  }`}>
                    {item.emoji}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-2">
                      <h3 className="font-bold text-[15px] text-stone-800 tracking-tight truncate">
                        {item.title}
                      </h3>
                      <span className="text-[10px] font-medium text-stone-400 shrink-0 mt-0.5">
                        {item.date}
                      </span>
                    </div>
                    <p className="text-xs text-stone-400 font-medium truncate mt-0.5">
                      📍 {item.location}
                    </p>
                  </div>
                </div>

                {item.memoryNote && (
                  <div className={`mt-4 p-3 rounded-xl text-[11px] font-medium leading-relaxed ${
                    item.isSpecial && activeMenu === 'special'
                      ? 'bg-white/80 text-rose-900/90 border border-rose-100/40 italic'
                      : 'bg-stone-50/80 text-stone-500'
                  }`}>
                    "{item.memoryNote}"
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}