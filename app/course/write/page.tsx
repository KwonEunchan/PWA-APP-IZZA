"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

type Note = { id: number; text: string };
type Place = { id: number; name: string; address: string; category: string; notes: Note[] };

export default function WriteCoursePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [places, setPlaces] = useState<Place[]>([]);

  // 검색 페이지에서 돌아왔을 때 데이터 파싱 로직 유지
  useEffect(() => {
    const name = searchParams.get('name');
    const address = searchParams.get('address');

    if (name && address) {
      const newPlace: Place = {
        id: Date.now(),
        name: name,
        address: address,
        category: "",
        notes: [{ id: Date.now(), text: "" }]
      };
      setPlaces((prev) => [...prev, newPlace]);
      
      // 주소창 파라미터 깔끔하게 청소
      router.replace('/write');
    }
  }, [searchParams, router]);

  const updatePlaceField = (id: number, field: 'category', value: string) => {
    setPlaces(places.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const updateNote = (placeId: number, noteId: number, value: string) => {
    setPlaces(places.map(p => p.id === placeId ? {
      ...p, notes: p.notes.map(n => n.id === noteId ? { ...n, text: value } : n)
    } : p));
  };

  const addNote = (placeId: number) => {
    setPlaces(places.map(p => p.id === placeId ? {
      ...p, notes: [...p.notes, { id: Date.now(), text: "" }]
    } : p));
  };

  // 장소 카드 삭제 기능 (리스트 관리 효율성을 위해 추가)
  const removePlace = (id: number) => {
    setPlaces(places.filter(p => p.id !== id));
  };

  return (
    <main className="min-h-screen bg-stone-50 pb-32">
      {/* [상단 개선 포인트] 
        마이페이지와 감성을 맞춘 시원한 상단 패딩(pt-14) 헤더바.
        고정형(sticky)으로 고정하되, 라운드 처리를 주어 스크롤 시 부드러운 공간감을 줍니다.
      */}
      <header className="sticky top-0 bg-white/90 backdrop-blur-md px-6 pt-14 pb-4 border-b border-stone-100 flex justify-between items-center z-10 rounded-b-[24px] shadow-sm">
        <button 
          onClick={() => router.back()} 
          className="text-stone-500 font-medium text-sm p-1 hover:bg-stone-50 rounded-lg transition"
        >
          취소
        </button>
        <h1 className="font-bold text-base text-stone-800 tracking-tight">코스 작성</h1>
        <button className="text-orange-600 font-bold text-sm p-1 hover:text-orange-700 transition">
          완료
        </button>
      </header>

      {/* 본문 콘텐츠 영역 */}
      <section className="p-6">
        {/* 검색 버튼: 좀 더 부드럽고 세련된 대시 라인 스타일 */}
        <button 
          onClick={() => router.push('/search')} 
          className="w-full py-4.5 border-2 border-dashed border-stone-200 bg-white rounded-2xl text-stone-400 text-sm font-semibold hover:border-orange-200 hover:bg-orange-50/20 hover:text-orange-500 active:scale-[0.99] transition-all flex items-center justify-center gap-2 shadow-sm"
        >
          <span>📍</span> 지도에서 장소 검색하여 담기
        </button>

        {/* 장소 리스트 */}
        <div className="mt-6 space-y-4">
          {places.length === 0 ? (
            <div className="text-center py-12 text-stone-300 text-sm font-medium">
              등록된 데이트 장소가 없습니다.<br/>위 버튼을 눌러 첫 장소를 찾아보세요!
            </div>
          ) : (
            places.map((place) => (
              <div 
                key={place.id} 
                className="bg-white p-5 rounded-2xl border border-stone-100 shadow-sm transition hover:shadow-md"
              >
                {/* 상단 장소명 & 구분 정보 */}
                <div className="flex justify-between items-start gap-3 mb-4">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-[16px] text-stone-800 truncate tracking-tight">{place.name}</h3>
                    <p className="text-xs text-stone-400 mt-0.5 font-medium tracking-tight truncate">{place.address}</p>
                  </div>
                  
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <input
                      type="text"
                      placeholder="구분 (예: 점심)"
                      className="w-24 text-center text-xs p-2 bg-stone-50 border border-stone-100 rounded-xl outline-none font-semibold text-stone-700 placeholder-stone-400 focus:ring-1 focus:ring-orange-300 focus:bg-white transition"
                      value={place.category}
                      onChange={(e) => updatePlaceField(place.id, 'category', e.target.value)}
                    />
                    {/* 삭제 버튼 */}
                    <button 
                      onClick={() => removePlace(place.id)}
                      className="p-1.5 text-stone-300 hover:text-stone-500 rounded-lg transition"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* 메모 작성 영역 */}
                <div className="space-y-2 border-t border-stone-50 pt-4">
                  {place.notes.map((note, idx) => (
                    <input
                      key={note.id}
                      className="w-full text-xs p-3 bg-stone-50/70 border border-stone-100 rounded-xl outline-none font-medium text-stone-700 placeholder-stone-400 focus:border-orange-200 focus:bg-white transition"
                      placeholder={`📝 메모 ${idx + 1}을 입력해보세요...`}
                      value={note.text}
                      onChange={(e) => updateNote(place.id, note.id, e.target.value)}
                    />
                  ))}
                  
                  {/* 메모 추가하기 링크 */}
                  <div className="pt-1 flex justify-start">
                    <button 
                      onClick={() => addNote(place.id)}
                      className="text-xs text-blue-500 font-bold hover:text-blue-600 transition flex items-center gap-1 px-1 py-0.5 rounded-md hover:bg-blue-50"
                    >
                      <span>＋</span> 메모 추가하기
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  );
}