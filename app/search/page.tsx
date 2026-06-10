"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

type HistoryItem = {
  id: number;
  type: 'search' | 'place' | 'bus' | 'subway';
  title: string;
  date: string;
  address: string;
};

type KakaoPlaceItem = {
  id: string;
  place_name: string;
  address_name: string;
  road_address_name: string;
  category_group_name: string;
};

export default function SearchPlacePage() {
  const router = useRouter();
  const [keyword, setKeyword] = useState('');
  const [searchResults, setSearchResults] = useState<KakaoPlaceItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // 최근 검색 기록 하드코딩 데이터
  const [history, setHistory] = useState<HistoryItem[]>([
    { id: 1, type: 'search', title: '양꼬치', date: '05.29.', address: '서울 성동구 성수동2가' },
    { id: 2, type: 'search', title: '이가네양꼬치 미금', date: '05.29.', address: '경기 성남시 분당구 돌마로 47' },
    { id: 3, type: 'place', title: '티max소프트타워', date: '05.29.', address: '경기 성남시 분당구 황새울로258번길 29' },
  ]);

  const handleDelete = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setHistory(history.filter(item => item.id !== id));
  };

  const handleSelectPlace = (title: string, address: string) => {
    const params = new URLSearchParams();
    params.set('name', title);
    params.set('address', address);
    router.push(`/write?${params.toString()}`);
  };

  // [핵심 해결 포인트] 카카오 라이브러리 존재 여부를 단계별로 안전하게 체크합니다.
  const fetchKakaoPlaces = (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const { kakao } = window as any;
    
    // 1단계: window.kakao가 아예 없거나 maps가 로드되지 않았다면 즉시 차단(리턴)해서 에러 방지
    if (!kakao || !kakao.maps) {
      console.log("카카오 맵 베이스 라이브러리가 로딩 중입니다...");
      return;
    }

    // 카카오 SDK를 메모리에 안전하게 load한 후 내부 콜백 실행
    kakao.maps.load(() => {
      // 2단계: maps.services가 존재하는지 최종 확인 (에러 스크린샷 원인 원천 차단)
      if (!kakao.maps.services) {
        console.warn("카카오 서비스 라이브러리가 아직 준비되지 않았습니다.");
        return;
      }

      const ps = new kakao.maps.services.Places();
      
      ps.keywordSearch(query, (data: any, status: any) => {
        if (status === kakao.maps.services.Status.OK) {
          setSearchResults(data);
          setIsSearching(true);
        } else if (status === kakao.maps.services.Status.ZERO_RESULT) {
          setSearchResults([]);
          setIsSearching(true);
        }
      });
    });
  };

  // 디바운스(Debounce) 로직: 타이핑이 0.2초간 멈추면 검색 실행
  useEffect(() => {
    if (!keyword.trim()) {
      setIsSearching(false);
      setSearchResults([]);
      return;
    }

    const delayDebounceTimer = setTimeout(() => {
      fetchKakaoPlaces(keyword);
    }, 200);

    return () => clearTimeout(delayDebounceTimer);
  }, [keyword]);

  const renderIcon = (type: string) => {
    switch (type) {
      case 'place':
        return (
          <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center text-base shadow-sm shrink-0">
            📍
          </div>
        );
      case 'subway':
        return (
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-[11px] font-bold shadow-sm shrink-0">
            지하철
          </div>
        );
      default:
        return (
          <div className="w-10 h-10 rounded-xl bg-stone-100 text-stone-400 flex items-center justify-center text-base shadow-sm shrink-0">
            🔍
          </div>
        );
    }
  };

  return (
    <main className="min-h-screen bg-stone-50 pb-12">
      {/* 상단 검색 헤더바 */}
      <div className="sticky top-0 bg-white/95 backdrop-blur-md pb-5 z-20 rounded-b-[24px] shadow-sm">
        <div className="pt-14 px-4 flex items-center gap-3">
          <button 
            onClick={() => router.back()} 
            className="p-2 hover:bg-stone-50 rounded-xl transition text-stone-500"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>

          {/* 검색창 인풋 */}
          <div className="flex-1 flex items-center bg-stone-50 border border-stone-200/60 rounded-2xl px-4 py-3 focus-within:ring-2 focus-within:ring-orange-100 focus-within:bg-white focus-within:border-orange-200 transition-all">
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="장소 이름, 주소 검색"
              autoFocus
              className="w-full bg-transparent outline-none text-[15px] text-stone-800 placeholder-stone-400 font-medium"
            />
            {keyword && (
              <button 
                onClick={() => setKeyword('')} 
                className="p-0.5 text-stone-400 hover:text-stone-600 mr-1.5 text-xs bg-stone-200 rounded-full w-4 h-4 flex items-center justify-center shrink-0"
              >
                ✕
              </button>
            )}
            <button className="text-stone-400 hover:text-orange-500 ml-1 text-sm font-semibold shrink-0">
              🎙️
            </button>
          </div>
        </div>
      </div>

      {/* 리스트 본문 컨테이너 */}
      <div className="mx-6 mt-6 bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden divide-y divide-stone-50">
        <div className="px-5 py-4 bg-white border-b border-stone-50 flex items-center">
          <span className="text-xs font-bold text-stone-400 tracking-tight">
            {isSearching ? `🔍 실시간 검색 결과` : "⏳ 최근 검색 목록"}
          </span>
        </div>

        {/* 1. 실시간 검색 결과 매칭 */}
        {isSearching && searchResults.length > 0 && (
          searchResults.map((item) => (
            <div
              key={item.id}
              onClick={() => handleSelectPlace(item.place_name, item.road_address_name || item.address_name)}
              className="flex items-center justify-between px-5 py-4 hover:bg-orange-50/20 active:bg-orange-50/40 transition cursor-pointer bg-white"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                {renderIcon('place')}
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-[15px] text-stone-800 tracking-tight truncate">{item.place_name}</span>
                    {item.category_group_name && (
                      <span className="text-[9px] font-semibold text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded shrink-0">{item.category_group_name}</span>
                    )}
                  </div>
                  <span className="text-xs text-stone-400 font-medium truncate mt-0.5">{item.road_address_name || item.address_name}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-2">
                <span className="text-[11px] font-bold text-orange-500 bg-orange-50 px-2 py-1 rounded-lg">선택</span>
              </div>
            </div>
          ))
        )}

        {/* 2. 검색 결과가 없을 때 */}
        {isSearching && searchResults.length === 0 && (
          <div className="text-center py-14 text-stone-300 text-sm font-medium bg-white leading-relaxed">
            일치하는 장소 정보가 없습니다.<br/>
            <span className="text-xs text-stone-400">오타가 없는지 다시 확인해 보세요!</span>
          </div>
        )}

        {/* 3. 디폴트 스탠바이: 최근 검색 기록 */}
        {!isSearching && (
          history.length === 0 ? (
            <div className="text-center py-14 text-stone-300 text-sm font-medium bg-white">
              최근 검색 기록이 없습니다.
            </div>
          ) : (
            history.map((item) => (
              <div
                key={item.id}
                onClick={() => handleSelectPlace(item.title, item.address)}
                className="flex items-center justify-between px-5 py-4 hover:bg-stone-50/60 transition cursor-pointer bg-white"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  {renderIcon(item.type)}
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-[15px] text-stone-800 tracking-tight truncate">{item.title}</span>
                    <span className="text-xs text-stone-400 font-medium truncate mt-0.5">{item.address}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                  <span className="text-[11px] font-medium text-stone-400/70 tracking-tighter">{item.date}</span>
                  <button
                    onClick={(e) => handleDelete(item.id, e)}
                    className="p-1.5 text-stone-300 hover:text-stone-500 hover:bg-stone-100 rounded-lg transition"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ))
          )
        )}
      </div>
    </main>
  );
}