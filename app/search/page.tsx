"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '../../lib/firebase';
import { collection, addDoc, getDocs, query, orderBy, limit, where, deleteDoc, doc } from 'firebase/firestore';

type SearchHistoryItem = {
  id: string;
  title: string;
  address: string;
  date: string;
  placeUrl?: string;
  lat?: number;
  lng?: number;
  category?: string;
};

type KakaoPlaceItem = {
  id: string;
  place_name: string;
  address_name: string;
  road_address_name: string;
  category_group_name: string;
  category_name: string;
  x: string;
  y: string;
  place_url: string;
};

export default function SearchPlacePage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<string>('');
  const [keyword, setKeyword] = useState('');
  const [searchResults, setSearchResults] = useState<KakaoPlaceItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<{
    title: string;
    address: string;
    lat: string;
    lng: string;
    embedUrl: string;
    placeUrl: string;
    category?: string;
  } | null>(null);

  // 1. 로컬 스토리지에서 유저 정보 로드
  useEffect(() => {
    const storedUser = localStorage.getItem('currentUser') || 'me';
    setCurrentUser(storedUser);
  }, []);

  // 2. 유저 정보가 세팅된 후 검색 기록 로드
  useEffect(() => {
    if (currentUser) {
      fetchSearchHistory();
    }
  }, [currentUser]);

  const fetchSearchHistory = async () => {
    if (!currentUser) return;
    try {
      const q = query(
        collection(db, "search_history"),
        where("user", "==", currentUser),
        orderBy("clickedAt", "desc"),
        limit(10)
      );
      const querySnapshot = await getDocs(q);
      const historyList: SearchHistoryItem[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        let displayDate = data.searchDate || "";
        if (displayDate.includes("-")) {
          const parts = displayDate.split("-");
          displayDate = `${parts[1]}.${parts[2]}.`;
        }
        historyList.push({
          id: doc.id,
          title: data.placeName || "",
          address: data.address || "",
          date: displayDate,
          placeUrl: data.placeUrl || "",
          lat: data.latitude,
          lng: data.longitude,
          category: data.category || ""
        });
      });
      setHistory(historyList);
    } catch (error) {
      console.error("❌ [Firebase] 최근 검색 기록 로드 실패:", error);
    }
  };

  const handleDeleteHistory = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await deleteDoc(doc(db, "search_history", id));
      setHistory((prev) => prev.filter((item) => item.id !== id));
    } catch (error) {
      console.error("❌ [Firebase] 삭제 실패:", error);
    }
  };

  const handleOpenPreview = async (title: string, address: string, lat?: string, lng?: string, placeUrl?: string, category?: string) => {
    if (!currentUser) return;

    const origUrl = placeUrl || "";
    let embedUrl = origUrl;

    if (origUrl.includes("place.map.kakao.com/")) {
      const placeId = origUrl.split("place.map.kakao.com/")[1]?.split("?")[0];
      embedUrl = `https://place.map.kakao.com/m/${placeId}`;
    } else {
      embedUrl = `https://map.kakao.com/link/search/${encodeURIComponent(title)}`;
    }

    let optimizedCategory = category || "";
    if (optimizedCategory.includes(">")) {
      const parts = optimizedCategory.split(">");
      optimizedCategory = parts[parts.length - 1].trim();
    }

    setSelectedTarget({
      title,
      address,
      lat: lat || "0",
      lng: lng || "0",
      embedUrl,
      placeUrl: origUrl,
      category: optimizedCategory || "장소"
    });
    setIsSheetOpen(true);

    const today = new Date();
    const formattedDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    try {
      const duplicateQuery = query(
        collection(db, "search_history"),
        where("user", "==", currentUser),
        where("searchDate", "==", formattedDate),
        where("placeName", "==", title)
      );
      const duplicateSnapshot = await getDocs(duplicateQuery);
      
      if (duplicateSnapshot.empty) {
        await addDoc(collection(db, "search_history"), {
          user: currentUser,
          searchDate: formattedDate,      
          placeName: title,               
          address: address,               
          latitude: lat ? parseFloat(lat) : null,  
          longitude: lng ? parseFloat(lng) : null,
          placeUrl: origUrl,      
          category: optimizedCategory,
          clickedAt: new Date()            
        });
        fetchSearchHistory();
      }
    } catch (firebaseError) {
      console.error("❌ [Firebase History Save Error]:", firebaseError);
    }
  };

  const handleConfirmSelection = () => {
    if (!selectedTarget) return;
    const { title, address, lat, lng, placeUrl } = selectedTarget;
    setIsSheetOpen(false);
    setSelectedTarget(null);
    router.push(`/course/write?name=${encodeURIComponent(title)}&address=${encodeURIComponent(address)}&lat=${lat}&lng=${lng}&url=${encodeURIComponent(placeUrl)}`);
  };

  const fetchKakaoPlaces = (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    const { kakao } = window as any;
    if (!kakao || !kakao.maps) return;
    kakao.maps.load(() => {
      if (!kakao.maps.services) return;
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

  useEffect(() => {
    if (!keyword.trim()) {
      setIsSearching(false);
      setSearchResults([]);
      return;
    }
    const delayDebounceTimer = setTimeout(() => { fetchKakaoPlaces(keyword); }, 200);
    return () => clearTimeout(delayDebounceTimer);
  }, [keyword]);

  return (
    <main className="h-screen bg-stone-50 flex flex-col overflow-hidden">
      <div className="sticky top-0 bg-white/95 backdrop-blur-md pb-5 z-20 rounded-b-[24px] shadow-sm shrink-0">
        <div className="pt-14 px-4 flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 active:bg-stone-100 rounded-xl transition text-stone-500">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
          </button>
          <div className="flex-1 flex items-center bg-stone-50 border border-stone-200/60 rounded-2xl px-4 py-3 focus-within:ring-2 focus-within:ring-orange-100 focus-within:bg-white focus-within:border-orange-200 transition-all">
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="검색어를 입력하세요."
              autoFocus
              className="w-full bg-transparent outline-none text-[15px] text-stone-800 placeholder-stone-400 font-medium"
            />
            {keyword && <button onClick={() => setKeyword('')} className="p-0.5 text-stone-400 mr-1.5 text-xs bg-stone-200 rounded-full w-4 h-4 flex items-center justify-center shrink-0">✕</button>}
          </div>
        </div>
      </div>

      <div className="mx-6 my-6 bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden flex flex-col max-h-[calc(100vh-160px)]">
        <div className="px-5 py-4 bg-white border-b border-stone-50 flex items-center shrink-0">
          <span className="text-xs font-bold text-stone-400 tracking-tight">{isSearching ? `🔍 실시간 검색 결과` : "⏳ 내가 검색했던 장소 목록"}</span>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-stone-50">
          {isSearching && searchResults.length > 0 && (
            searchResults.map((item) => (
              <div key={item.id} onClick={() => handleOpenPreview(item.place_name, item.road_address_name || item.address_name, item.y, item.x, item.place_url, item.category_name)} className="flex items-center justify-between px-5 py-4 active:bg-stone-50 transition cursor-pointer bg-white">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center text-base shadow-sm shrink-0">🕐</div>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-[15px] text-stone-800 tracking-tight truncate">{item.place_name}</span>
                      {item.category_group_name && <span className="text-[9px] font-semibold text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded shrink-0">{item.category_group_name}</span>}
                    </div>
                    <span className="text-xs text-stone-400 font-medium truncate mt-0.5">{item.road_address_name || item.address_name}</span>
                  </div>
                </div>
              </div>
            ))
          )}

          {!isSearching && (
            history.length === 0 ? (
              <div className="text-center py-14 text-stone-300 text-sm font-medium bg-white">최근에 선택하여 저장한 데이트 장소가 없습니다.</div>
            ) : (
              history.map((item) => (
                <div key={item.id} onClick={() => handleOpenPreview(item.title, item.address, item.lat?.toString(), item.lng?.toString(), item.placeUrl, item.category)} className="flex items-center justify-between px-5 py-4 active:bg-stone-50 transition cursor-pointer bg-white">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-stone-100 text-stone-400 flex items-center justify-center text-base shadow-sm shrink-0">🕐</div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-bold text-[15px] text-stone-800 tracking-tight truncate">{item.title}</span>
                      <span className="text-xs text-stone-400 font-medium truncate mt-0.5">{item.address}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                    <span className="text-[11px] font-medium text-stone-400/70 tracking-tighter">{item.date}</span>
                    <button onClick={(e) => handleDeleteHistory(e, item.id)} className="text-stone-300 hover:text-red-400 p-1 transition">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" /></svg>
                    </button>
                  </div>
                </div>
              ))
            )
          )}
        </div>
      </div>

      {isSheetOpen && selectedTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-end justify-center">
          <div className="absolute inset-0" onClick={() => { setIsSheetOpen(false); setSelectedTarget(null); }} />
          <div className="w-full max-w-md h-[82vh] bg-white rounded-t-[32px] z-10 shadow-[0_-8px_30px_rgba(0,0,0,0.15)] flex flex-col overflow-hidden animate-slide-up transform">
            <div className="px-6 pt-4 pb-3 border-b border-stone-100 shrink-0 text-left bg-white">
              <div className="w-12 h-1 bg-stone-200 rounded-full mx-auto mb-3" />
              <div className="flex justify-between items-start gap-2">
                <div>
                  <h4 className="font-bold text-stone-900 text-base tracking-tight truncate max-w-[260px]">{selectedTarget.title}</h4>
                  <p className="text-[11px] text-stone-400 font-medium truncate max-w-[260px] mt-0.5">{selectedTarget.address}</p>
                </div>
                <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded-md shrink-0">{selectedTarget.category}</span>
              </div>
            </div>
            <div className="flex-1 w-full bg-stone-50 relative">
              <iframe src={selectedTarget.embedUrl} className="w-full h-full border-none" sandbox="allow-same-origin allow-scripts allow-forms allow-popups" scrolling="yes" />
            </div>
            <div className="p-4 bg-white border-t border-stone-100 flex gap-3 shrink-0 pb-7">
              <button onClick={() => { setIsSheetOpen(false); setSelectedTarget(null); }} className="flex-1 py-3.5 bg-stone-100 text-stone-500 font-bold rounded-xl text-xs active:bg-stone-200 transition">닫 기</button>
              <button onClick={handleConfirmSelection} className="flex-[2.5] py-3.5 bg-orange-500 text-white font-bold rounded-xl text-xs shadow-md shadow-orange-500/10 active:bg-orange-600 transition">데이트 코스에 추가하기</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}