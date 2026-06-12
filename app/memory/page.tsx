"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, updateDoc, doc } from 'firebase/firestore';

// 노트 및 장소 타입 정의
type Note = { id: number; text: string };
type Place = { 
  id: number; 
  name: string; 
  address: string; 
  category: string; 
  notes: Note[]; 
  isSpecial?: boolean;
  placeUrl?: string; // 카카오맵 원본 URL
};

// 지난 데이트 코스 타입 정의
type PastDateItem = {
  id: string; 
  title: string;
  date: string; // YYYY.MM.DD 형식
  location: string;
  places: Place[]; 
};

// 특별한 기억으로 추출될 개별 장소 아이템 타입
type SpecialMemoryItem = {
  placeId: number;
  courseId: string;
  placeName: string;
  date: string;
  address: string;
  note: string;
  category: string;
  placeUrl: string;
  embedUrl: string;
};

// 퀵 필터 타입 선언
type FilterType = 'all' | 'week' | 'month' | 'year' | 'custom';

export default function MemoryPage() {
  const router = useRouter();
  
  const [activeMenu, setActiveMenu] = useState<'past' | 'special'>('past');
  const [dateFilter, setDateFilter] = useState<FilterType>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [memories, setMemories] = useState<PastDateItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 모달 상태 관리
  const [selectedCourse, setSelectedCourse] = useState<PastDateItem | null>(null);
  
  // 검색 페이지와 완벽히 동일한 구조의 팝업 타겟 상태
  const [selectedTarget, setSelectedTarget] = useState<{
    courseId: string;
    placeId: number;
    title: string;
    address: string;
    embedUrl: string;
    placeUrl: string;
    category: string;
    isSpecial: boolean;
  } | null>(null);

  // 파이어베이스 연동: 오직 완료된(completed) 코스만 로드
  useEffect(() => {
    fetchMemories();
  }, []);

  const fetchMemories = async () => {
    setIsLoading(true);
    try {
      const q = query(
        collection(db, "date_courses"),
        where("status", "==", "completed") 
      );
      
      const snapshot = await getDocs(q);
      const fetchedData: PastDateItem[] = [];

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        let detectedLocation = "위치 미상";
        if (data.places && data.places.length > 0) {
          const parts = (data.places[0].address || "").split(" ");
          detectedLocation = parts.length >= 2 ? `${parts[0]} ${parts[1]}` : parts[0];
        }

        fetchedData.push({
          id: docSnap.id,
          title: data.courseName || "이름 없는 코스",
          date: data.date || "0000.00.00",
          location: detectedLocation,
          places: data.places || []
        });
      });

      fetchedData.sort((a, b) => new Date(b.date.replace(/\./g, '-')).getTime() - new Date(a.date.replace(/\./g, '-')).getTime());
      setMemories(fetchedData);
    } catch (error) {
      console.error("❌ Firebase Fetch Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSpecialMemory = async (courseId: string, placeId: number) => {
    const course = memories.find(c => c.id === courseId);
    if (!course) return;

    const updatedPlaces = course.places.map(p => 
      p.id === placeId ? { ...p, isSpecial: !p.isSpecial } : p
    );

    const updatedMemories = memories.map(c => 
      c.id === courseId ? { ...c, places: updatedPlaces } : c
    );
    setMemories(updatedMemories);

    if (selectedCourse && selectedCourse.id === courseId) {
      setSelectedCourse({ ...selectedCourse, places: updatedPlaces });
    }

    try {
      const courseRef = doc(db, "date_courses", courseId);
      await updateDoc(courseRef, { places: updatedPlaces });
    } catch (error) {
      console.error("DB 업데이트 실패:", error);
      alert("상태 변경에 실패했습니다.");
      fetchMemories();
    }
  };

  const getFilteredMemories = () => {
    const today = new Date();
    return memories.filter((item) => {
      if (item.date === "0000.00.00") return false;
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
        if (!startDate || !endDate) return true;
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59); 
        return itemDate >= start && itemDate <= end;
      }
      return true;
    });
  };

  // 💡 완전히 원복된 검색 페이지 팝업 로직 + m/ 중복 방어 코드
  const handleOpenPreview = (courseId: string, placeId: number, title: string, address: string, placeUrl?: string, category?: string, isSpecial?: boolean) => {
    const origUrl = placeUrl || "";
    let embedUrl = origUrl;

    if (origUrl.includes("place.map.kakao.com/")) {
      // url에 이미 m/ 이 들어있을 경우 없애고 숫자(ID)만 남깁니다. (안 그러면 m/m/1234 가 되어서 검색창으로 튕김)
      const pid = origUrl.split("place.map.kakao.com/")[1]?.split("?")[0].replace("m/", "");
      embedUrl = `https://place.map.kakao.com/m/${pid}`;
    } else {
      embedUrl = `https://map.kakao.com/link/search/${encodeURIComponent(title)}`;
    }

    let optimizedCategory = category || "";
    if (optimizedCategory.includes(">")) {
      const parts = optimizedCategory.split(">");
      optimizedCategory = parts[parts.length - 1].trim();
    }

    setSelectedTarget({
      courseId,
      placeId,
      title,
      address,
      embedUrl,
      placeUrl: origUrl,
      category: optimizedCategory || "장소",
      isSpecial: !!isSpecial
    });
  };

  const getSpecialMemories = (courses: PastDateItem[]): SpecialMemoryItem[] => {
    const specials: SpecialMemoryItem[] = [];
    courses.forEach(course => {
      course.places.forEach(place => {
        if (place.isSpecial) {
          const origUrl = place.placeUrl || "";
          let embedUrl = origUrl;

          // 💡 여기도 완벽하게 동일하게 적용
          if (origUrl.includes("place.map.kakao.com/")) {
            const pid = origUrl.split("place.map.kakao.com/")[1]?.split("?")[0].replace("m/", "");
            embedUrl = `https://place.map.kakao.com/m/${pid}`;
          } else {
            embedUrl = `https://map.kakao.com/link/search/${encodeURIComponent(place.name)}`;
          }

          let optimizedCategory = place.category || "";
          if (optimizedCategory.includes(">")) {
            const parts = optimizedCategory.split(">");
            optimizedCategory = parts[parts.length - 1].trim();
          }

          specials.push({
            placeId: place.id,
            courseId: course.id,
            placeName: place.name,
            date: course.date,
            address: place.address || '주소 정보 없음',
            note: place.notes && place.notes[0] ? place.notes[0].text : '',
            category: optimizedCategory || '특별한 기억',
            placeUrl: origUrl,
            embedUrl: embedUrl
          });
        }
      });
    });
    return specials.sort((a, b) => new Date(b.date.replace(/\./g, '-')).getTime() - new Date(a.date.replace(/\./g, '-')).getTime());
  };

  const filteredMemories = getFilteredMemories();
  const specialMemories = getSpecialMemories(filteredMemories);
  const mainPaddingTop = dateFilter === 'custom' ? 'pt-[240px]' : 'pt-[190px]';

  return (
    <main className={`min-h-screen bg-stone-50 pb-16 overflow-x-hidden relative transition-all duration-300 ${mainPaddingTop}`}>
      
      {/* 상단 고정 헤더 바 (조회 필터 통합) */}
      <header className="fixed top-0 left-0 w-full z-30 pointer-events-none">
        <div className="bg-white/95 backdrop-blur-md pb-4 z-20 rounded-b-[24px] shadow-sm pointer-events-auto transition-all duration-300">
          <div className="pt-14 px-4 flex items-center justify-between pb-2">
            <button onClick={() => router.back()} className="p-2 hover:bg-stone-50 rounded-xl transition text-stone-500">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
            <h1 className="text-[16px] font-bold text-stone-800 tracking-tight">우리의 추억함</h1>
            <div className="w-9 h-9 flex items-center justify-center text-lg"></div> 
          </div>

          <div className="flex px-6 pt-2 pb-1 gap-2">
            <button
              onClick={() => setActiveMenu('past')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                activeMenu === 'past' ? 'bg-stone-900 text-white shadow-sm' : 'bg-stone-50 text-stone-400 border border-stone-100/70 hover:bg-stone-100'
              }`}
            >
              지난 데이트 기록
            </button>
            <button
              onClick={() => setActiveMenu('special')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                activeMenu === 'special' ? 'bg-rose-500 text-white shadow-sm' : 'bg-stone-50 text-stone-400 border border-stone-100/70 hover:bg-stone-100'
              }`}
            >
              기억에 남는 장소
            </button>
          </div>

          <div className="px-6 mt-3 animate-fadeIn">
            <div className="pt-3 border-t border-stone-100">
              <span className="text-[10px] font-bold text-stone-400 block mb-2">📅 기간별 조회</span>
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

              {dateFilter === 'custom' && (
                <div className="mt-3 pt-3 border-t border-stone-50 flex items-center gap-2 animate-fadeIn">
                  <input 
                    type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                    className="flex-1 p-2 bg-stone-50 border border-stone-100 rounded-xl text-xs font-semibold text-stone-700 outline-none focus:border-orange-300 focus:bg-white transition"
                  />
                  <span className="text-stone-300 text-xs font-bold">~</span>
                  <input 
                    type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                    className="flex-1 p-2 bg-stone-50 border border-stone-100 rounded-xl text-xs font-semibold text-stone-700 outline-none focus:border-orange-300 focus:bg-white transition"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="h-[70px] shrink-0 w-full" aria-hidden="true"></div>

      {/* 메인 피드 리스트 */}
      <section className="mx-6 mt-2">
        {isLoading ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-stone-100 shadow-sm text-stone-400 text-xs font-medium leading-relaxed">
            ⏳ 추억을 불러오는 중...
          </div>
        ) : activeMenu === 'special' ? (
          specialMemories.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-stone-100 shadow-sm text-stone-300 text-xs font-medium leading-relaxed">
              선택한 기간 내에<br/>특별한 기억으로 지정된 장소가 없습니다.
            </div>
          ) : (
            <div className="space-y-4">
              {specialMemories.map((item) => (
                <div 
                  key={`${item.courseId}-${item.placeId}`} 
                  onClick={() => handleOpenPreview(item.courseId, item.placeId, item.placeName, item.address, item.placeUrl, item.category, true)}
                  className="border border-rose-100 bg-gradient-to-tr from-rose-50/40 to-white rounded-2xl p-5 shadow-sm transition-all flex flex-col justify-between cursor-pointer hover:shadow-md h-full"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shadow-sm shrink-0 border bg-rose-50 border-rose-100 text-rose-500">
                      💖
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-2">
                        <h3 className="font-bold text-[15px] text-stone-800 tracking-tight truncate">{item.placeName}</h3>
                        <span className="text-[10px] font-medium text-stone-400 shrink-0 mt-0.5">{item.date}</span>
                      </div>
                      <p className="text-xs text-stone-400 font-medium truncate mt-0.5">{item.address}</p>
                    </div>
                  </div>
                  {item.note && (
                    <div className="mt-4 p-3 rounded-xl text-[11px] font-medium leading-relaxed bg-white/90 text-rose-900/90 border border-rose-100/50 italic">
                      "{item.note}"
                    </div>
                  )}
                  
                  <div className="flex-grow"></div>
                  
                  <div className="mt-4 flex justify-between items-center border-t border-rose-100/30 pt-3">
                    <span className="text-[11px] font-bold text-stone-400">상세 보기</span>
                    {/* 💡 요청하신 어두운 톤으로 버튼 스타일 변경 완료 */}
                    <button 
                      onClick={(e) => {
                        e.stopPropagation(); 
                        toggleSpecialMemory(item.courseId, item.placeId);
                      }}
                      className="text-[10px] font-bold text-white bg-stone-700 px-3 py-1.5 rounded-lg border border-stone-800 hover:bg-stone-800 transition shadow-sm"
                    >
                      해제하기
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : filteredMemories.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-stone-100 shadow-sm text-stone-300 text-xs font-medium leading-relaxed">
            선택한 기간 내에<br/>다녀온 데이트 추억이 없습니다.
          </div>
        ) : (
          <div className="space-y-4">
            {filteredMemories.map((item) => {
              const hasSpecialPlace = item.places.some(p => p.isSpecial);
              
              return (
                <div 
                  key={item.id}
                  onClick={() => setSelectedCourse(item)}
                  className={`border rounded-2xl p-5 shadow-sm transition-all cursor-pointer hover:shadow-md flex flex-col justify-between h-full ${
                    hasSpecialPlace ? 'border-rose-100 bg-rose-50/10' : 'bg-white border-stone-100'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl shadow-sm shrink-0 border ${
                      hasSpecialPlace ? 'bg-rose-50 border-rose-100' : 'bg-stone-50 border-stone-100'
                    }`}>
                      {hasSpecialPlace ? '🥰' : '😊'}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-2">
                        <h3 className="font-bold text-[15px] text-stone-800 tracking-tight truncate">{item.title}</h3>
                        <span className="text-[10px] font-medium text-stone-400 shrink-0 mt-0.5">{item.date}</span>
                      </div>
                      <p className="text-xs text-stone-400 font-medium truncate mt-0.5">
                      {item.location} 포함 총 {item.places.length}곳
                      </p>
                    </div>
                  </div>

                  <div className="flex-grow"></div>

                  <div className="mt-4 pt-3 border-t border-stone-50 text-right">
                    <span className="text-[11px] font-bold text-stone-400 hover:text-stone-600">상세 보기 →</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 카카오맵 팝업 모달 (가장 높은 z-index 60 적용) */}
      {selectedTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[60] flex items-end justify-center">
          <div className="absolute inset-0" onClick={() => setSelectedTarget(null)} />
          <div className="w-full max-w-md h-[82vh] bg-white rounded-t-[32px] z-10 shadow-[0_-8px_30px_rgba(0,0,0,0.15)] flex flex-col overflow-hidden animate-slide-up transform">
            <div className="px-6 pt-4 pb-3 border-b border-stone-100 shrink-0 text-left bg-white">
              <div className="w-12 h-1 bg-stone-200 rounded-full mx-auto mb-3" />
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0">
                  <h4 className="font-bold text-stone-900 text-base tracking-tight truncate max-w-[260px]">{selectedTarget.title}</h4>
                  <p className="text-[11px] text-stone-400 font-medium truncate max-w-[260px] mt-0.5">{selectedTarget.address}</p>
                </div>
                <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded-md shrink-0">
                  {selectedTarget.category}
                </span>
              </div>
            </div>

            <div className="flex-1 w-full bg-stone-50 relative">
              <iframe
                src={selectedTarget.embedUrl}
                className="w-full h-full border-none"
                sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
                scrolling="yes"
              />
            </div>

            <div className="p-4 bg-white border-t border-stone-100 flex gap-3 shrink-0 pb-7">
              <button
                onClick={() => setSelectedTarget(null)}
                className="flex-1 py-3.5 bg-stone-100 text-stone-500 font-bold rounded-xl text-xs active:bg-stone-200 transition"
              >
                닫 기
              </button>
              {/* 💡 모달 창 내부 해제 버튼도 다크 그레이 적용 */}
              <button
                onClick={() => {
                  toggleSpecialMemory(selectedTarget.courseId, selectedTarget.placeId);
                  setSelectedTarget(null);
                }}
                className={`flex-[2.5] py-3.5 font-bold rounded-xl text-xs shadow-md transition ${
                  selectedTarget.isSpecial 
                    ? 'bg-stone-700 text-white shadow-stone-800/10 active:bg-stone-800' 
                    : 'bg-rose-500 text-white shadow-rose-500/10 active:bg-rose-600'
                }`}
              >
                {selectedTarget.isSpecial ? "특별한 장소에서 해제하기" : "특별한 장소로 지정하기"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 상세보기 및 특별한 기억 토글 모달 (지난 데이트 기록 탭용, z-index 50) */}
      {selectedCourse && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-end justify-center">
          <div className="absolute inset-0" onClick={() => setSelectedCourse(null)} />
          <div className="w-full max-w-md h-[85vh] bg-stone-50 rounded-t-[32px] z-10 shadow-2xl flex flex-col overflow-hidden animate-slide-up">
            
            <div className="px-6 pt-5 pb-4 border-b border-stone-100 bg-white shrink-0">
              <div className="w-12 h-1 bg-stone-200 rounded-full mx-auto mb-4" />
              <div className="flex justify-between items-end gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-lg text-stone-900 tracking-tight truncate">{selectedCourse.title}</h3>
                  <p className="text-[11px] font-medium text-stone-400 mt-1">{selectedCourse.date} 데이트 코스</p>
                </div>
                <button 
                  onClick={() => setSelectedCourse(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-stone-100 text-stone-500 font-bold text-sm"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {selectedCourse.places.map((place, index) => (
                <div key={place.id} className="relative pb-2">
                  {index < selectedCourse.places.length - 1 && (
                    <div className="absolute left-[21px] top-12 bottom-0 w-[2px] border-l-2 border-dashed border-stone-200 z-0" />
                  )}

                  <div 
                    onClick={() => handleOpenPreview(selectedCourse.id, place.id, place.name, place.address, place.placeUrl, place.category, place.isSpecial)}
                    className={`p-5 rounded-2xl border shadow-xs relative z-10 flex flex-col gap-3 transition-colors cursor-pointer hover:shadow-md ${
                      place.isSpecial ? 'bg-rose-50/30 border-rose-200' : 'bg-white border-stone-100'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <span className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full shrink-0 ${
                          place.isSpecial ? 'bg-rose-500 text-white' : 'bg-stone-800 text-white'
                        }`}>
                          {index + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <h5 className={`font-bold text-[15px] tracking-tight truncate ${place.isSpecial ? 'text-rose-900' : 'text-stone-800'}`}>
                            {place.name}
                          </h5>
                        </div>
                      </div>
                      
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSpecialMemory(selectedCourse.id, place.id);
                        }}
                        className={`shrink-0 flex items-center justify-center w-8 h-8 rounded-full border transition-all ${
                          place.isSpecial 
                            ? 'bg-rose-100 border-rose-200 text-rose-500 scale-110 shadow-sm' 
                            : 'bg-stone-50 border-stone-200 text-stone-300 hover:bg-stone-100'
                        }`}
                      >
                        {place.isSpecial ? '❤️' : '🤍'}
                      </button>
                    </div>

                    <div className="text-[11px] text-stone-400 font-medium pl-8 -mt-2">
                      {place.address || "주소 정보 없음"}
                    </div>

                    {place.notes && place.notes.length > 0 && place.notes.some(n => n.text.trim()) && (
                      <div className="bg-white rounded-xl p-3 space-y-2 border border-stone-100/80 ml-8">
                        {place.notes.map((note, nIdx) => note.text.trim() && (
                          <div key={note.id} className="text-[11px] text-stone-600 font-medium flex items-start gap-2">
                            <span className="text-stone-300 select-none font-bold">{nIdx + 1}.</span>
                            <p className="leading-relaxed whitespace-pre-wrap flex-1">{note.text}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}