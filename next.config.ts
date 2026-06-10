import withPWAInit from '@ducanh2912/next-pwa';

const withPWA = withPWAInit({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',  
  register: true,
  // skipWaiting은 workboxOptions 내부로 이동해야 빨간 줄이 사라집니다!
  workboxOptions: {
    skipWaiting: true,
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 앱 설정 공간
};

export default withPWA(nextConfig);